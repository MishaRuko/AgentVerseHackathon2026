import io
from datetime import datetime, timezone
from types import SimpleNamespace
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event, Lock
from pathlib import Path
import statistics

import pytest
from dateutil.relativedelta import relativedelta
from fastapi.testclient import TestClient
from openpyxl import Workbook
from google.genai import types
from google.genai import errors

from app import agent, db, sso, worker
from app.importer import parse_file
from app.main import app
from app.models import Subscription, Tier


@pytest.fixture(autouse=True)
def database(tmp_path, monkeypatch):
    monkeypatch.setenv("BYEBYE_LOAD_ENV", "0")
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "test.db"))
    monkeypatch.delenv("APP_TOKEN", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    db.init()


def test_csv_flexible_columns_and_annual_cost():
    services, warnings = parse_file("test.csv", b'Supplier,Active Users,Cost,Period\nNotion,5,1200,Annual\nBad,-2,50,Monthly\n')
    assert len(services) == 1
    assert services[0].spend == 100
    assert services[0].users == 5
    assert services[0].user_source == "Manual"
    assert len(warnings) == 1


def test_xlsx_multiple_sheets_and_preamble():
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["Organisation subscription report"])
    sheet.append(["Subscription name", "Number of users", "Current spend"])
    sheet.append(["Figma", 0, 50])
    second = workbook.create_sheet("More")
    second.append(["Service", "Users"])
    second.append(["Zoom", 2])
    buffer = io.BytesIO()
    workbook.save(buffer)
    services, warnings = parse_file("test.xlsx", buffer.getvalue())
    assert not warnings
    assert [s.name for s in services] == ["Figma", "Zoom"]
    assert services[0].users == 0


@pytest.mark.parametrize("users,spend,status,savings", [(5, 100, "suggestion", 50),
    (5, None, "suggestion", None), (5, 50, "optimal", 0), (None, 50, "needs_users", None)])
def test_recommendation(users, spend, status, savings):
    service = Subscription(id="a", name="App", users=users, spend=spend,
        tiers=[Tier(name="Team", monthly_price=10, per_user=True, description="per seat")])
    agent.recommend(service, use_llm=False)
    assert service.status == status
    assert service.savings == savings


def test_currency_capacity_and_minimum_seats():
    service = Subscription(id="a", name="App", users=5, spend=100, tiers=[
        Tier(name="Wrong currency", monthly_price=1, currency="USD", description=""),
        Tier(name="Too small", monthly_price=1, max_users=4, description=""),
        Tier(name="Team", monthly_price=2, minimum_seats=10, per_user=True, description=""),
        Tier(name="Enterprise", description="Quote only")])
    agent.recommend(service, use_llm=False)
    assert service.suggested_tier == "Team"
    assert service.optimal_spend == 20


def test_sso_three_calendar_months_distinct_successful_only():
    now = datetime(2026, 11, 7, tzinfo=timezone.utc)
    cutoff = now - relativedelta(months=3)
    with db.connect() as conn:
        conn.executemany("INSERT INTO sso_logs VALUES (?,?,?,?)", [
            ("a", 1, now.isoformat(), 1), ("a", 1, cutoff.isoformat(), 1),
            ("a", 2, (cutoff - relativedelta(days=1)).isoformat(), 1),
            ("a", 3, now.isoformat(), 0), ("other", 4, now.isoformat(), 1),
            ("a", 5, (now + relativedelta(days=1)).isoformat(), 1)])
    assert sso.active_users("a", now)["users"] == 1


def test_mock_generator_is_idempotent_and_bounded():
    db.save(Subscription(id="mock", name="App"))
    now = datetime.now(timezone.utc)
    sso.ensure_logs("mock")
    result = sso.active_users("mock", now)
    assert 5 <= result["users"] <= 300
    sso.ensure_logs("mock")
    assert sso.active_users("mock", now) == result


def test_demo_end_to_end_and_persistence():
    with TestClient(app) as client:
        assert client.post("/api/demo").status_code == 200
        assert client.post("/api/demo").status_code == 409
        while worker.run_one():
            pass
        payload = client.get("/api/workspace").json()
        assert len(payload["services"]) == 8
        assert payload["pending_jobs"] == 0
        service = payload["services"][0]
        assert service["savings"] == 530
        assert db.get(service["id"]).savings == 530
        assert client.patch(f"/api/services/{service['id']}", json={"users": 4}).status_code == 200
        assert worker.run_one()
        assert db.get(service["id"]).users == 4


def test_upload_duplicates_and_auth(monkeypatch):
    with TestClient(app) as client:
        data = {"files": ("test.csv", b"Service,Users\nNotion,5\nNotion,10")}
        response = client.post("/api/upload", files=data)
        assert response.json()["imported"] == 1
        assert response.json()["warnings"]
        monkeypatch.setenv("APP_TOKEN", "secret")
        assert client.get("/api/workspace").status_code == 401
        assert client.get("/api/workspace", headers={"Authorization": "Bearer secret"}).status_code == 200
        assert client.get("/health").status_code == 200


def test_missing_key_is_visible_failure_not_fake_pricing():
    db.save(Subscription(id="a", name="App"))
    db.enqueue("a")
    assert worker.run_one()
    assert db.get("a").status == "error"
    assert "GEMINI_API_KEY" in db.get("a").error
    assert not db.get("a").tiers


def test_agent_uses_sso_tools_in_order(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-placeholder")
    calls = iter(["count_active_users", "inspect_sso_logs", "count_active_users", "calculate_recommendation"])
    used = []

    def generate(**kwargs):
        name = next(calls)
        used.append(name)
        return SimpleNamespace(candidates=[SimpleNamespace(content=types.Content(role="model",
            parts=[types.Part.from_function_call(name=name, args={})]))],
            function_calls=[SimpleNamespace(name=name)])

    monkeypatch.setattr(agent, "client", lambda: SimpleNamespace(models=SimpleNamespace(generate_content=generate)))
    original = agent.recommend
    monkeypatch.setattr(agent, "recommend", lambda service: original(service, use_llm=False))
    service = Subscription(id="agent", name="App", metadata_researched_at="2026-11-08",
        tiers=[Tier(name="Team", monthly_price=5, per_user=True, description="")])
    db.save(service)
    agent.run_agent(service, "sso")
    assert used == ["count_active_users", "inspect_sso_logs", "count_active_users", "calculate_recommendation"]
    assert service.user_source == "SSO"
    assert service.users is not None
    assert service.suggested_tier == "Team"
    assert db.get(service.id).suggested_tier == "Team"


def test_edit_preserves_card_order_and_busy_jobs_reject_edits():
    with TestClient(app) as client:
        client.post("/api/demo")
        services = client.get("/api/workspace").json()["services"]
        ids = [service["id"] for service in services]
        assert client.patch(f"/api/services/{ids[0]}", json={"users": 1}).status_code == 409
        while worker.run_one():
            pass
        assert client.patch(f"/api/services/{ids[0]}", json={"users": 5}).status_code == 200
        worker.run_one()
        assert [s.id for s in db.all_services()] == ids


def test_nan_and_fractional_users_are_rejected():
    services, warnings = parse_file("test.csv", b"Service,Users,Spend\nBad,NaN,100\nFraction,1.5,100\nInfinity,2,inf")
    assert services == []
    assert len(warnings) == 3


def test_clear_demo_keeps_real_uploads():
    with TestClient(app) as client:
        client.post("/api/demo")
        client.post("/api/upload", files={"files": ("real.csv", b"Service,Users\nReal App,5")})
        assert client.post("/api/demo/clear").status_code == 200
        assert [s.name for s in db.all_services()] == ["Real App"]


def test_spend_only_edit_keeps_sso_provenance():
    service = Subscription(id="sso", name="App", users=5, user_source="SSO", demo=True,
        tiers=[Tier(name="Team", monthly_price=10, description="")])
    db.save(service)
    with TestClient(app) as client:
        assert client.patch("/api/services/sso", json={"spend": 100}).status_code == 200
    worker.run_one()
    assert db.get("sso").user_source == "SSO"


def test_workspaces_are_isolated_and_deletion_cannot_resurrect_data():
    with TestClient(app) as client:
        first = client.post("/api/workspaces", json={"name": "Research"}).json()
        second = client.post("/api/workspaces", json={"name": "Teaching"}).json()
        header = {"X-Workspace-ID": first["id"]}
        fixture = {"files": ("test.csv", b"Service,Users\nNotion,5")}
        assert client.post("/api/upload", files=fixture, headers=header).json()["imported"] == 1
        service = client.get("/api/workspace", headers=header).json()["services"][0]
        retained = db.get(service["id"])
        other = {"X-Workspace-ID": second["id"]}
        assert client.get("/api/workspace", headers=other).json()["services"] == []
        assert client.post(f"/api/services/{service['id']}/sso", headers=other).status_code == 404
        assert client.post("/api/upload", files=fixture, headers=other).json()["imported"] == 1
        assert client.delete(f"/api/workspaces/{first['id']}").status_code == 200
        db.save(retained)  # Simulate a tool finishing after deletion.
        db.enqueue(retained.id)
        sso.ensure_logs(retained.id)
        assert db.get(retained.id) is None
        with db.connect() as conn:
            assert conn.execute("SELECT COUNT(*) FROM jobs WHERE service_id=?", (retained.id,)).fetchone()[0] == 0
            assert conn.execute("SELECT COUNT(*) FROM sso_logs WHERE service_id=?", (retained.id,)).fetchone()[0] == 0
        assert len(client.get("/api/workspace", headers=other).json()["services"]) == 1


def test_delete_last_workspace_leaves_fresh_upload_screen():
    with TestClient(app) as client:
        assert client.delete("/api/workspaces/default").status_code == 200
        result = client.get("/api/workspace").json()
        assert result["id"] != "default"
        assert result["services"] == []
        assert len(result["workspaces"]) == 1


def test_price_fallback_retains_provenance_without_invented_sources(monkeypatch):
    monkeypatch.setattr(agent, "generate", lambda **kwargs: SimpleNamespace(text='{"tiers":[]}'))
    service = Subscription(id="fallback", name="Financial Times", users=5, spend=500, category="News")
    agent.research(service)
    assert all(t.estimated and not t.source_url for t in service.tiers)
    agent.recommend(service, use_llm=False)
    assert service.suggested_tier == "Team"
    assert service.optimal_spend == 128
    assert service.savings == 372
    assert {r.billing_period for r in service.recommendations} == {"monthly", "annual"}
    assert service.category == "News"


def test_json_research_accepts_wrapped_model_output():
    assert agent.json_result('Here is the result: {"tiers":[]}\nSources below') == {"tiers": []}


def test_each_billing_period_gets_its_own_best_plan():
    service = Subscription(id="billing", name="App", users=12, spend=200, tiers=[
        Tier(name="Team", monthly_price=10, per_user=True, billing_period="monthly", description=""),
        Tier(name="Team", monthly_price=8, per_user=True, billing_period="annual", description=""),
        Tier(name="Business", monthly_price=9, per_user=True, billing_period="monthly", description=""),
    ])
    agent.recommend(service, use_llm=False)
    monthly, annual = service.recommendations
    assert (monthly.tier_name, monthly.monthly_cost) == ("Business", 108)
    assert (annual.tier_name, annual.monthly_cost, annual.annual_cost) == ("Team", 96, 1152)
    assert service.suggested_billing_period == "annual"
    assert service.savings == 104


def test_annual_only_fit_does_not_invent_a_monthly_plan():
    service = Subscription(id="annual", name="App", users=30, tiers=[
        Tier(name="Small", monthly_price=10, max_users=10, billing_period="monthly", description=""),
        Tier(name="Organisation", monthly_price=100, max_users=100, billing_period="annual", description=""),
    ])
    agent.recommend(service, use_llm=False)
    assert len(service.recommendations) == 1
    assert service.recommendations[0].billing_period == "annual"
    assert not any(t.estimated for t in service.tiers)


def test_annual_upfront_cost_is_not_derived_from_rounded_monthly_amount():
    service = Subscription(id="rounding", name="App", users=1, spend=10, tiers=[
        Tier(name="Annual", monthly_price=100 / 12, billing_period="annual", description="")])
    agent.recommend(service, use_llm=False)
    result = service.recommendations[0]
    assert result.monthly_cost == 8.33
    assert result.annual_cost == 100
    assert result.monthly_savings == 1.67
    assert result.annual_savings == 20


def test_worker_claims_different_subscriptions_in_parallel(monkeypatch):
    barrier = Barrier(6)
    lock = Lock()
    seen = []

    def process(service, intent):
        with lock:
            seen.append(service.id)
        barrier.wait(timeout=10)
        agent.recommend(service, use_llm=False)

    monkeypatch.setattr(agent, "run_agent", process)
    for index in range(6):
        service = Subscription(id=f"parallel-{index}", name=f"App {index}", users=5)
        db.save(service)
        db.enqueue(service.id)
    with ThreadPoolExecutor(max_workers=6) as pool:
        assert all(pool.map(lambda _: worker.run_one(), range(6)))
    assert len(set(seen)) == 6
    assert all(s.status == "suggestion" for s in db.all_services())


def test_same_subscription_is_not_processed_twice_at_once(monkeypatch):
    started, release = Event(), Event()

    def process(service, intent):
        started.set()
        assert release.wait(timeout=10)

    monkeypatch.setattr(agent, "run_agent", process)
    db.save(Subscription(id="same", name="App"))
    db.enqueue("same", "research")
    db.enqueue("same", "sso")
    with ThreadPoolExecutor(max_workers=1) as pool:
        first = pool.submit(worker.run_one)
        assert started.wait(timeout=10)
        assert worker.run_one() is False
        release.set()
        assert first.result()
    assert worker.run_one()


def test_sso_population_distribution_and_upgrade():
    counts = []
    for index in range(100):
        service = Subscription(id=f"distribution-{index}", name=f"Service {index}")
        db.save(service)
        sso.ensure_logs(service.id)
        counts.append(sso.active_users(service.id)["users"])
    assert max(counts) <= 300
    assert 70 <= statistics.mean(counts) <= 90
    assert 20 <= statistics.stdev(counts) <= 40
    with db.connect() as conn:
        conn.execute("UPDATE sso_apps SET generation=1 WHERE service_id='distribution-0'")
        conn.execute("INSERT INTO sso_logs VALUES (?,?,?,1)",
            ("distribution-0", 6549, datetime.now(timezone.utc).isoformat()))
    sso.ensure_logs("distribution-0")
    assert sso.active_users("distribution-0")["users"] == counts[0]


def test_completed_bulk_analysis_requires_confirmation():
    service = Subscription(id="complete", name="App", users=5, demo=True,
        tiers=[Tier(name="Team", monthly_price=10, description="Monthly")])
    agent.recommend(service, use_llm=False)
    db.save(service)
    with TestClient(app) as client:
        response = client.post("/api/enrich").json()
        assert response == {"queued": 0, "already_analysed": True}
        assert client.post("/api/enrich", json={"force": True}).json()["queued"] == 1


def test_expanded_csv_has_realistic_usage_and_a_mixed_outcome():
    path = Path(__file__).resolve().parents[2] / "frontend/public/test-subscriptions.csv"
    services, warnings = parse_file(path.name, path.read_bytes())
    assert len(services) == 21 and not warnings
    assert "Category" not in path.read_text().splitlines()[0]
    for service in services:
        db.save(service)
        agent.apply_metadata(service, agent.local_metadata(service.name))
        service.tiers = agent.estimated_plans(service)
        if service.users is None:
            agent.retrieve_sso(service)
        agent.recommend(service, use_llm=False)
    assert all(5 <= s.users <= 300 for s in services)
    assert sum(s.status == "optimal" for s in services) >= 5
    assert sum((s.savings or 0) > 0 for s in services) >= 5
    assert sum(s.spend is None for s in services) == 3
    assert all(len(s.recommendations) == 2 for s in services)


def test_metadata_survives_pricing_timeout_without_activity_disclaimers(monkeypatch):
    def generate(**kwargs):
        if kwargs["config"].response_schema is not None:
            return SimpleNamespace(text='{"category":"News","description":"Global reporting.","tags":["news"],"website":"https://www.economist.com"}')
        raise errors.ServerError(504, {"error": {"message": "Deadline exceeded"}})

    monkeypatch.setattr(agent, "generate", generate)
    service = Subscription(id="metadata", name="The Economist", users=80, spend=1500)
    agent.research(service)
    assert service.category == "News"
    assert service.description == "Global reporting."
    assert service.metadata_researched_at
    assert service.tiers and all(t.estimated for t in service.tiers)
    assert not any("unavailable" in event or "Alternative" in event for event in service.events)
