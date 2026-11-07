"""Mock SSO connector: synthetic users only; bounded, batched log generation."""
import hashlib
import random
from datetime import datetime, timedelta, timezone

from dateutil.relativedelta import relativedelta

from . import db


def ensure_logs(service_id: str, population: int = 7000):
    with db.connect() as conn:
        if conn.execute("SELECT 1 FROM sso_apps WHERE service_id=?", (service_id,)).fetchone():
            return
        rng = random.Random(int(hashlib.sha256(service_id.encode()).hexdigest()[:12], 16))
        now = datetime.now(timezone.utc)
        start = now - relativedelta(months=6)
        days = (now - start).days
        participants = rng.sample(range(population), rng.randint(5, population))
        batch = []
        for user in participants:
            for _ in range(rng.randint(2, 24)):
                logged = start + timedelta(seconds=rng.randrange(days * 86400))
                batch.append((service_id, user, logged.isoformat(), int(rng.random() > .04)))
                if len(batch) >= 5000:
                    conn.executemany("INSERT INTO sso_logs VALUES (?,?,?,?)", batch)
                    batch.clear()
        conn.executemany("INSERT INTO sso_logs VALUES (?,?,?,?)", batch)
        conn.execute("INSERT INTO sso_apps VALUES (?)", (service_id,))


def active_users(service_id: str, now: datetime | None = None) -> dict:
    """Tool: count distinct successful logins in the last three calendar months."""
    now = now or datetime.now(timezone.utc)
    cutoff = (now - relativedelta(months=3)).isoformat()
    with db.connect() as conn:
        row = conn.execute("""SELECT COUNT(DISTINCT user_id) AS users, COUNT(*) AS events
          FROM sso_logs WHERE service_id=? AND success=1 AND logged_at>=? AND logged_at<=?""",
          (service_id, cutoff, now.isoformat())).fetchone()
    return {"users": row["users"], "events": row["events"], "since": cutoff, "mock": True}
