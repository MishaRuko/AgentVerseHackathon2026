"""Mock SSO connector: synthetic users only; bounded, batched log generation."""
import hashlib
import json
import random
from datetime import datetime, timedelta, timezone

from dateutil.relativedelta import relativedelta

from . import db


def ensure_logs(service_id: str, population: int = 300):
    population = max(5, min(300, population))
    with db.connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT data FROM subscriptions WHERE id=?", (service_id,)).fetchone()
        if not row:
            return
        existing = conn.execute("SELECT generation FROM sso_apps WHERE service_id=?", (service_id,)).fetchone()
        if existing and existing["generation"] == 2:
            return
        name = json.loads(row["data"])["name"].casefold()
        rng = random.Random(int(hashlib.sha256(name.encode()).hexdigest()[:12], 16))
        now = datetime.now(timezone.utc)
        start = now - relativedelta(months=6)
        days = (now - start).days
        target = max(5, min(population, round(rng.gauss(80, 30))))
        participants = rng.sample(range(population), target)
        conn.execute("DELETE FROM sso_logs WHERE service_id=?", (service_id,))
        batch = []
        for user in participants:
            # Guarantee one recent successful event for each sampled active identity.
            batch.append((service_id, user, (now - timedelta(days=rng.randint(0, 60), hours=1)).isoformat(), 1))
            for _ in range(rng.randint(2, 24)):
                logged = start + timedelta(seconds=rng.randrange(days * 86400))
                batch.append((service_id, user, logged.isoformat(), int(rng.random() > .04)))
                if len(batch) >= 5000:
                    conn.executemany("INSERT INTO sso_logs VALUES (?,?,?,?)", batch)
                    batch.clear()
        # A small dormant cohort exercises the distinction between historical and active users.
        dormant = rng.sample([u for u in range(population) if u not in participants], min(20, population - target))
        cutoff = now - relativedelta(months=3)
        for user in dormant:
            batch.append((service_id, user, (cutoff - timedelta(days=rng.randint(1, 60))).isoformat(), 1))
        conn.executemany("INSERT INTO sso_logs VALUES (?,?,?,?)", batch)
        conn.execute("INSERT INTO sso_apps(service_id,generation) VALUES (?,2) ON CONFLICT(service_id) DO UPDATE SET generation=2", (service_id,))


def active_users(service_id: str, now: datetime | None = None) -> dict:
    """Tool: count distinct successful logins in the last three calendar months."""
    now = now or datetime.now(timezone.utc)
    cutoff = (now - relativedelta(months=3)).isoformat()
    with db.connect() as conn:
        row = conn.execute("""SELECT COUNT(DISTINCT user_id) AS users, COUNT(*) AS events
          FROM sso_logs WHERE service_id=? AND success=1 AND logged_at>=? AND logged_at<=?""",
          (service_id, cutoff, now.isoformat())).fetchone()
    return {"users": row["users"], "events": row["events"], "since": cutoff, "mock": True}
