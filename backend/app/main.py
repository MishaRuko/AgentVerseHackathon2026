import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import agent, db, demo
from .importer import parse_file
from .models import EditSubscription


@asynccontextmanager
async def lifespan(app):
    if os.getenv("BYEBYE_LOAD_ENV", "1") != "0":
        load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=True)
    db.init()
    yield


def auth(request: Request):
    token = os.getenv("APP_TOKEN", "")
    if token and not secrets.compare_digest(request.headers.get("authorization", ""), f"Bearer {token}"):
        raise HTTPException(401, "Workspace token required")


app = FastAPI(title="byebye.fyi", lifespan=lifespan)
app.add_middleware(CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Content-Type", "Authorization", "X-Workspace-ID"])


def scope(request: Request):
    workspaces = db.workspaces()
    workspace_id = request.headers.get("X-Workspace-ID", workspaces[0]["id"])
    if not any(w["id"] == workspace_id for w in workspaces):
        raise HTTPException(404, "Workspace not found")
    return workspace_id


class WorkspaceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80, pattern=r".*\S.*")


@app.get("/api/workspaces", dependencies=[Depends(auth)])
def list_workspaces():
    return db.workspaces()


@app.post("/api/workspaces", dependencies=[Depends(auth)])
def create_workspace(data: WorkspaceRequest):
    return db.create_workspace(data.name)


@app.delete("/api/workspaces/{workspace_id}", dependencies=[Depends(auth)])
def delete_workspace(workspace_id: str):
    if not any(w["id"] == workspace_id for w in db.workspaces()):
        raise HTTPException(404, "Workspace not found")
    db.delete_workspace(workspace_id)
    return {"ok": True}


@app.middleware("http")
async def private_responses(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/workspace", dependencies=[Depends(auth)])
def workspace(workspace_id: str = Depends(scope)):
    with db.connect() as conn:
        pending = conn.execute("SELECT COUNT(*) FROM jobs j JOIN subscriptions s ON j.service_id=s.id WHERE s.workspace_id=? AND j.status IN ('running','queued')", (workspace_id,)).fetchone()[0]
    return {"id": workspace_id, "workspaces": db.workspaces(), "services": db.all_services(workspace_id), "pending_jobs": pending,
            "ai_configured": bool(os.getenv("GEMINI_API_KEY")), "sso_mode": "mock"}


@app.post("/api/upload", dependencies=[Depends(auth)])
async def upload(files: list[UploadFile] = File(...), workspace_id: str = Depends(scope)):
    if len(files) > 10:
        raise HTTPException(400, "Upload at most 10 files at a time")
    services, warnings = [], []
    for file in files:
        data = await file.read(10 * 1024 * 1024 + 1)
        if len(data) > 10 * 1024 * 1024:
            raise HTTPException(413, "Each file must be under 10 MB")
        try:
            parsed, notes = parse_file(file.filename or "", data)
        except Exception as exc:
            raise HTTPException(400, f"Could not parse {file.filename}: {exc}") from exc
        services.extend(parsed)
        warnings.extend(notes)
    if not services:
        raise HTTPException(400, "No services found. " + " ".join(warnings))
    if len(services) > 500:
        raise HTTPException(400, "Upload at most 500 services per batch")
    # Skip identical vendor names rather than silently replacing existing workspace data.
    existing = {s.name.casefold() for s in db.all_services(workspace_id)}
    added = 0
    for service in services:
        if service.name.casefold() in existing:
            warnings.append(f"Skipped duplicate: {service.name}")
            continue
        existing.add(service.name.casefold())
        service.workspace_id = workspace_id
        db.save(service)
        db.enqueue(service.id)
        added += 1
    return {"imported": added, "warnings": warnings}


@app.post("/api/demo", dependencies=[Depends(auth)])
def load_demo(workspace_id: str = Depends(scope)):
    if db.all_services(workspace_id):
        raise HTTPException(409, "Demo can only be loaded into an empty workspace")
    demo.seed(workspace_id)
    return {"ok": True}


@app.post("/api/demo/clear", dependencies=[Depends(auth)])
def clear_demo(workspace_id: str = Depends(scope)):
    """Remove only explicitly labelled fixtures, never uploaded subscriptions."""
    with db.connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        ids = [row["id"] for row in conn.execute(
            "SELECT id FROM subscriptions WHERE workspace_id=? AND json_extract(data, '$.demo')=1", (workspace_id,)).fetchall()]
        for service_id in ids:
            if conn.execute("SELECT 1 FROM jobs WHERE service_id=? AND status='running'", (service_id,)).fetchone():
                raise HTTPException(409, "Wait until demo analysis completes before leaving the demo")
        for service_id in ids:
            conn.execute("DELETE FROM jobs WHERE service_id=?", (service_id,))
            conn.execute("DELETE FROM sso_logs WHERE service_id=?", (service_id,))
            conn.execute("DELETE FROM sso_apps WHERE service_id=?", (service_id,))
            conn.execute("DELETE FROM subscriptions WHERE id=?", (service_id,))
    return {"ok": True}


def find(service_id, workspace_id):
    service = db.get(service_id)
    if service is None or service.workspace_id != workspace_id:
        raise HTTPException(404, "Subscription not found")
    return service


def queue(service, kind):
    with db.connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        if not conn.execute("SELECT 1 FROM subscriptions WHERE id=?", (service.id,)).fetchone():
            raise HTTPException(404, "Subscription no longer exists")
        busy = conn.execute("SELECT 1 FROM jobs WHERE service_id=? AND status IN ('running','queued')", (service.id,)).fetchone()
        if busy:
            raise HTTPException(409, "This subscription is already being processed")
        service.status = "queued"
        service.error = None
        conn.execute("UPDATE subscriptions SET data=? WHERE id=?", (service.model_dump_json(), service.id))
        conn.execute("INSERT INTO jobs(service_id,kind) VALUES (?,?)", (service.id, kind))


@app.post("/api/services/{service_id}/sso", dependencies=[Depends(auth)])
def get_sso(service_id: str, workspace_id: str = Depends(scope)):
    queue(find(service_id, workspace_id), "sso")
    return {"ok": True}


@app.post("/api/services/{service_id}/retry", dependencies=[Depends(auth)])
def retry(service_id: str, workspace_id: str = Depends(scope)):
    queue(find(service_id, workspace_id), "research")
    return {"ok": True}


@app.patch("/api/services/{service_id}", dependencies=[Depends(auth)])
def edit(service_id: str, data: EditSubscription, workspace_id: str = Depends(scope)):
    service = find(service_id, workspace_id)
    with db.connect() as conn:
        if conn.execute("SELECT 1 FROM jobs WHERE service_id=? AND status IN ('running','queued')", (service_id,)).fetchone():
            raise HTTPException(409, "Wait until analysis completes before editing")
    for key in data.model_fields_set:
        setattr(service, key, getattr(data, key))
    if "users" in data.model_fields_set:
        service.user_source = "Manual" if data.users is not None else None
    queue(service, "research")
    return {"ok": True}


@app.post("/api/enrich", dependencies=[Depends(auth)])
def enrich(workspace_id: str = Depends(scope)):
    queued = 0
    for service in db.all_services(workspace_id):
        try:
            queue(service, "sso" if service.users is None else "research")
            queued += 1
        except HTTPException as exc:
            if exc.status_code != 409:
                raise
    return {"queued": queued}


class FilterRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


@app.post("/api/filter", dependencies=[Depends(auth)])
def filters(data: FilterRequest, workspace_id: str = Depends(scope)):
    try:
        return agent.natural_filter(data.message, sorted({s.category for s in db.all_services(workspace_id)}))
    except Exception as exc:
        raise HTTPException(503, str(exc)[:400]) from exc
