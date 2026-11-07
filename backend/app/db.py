import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .models import Subscription


@contextmanager
def connect():
    path = Path(os.getenv("DATABASE_PATH", "data/byebye.db"))
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=30)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        yield conn
        conn.commit()
    finally:
        conn.close()


def init():
    with connect() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS jobs (
          id INTEGER PRIMARY KEY, service_id TEXT NOT NULL, kind TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE UNIQUE INDEX IF NOT EXISTS active_job ON jobs(service_id, kind)
          WHERE status IN ('queued','running');
        CREATE TABLE IF NOT EXISTS sso_logs (
          service_id TEXT NOT NULL, user_id INTEGER NOT NULL, logged_at TEXT NOT NULL,
          success INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS sso_lookup ON sso_logs(service_id, logged_at, success);
        CREATE TABLE IF NOT EXISTS sso_apps (service_id TEXT PRIMARY KEY);
        """)


def save(service: Subscription):
    with connect() as conn:
        conn.execute("INSERT OR REPLACE INTO subscriptions VALUES (?, ?)",
                     (service.id, service.model_dump_json()))


def get(service_id: str) -> Subscription | None:
    with connect() as conn:
        row = conn.execute("SELECT data FROM subscriptions WHERE id=?", (service_id,)).fetchone()
    return Subscription.model_validate_json(row["data"]) if row else None


def all_services() -> list[Subscription]:
    with connect() as conn:
        rows = conn.execute("SELECT data FROM subscriptions ORDER BY rowid").fetchall()
    return [Subscription.model_validate(json.loads(row["data"])) for row in rows]


def enqueue(service_id: str, kind: str = "research"):
    with connect() as conn:
        conn.execute("INSERT OR IGNORE INTO jobs(service_id,kind) VALUES (?,?)", (service_id, kind))
