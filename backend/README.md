# byebye.fyi API and worker

Python FastAPI + SQLite WAL + Google GenAI SDK. See the root `README.md` for setup,
mock SSO semantics, input formats, tests and deployment boundaries.

Run `uvicorn app.main:app --port 8000` and `python -m app.worker` from this folder.
Both processes must use the same `DATABASE_PATH` and Gemini environment variables.
Only one worker may run against a database. It recovers running jobs after restart.
Open `/docs` for the generated OpenAPI schema.

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Unauthenticated liveness check |
| `GET /api/workspace` | Services, pending job count and configuration flags |
| `GET /api/workspaces` | List named workspaces |
| `POST /api/workspaces` | Create an empty workspace using `{name}` |
| `DELETE /api/workspaces/{id}` | Delete a workspace and its subscriptions, jobs and logs |
| `POST /api/upload` | Multipart `files`; parse, persist and enqueue research |
| `POST /api/demo` | Seed labelled demo data into an empty workspace |
| `POST /api/demo/clear` | Remove only demo fixtures; preserve uploaded subscriptions |
| `PATCH /api/services/{id}` | Set users/spend and enqueue analysis |
| `POST /api/services/{id}/sso` | Queue mock SSO retrieval and analysis |
| `POST /api/services/{id}/retry` | Retry research/analysis using retained tiers |
| `POST /api/enrich` | Batch missing-user retrieval and plan analysis |
| `POST /api/filter` | Gemini maps `{message}` to structured UI filters |

All `/api/` endpoints require `Authorization: Bearer <APP_TOKEN>` when configured.
Subscription endpoints use `X-Workspace-ID` to select the workspace (default: first
available workspace). Foreign-workspace service IDs return 404. Deletion cannot
be undone; in-flight worker saves cannot recreate a deleted workspace.
Busy services return 409 for edits/requeues. Jobs are persisted before the response,
so closing the browser does not interrupt execution. Service-level errors appear
on the card/detail view, not as invented research results.
