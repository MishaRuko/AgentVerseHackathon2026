import os
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import agent, db, demo
from .importer import parse_file
from .models import EditSubscription


@asynccontextmanager
async def lifespan(app):
    db.init()
    yield


def auth(request: Request):
    token = os.getenv("APP_TOKEN", "")
    if token and not secrets.compare_digest(request.headers.get("authorization", ""), f"Bearer {token}"):
        raise HTTPException(401, "Workspace token required")


app = FastAPI(title="byebye.fyi", lifespan=lifespan)
app.add_middleware(CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET", "POST", "PATCH"], allow_headers=["Content-Type", "Authorization"])


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
def workspace():
    with db.connect() as conn:
        pending = conn.execute("SELECT COUNT(*) FROM jobs WHERE status IN ('running','queued')").fetchone()[0]
    return {"services": db.all_services(), "pending_jobs": pending,
            "ai_configured": bool(os.getenv("GEMINI_API_KEY")), "sso_mode": "mock"}


@app.post("/api/upload", dependencies=[Depends(auth)])
async def upload(files: list[UploadFile] = File(...)):
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
    existing = {s.name.casefold() for s in db.all_services()}
    added = 0
    for service in services:
        if service.name.casefold() in existing:
            warnings.append(f"Skipped duplicate: {service.name}")
            continue
        existing.add(service.name.casefold())
        db.save(service)
        db.enqueue(service.id)
        added += 1
    return {"imported": added, "warnings": warnings}


@app.post("/api/demo", dependencies=[Depends(auth)])
def load_demo():
    if db.all_services():
        raise HTTPException(409, "Demo can only be loaded into an empty workspace")
    demo.seed()
    return {"ok": True}


@app.post("/api/demo/clear", dependencies=[Depends(auth)])
def clear_demo():
    """Remove only explicitly labelled fixtures, never uploaded subscriptions."""
    with db.connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        ids = [row["id"] for row in conn.execute(
            "SELECT id FROM subscriptions WHERE json_extract(data, '$.demo')=1").fetchall()]
        for service_id in ids:
            if conn.execute("SELECT 1 FROM jobs WHERE service_id=? AND status='running'", (service_id,)).fetchone():
                raise HTTPException(409, "Wait until demo analysis completes before leaving the demo")
        for service_id in ids:
            conn.execute("DELETE FROM jobs WHERE service_id=?", (service_id,))
            conn.execute("DELETE FROM sso_logs WHERE service_id=?", (service_id,))
            conn.execute("DELETE FROM sso_apps WHERE service_id=?", (service_id,))
            conn.execute("DELETE FROM subscriptions WHERE id=?", (service_id,))
    return {"ok": True}


def find(service_id):
    service = db.get(service_id)
    if service is None:
        raise HTTPException(404, "Subscription not found")
    return service


def queue(service, kind):
    with db.connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        busy = conn.execute("SELECT 1 FROM jobs WHERE service_id=? AND status IN ('running','queued')", (service.id,)).fetchone()
        if busy:
            raise HTTPException(409, "This subscription is already being processed")
        service.status = "queued"
        service.error = None
        conn.execute("UPDATE subscriptions SET data=? WHERE id=?", (service.model_dump_json(), service.id))
        conn.execute("INSERT INTO jobs(service_id,kind) VALUES (?,?)", (service.id, kind))


@app.post("/api/services/{service_id}/sso", dependencies=[Depends(auth)])
def get_sso(service_id: str):
    queue(find(service_id), "sso")
    return {"ok": True}


@app.post("/api/services/{service_id}/retry", dependencies=[Depends(auth)])
def retry(service_id: str):
    queue(find(service_id), "research")
    return {"ok": True}


@app.patch("/api/services/{service_id}", dependencies=[Depends(auth)])
def edit(service_id: str, data: EditSubscription):
    service = find(service_id)
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
def enrich():
    queued = 0
    for service in db.all_services():
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
def filters(data: FilterRequest):
    try:
        return agent.natural_filter(data.message, sorted({s.category for s in db.all_services()}))
    except Exception as exc:
        raise HTTPException(503, str(exc)[:400]) from exc
