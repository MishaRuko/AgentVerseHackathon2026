"""Exercise the real Gemini pipeline against the upload fixture in an isolated DB."""
import json
import os
import sys
import tempfile
import statistics
import time
import csv
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from dotenv import load_dotenv
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app import db, worker  # noqa: E402
from app.main import app  # noqa: E402


def drain():
    while worker.run_one():
        pass


def main():
    load_dotenv(ROOT / ".env", override=True)
    scratch = ROOT / ".kiro" / "temp"
    scratch.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="csv-check-", dir=scratch) as temporary:
        os.environ["DATABASE_PATH"] = str(Path(temporary) / "verify.db")
        with TestClient(app) as api:
            token = os.getenv("APP_TOKEN")
            if token:
                api.headers["Authorization"] = f"Bearer {token}"
            fixture = ROOT / "frontend" / "public" / "test-subscriptions.csv"
            result = api.post("/api/upload", files={"files": (fixture.name, fixture.read_bytes())})
            result.raise_for_status()
            print("Uploaded:", result.json(), flush=True)
            start = time.monotonic()
            with ThreadPoolExecutor(max_workers=6) as pool:
                list(pool.map(lambda _: drain(), range(6)))
            for service in db.all_services():
                if service.users is None and service.status != "error":
                    db.enqueue(service.id, "sso")
            with ThreadPoolExecutor(max_workers=6) as pool:
                list(pool.map(lambda _: drain(), range(6)))
            services = db.all_services()
            report = [{"name": s.name, "status": s.status, "users": s.users,
                       "user_source": s.user_source, "tiers": len(s.tiers),
                       "estimated_tiers": sum(t.estimated for t in s.tiers),
                       "suggested_tier": s.suggested_tier, "savings": s.savings,
                       "category": s.category, "tags": s.tags,
                       "billing_options": [r.model_dump() for r in s.recommendations],
                       "error": s.error} for s in services]
            print(json.dumps(report, indent=2), flush=True)
            (scratch / "live-csv-results.json").write_text(json.dumps(report, indent=2))
            assert len(services) == len(list(csv.DictReader(fixture.read_text().splitlines())))
            assert all(s.status in {"suggestion", "optimal"} for s in services)
            assert all(s.users is not None and s.tiers and s.suggested_tier for s in services)
            assert all(0 <= s.users <= 300 for s in services)
            assert all(s.metadata_researched_at and s.category != "Other" for s in services)
            assert any((s.savings or 0) > 0 for s in services)
            assert any(s.status == "optimal" for s in services)
            sso_users = [s.users for s in services if s.user_source == "SSO"]
            print("Summary:", {"elapsed_seconds": round(time.monotonic() - start, 1),
                "sso_mean": statistics.mean(sso_users), "sso_stdev": statistics.stdev(sso_users),
                "savings_cards": sum((s.savings or 0) > 0 for s in services),
                "no_action_cards": sum(s.status == "optimal" for s in services)}, flush=True)
            filtered = api.post("/api/filter", json={"message": "Show news subscriptions with at most 100 users, monthly spend above £500 and at least £50 monthly savings"})
            filtered.raise_for_status()
            print("Natural-language filter:", filtered.json(), flush=True)
            parsed = filtered.json()
            assert parsed["category"] == "News" and parsed["max_users"] == 100
            assert parsed["min_spend"] >= 500 and parsed["min_savings"] == 50


if __name__ == "__main__":
    main()
