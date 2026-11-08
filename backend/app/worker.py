import logging
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from threading import Event

from dotenv import load_dotenv

from . import agent, db

logging.basicConfig(level=logging.INFO)


def run_one() -> bool:
    with db.connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("""SELECT * FROM jobs j WHERE status='queued' AND NOT EXISTS (
          SELECT 1 FROM jobs running WHERE running.service_id=j.service_id AND running.status='running'
        ) ORDER BY id LIMIT 1""").fetchone()
        if not row:
            return False
        conn.execute("UPDATE jobs SET status='running', attempts=attempts+1 WHERE id=?", (row["id"],))
    service = db.get(row["service_id"])
    if service:
        try:
            service.status, service.error = "searching", None
            db.save(service)
            agent.run_agent(service, row["kind"])
        except Exception as exc:
            logging.exception("Job %s failed", row["id"])
            service.status = "error"
            service.error = str(exc)[:600]
        db.save(service)
    with db.connect() as conn:
        conn.execute("UPDATE jobs SET status='done' WHERE id=?", (row["id"],))
    return True


def main():
    if os.getenv("BYEBYE_LOAD_ENV", "1") != "0":
        load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=True)
    db.init()
    # One coordinator process, multiple concurrent jobs; claim/write transactions stay short.
    with db.connect() as conn:
        conn.execute("UPDATE jobs SET status='queued' WHERE status='running'")
    concurrency = max(1, min(16, int(os.getenv("WORKER_CONCURRENCY", "6"))))
    print(f"Worker ready ({concurrency} concurrent jobs)", flush=True)
    stop = Event()

    def consume(_):
        while not stop.is_set():
            try:
                if not run_one():
                    stop.wait(.5)
            except Exception:
                logging.exception("Worker loop failed; retrying")
                stop.wait(2)

    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        try:
            list(pool.map(consume, range(concurrency)))
        except KeyboardInterrupt:
            stop.set()


if __name__ == "__main__":
    main()
