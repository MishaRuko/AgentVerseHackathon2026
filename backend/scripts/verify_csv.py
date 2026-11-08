"""Exercise the real Gemini pipeline against the upload fixture in an isolated DB."""
import json
import os
import sys
import tempfile
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
            with ThreadPoolExecutor(max_workers=3) as pool:
                list(pool.map(lambda _: drain(), range(3)))
            for service in db.all_services():
                if service.users is None and service.status != "error":
                    db.enqueue(service.id, "sso")
            with ThreadPoolExecutor(max_workers=3) as pool:
                list(pool.map(lambda _: drain(), range(3)))
            services = db.all_services()
            report = [{"name": s.name, "status": s.status, "users": s.users,
                       "user_source": s.user_source, "tiers": len(s.tiers),
                       "estimated_tiers": sum(t.estimated for t in s.tiers),
                       "suggested_tier": s.suggested_tier, "savings": s.savings,
                       "error": s.error} for s in services]
            print(json.dumps(report, indent=2), flush=True)
            (scratch / "live-csv-results.json").write_text(json.dumps(report, indent=2))
            assert len(services) == 10
            assert all(s.status in {"suggestion", "optimal"} for s in services)
            assert all(s.users is not None and s.tiers and s.suggested_tier for s in services)
            filtered = api.post("/api/filter", json={"message": "Show news subscriptions"})
            filtered.raise_for_status()
            print("Natural-language filter:", filtered.json(), flush=True)


if __name__ == "__main__":
    main()
