# byebye.fyi API and worker

Python FastAPI + SQLite WAL + Google GenAI SDK. See the root `README.md` for setup,
mock SSO semantics, input formats, tests and deployment boundaries.

Run `uvicorn app.main:app --port 8000` and `python -m app.worker` from this folder.
Both processes must use the same `DATABASE_PATH` and Gemini environment variables.
Only one worker coordinator may run against a database. It dispatches six jobs in
parallel by default (`WORKER_CONCURRENCY`, max 16), serialises jobs for the same
service, and recovers running jobs after restart.
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
| `POST /api/services/{id}/retry` | Fresh pricing/metadata research and analysis |
| `POST /api/enrich` | Fill remaining gaps; `{force:true}` refreshes everything |
| `POST /api/filter` | Gemini maps `{message}` to structured UI filters |

All `/api/` endpoints require `Authorization: Bearer <APP_TOKEN>` when configured.
Subscription endpoints use `X-Workspace-ID` to select the workspace (default: first
available workspace). Foreign-workspace service IDs return 404. Deletion cannot
be undone; in-flight worker saves cannot recreate a deleted workspace.
Busy services return 409 for edits/requeues. Jobs are persisted before the response,
so closing the browser does not interrupt execution. Service-level errors appear
on the card/detail view, not as invented research results.

Tier `billing_period` is `monthly`, `annual`, or `unspecified`; `monthly_price` is
always a monthly equivalent. Each service's `recommendations` has one best fit per
eligible billing period, including `tier_index`, `monthly_cost`, `annual_cost`,
`monthly_savings`, and `annual_savings`. Annual totals use unrounded prices, not
rounded monthly display values. Aggregate card savings use the best overall offer.
Metadata fields are `category`, `description`, `tags`, `website`, and
`metadata_researched_at`; `analysed_at` records the last completed comparison.

`/api/filter` also returns optional `min_users`, `max_users`, `min_spend`,
`max_spend`, `min_savings`, `user_source`, and `currency`. All monetary filters use
monthly amounts in the selected currency. `/api/enrich` returns
`{queued:0, already_analysed:true}` instead of silently repeating completed work.
