import logging
import time

from . import agent, db

logging.basicConfig(level=logging.INFO)


def run_one() -> bool:
    with db.connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT * FROM jobs WHERE status='queued' ORDER BY id LIMIT 1").fetchone()
        if not row:
            return False
        conn.execute("UPDATE jobs SET status='running', attempts=attempts+1 WHERE id=?", (row["id"],))
    service = db.get(row["service_id"])
    if service:
        try:
            service.status, service.error = "searching", None
            db.save(service)
            if row["kind"] == "sso":
                agent.retrieve_sso(service)
            if not service.tiers:
                agent.research(service)
            agent.recommend(service)
        except Exception as exc:
            logging.exception("Job %s failed", row["id"])
            service.status = "error"
            service.error = str(exc)[:600]
        db.save(service)
    with db.connect() as conn:
        conn.execute("UPDATE jobs SET status='done' WHERE id=?", (row["id"],))
    return True


def main():
    db.init()
    # One worker process per database. Recover interrupted work after container restart.
    with db.connect() as conn:
        conn.execute("UPDATE jobs SET status='queued' WHERE status='running'")
    while True:
        try:
            if not run_one():
                time.sleep(1)
        except Exception:
            logging.exception("Worker loop failed; retrying")
            time.sleep(3)


if __name__ == "__main__":
    main()
