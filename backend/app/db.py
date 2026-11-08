import json
import os
import sqlite3
from uuid import uuid4
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
        CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL);
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
        if not conn.execute("SELECT 1 FROM workspaces LIMIT 1").fetchone():
            conn.execute("INSERT INTO workspaces VALUES ('default', 'My workspace')")
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(subscriptions)")}
        if "workspace_id" not in columns:
            conn.execute("ALTER TABLE subscriptions ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default'")
        conn.execute("CREATE INDEX IF NOT EXISTS workspace_services ON subscriptions(workspace_id)")
        sso_columns = {row["name"] for row in conn.execute("PRAGMA table_info(sso_apps)")}
        if "generation" not in sso_columns:
            conn.execute("ALTER TABLE sso_apps ADD COLUMN generation INTEGER NOT NULL DEFAULT 1")


def save(service: Subscription):
    with connect() as conn:
        conn.execute("""INSERT INTO subscriptions(id,data,workspace_id)
            SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM workspaces WHERE id=?)
            ON CONFLICT(id) DO UPDATE SET data=excluded.data""",
            (service.id, service.model_dump_json(), service.workspace_id, service.workspace_id))


def get(service_id: str) -> Subscription | None:
    with connect() as conn:
        row = conn.execute("SELECT data FROM subscriptions WHERE id=?", (service_id,)).fetchone()
    return Subscription.model_validate_json(row["data"]) if row else None


def all_services(workspace_id: str = "default") -> list[Subscription]:
    with connect() as conn:
        rows = conn.execute("SELECT data FROM subscriptions WHERE workspace_id=? ORDER BY rowid", (workspace_id,)).fetchall()
    return [Subscription.model_validate(json.loads(row["data"])) for row in rows]


def enqueue(service_id: str, kind: str = "research"):
    with connect() as conn:
        conn.execute("INSERT OR IGNORE INTO jobs(service_id,kind) SELECT ?,? WHERE EXISTS (SELECT 1 FROM subscriptions WHERE id=?)", (service_id, kind, service_id))


def workspaces():
    with connect() as conn:
        return [dict(row) for row in conn.execute("SELECT * FROM workspaces ORDER BY rowid")]


def create_workspace(name: str):
    result = {"id": uuid4().hex, "name": name.strip()}
    with connect() as conn:
        conn.execute("INSERT INTO workspaces VALUES (?,?)", (result["id"], result["name"]))
    return result


def delete_workspace(workspace_id: str):
    with connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        for table in ("jobs", "sso_logs", "sso_apps"):
            conn.execute(f"DELETE FROM {table} WHERE service_id IN (SELECT id FROM subscriptions WHERE workspace_id=?)", (workspace_id,))
        conn.execute("DELETE FROM subscriptions WHERE workspace_id=?", (workspace_id,))
        conn.execute("DELETE FROM workspaces WHERE id=?", (workspace_id,))
        if not conn.execute("SELECT 1 FROM workspaces LIMIT 1").fetchone():
            conn.execute("INSERT INTO workspaces VALUES (?, 'My workspace')", (uuid4().hex,))
