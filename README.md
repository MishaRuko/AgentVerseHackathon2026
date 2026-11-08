# byebye.fyi

A subscription right-sizing workspace: import a spreadsheet, research public plans,
fill active-user gaps with a mock SSO connector, and review potential savings.

## Run with Docker

```bash
cp .env.example .env
docker compose up --build
```

Open **http://localhost:3000**. Use the workspace menu beside the logo to create,
switch or delete workspaces. Deletion requires confirmation and removes that
workspace's subscriptions, jobs and SSO logs without affecting other workspaces.
Deleting the last workspace leaves a fresh upload screen. Existing uploads are
migrated into the original workspace automatically.

Set `GEMINI_API_KEY` in `.env` to enable research and natural-language filters,
then recreate the API and worker:

```bash
docker compose up -d --force-recreate backend worker
```

The API, worker and Next.js frontend are separate containers. A named volume
persists SQLite subscription data, queued jobs, and synthetic SSO logs. Browser
requests use a same-origin proxy; the Gemini key never goes to the browser.
Docker publishes ports 3000 and 8000 on loopback only. No deployment has been made.

## Local development without Docker

Python 3.12+ and Node 22+ are recommended. From the repository root:

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
```

Run these in three terminals:

```bash
cd backend
../.venv/bin/python -m uvicorn app.main:app --reload --env-file ../.env
```

```bash
cd backend
../.venv/bin/python -m app.worker
```

```bash
cd frontend
npm ci
npm run dev
```

The API and worker load the root `.env` with priority over stale exported values.
Set `BYEBYE_LOAD_ENV=0` to use only process environment variables (used by tests).
The default database is `backend/data/byebye.db`.
Run exactly **one worker per database**. Interrupted jobs are recovered on startup.

## Spreadsheet format

CSV (UTF-8; comma, semicolon or tab separated) and XLSX (multiple sheets) are supported.
Only a subscription-name column is required. Common aliases are recognised, even
after introductory rows; unrecognised sheets and invalid rows produce warnings.
Arbitrary layouts are not guaranteed: rename headers using the sample below.

```csv
Service,Users,Monthly spend,Currency,Category,Period
Notion,42,950,GBP,Productivity,Monthly
Figma,12,720,GBP,Design,Monthly
JSTOR,,850,GBP,Research,Monthly
```

See `frontend/public/sample-subscriptions.csv`. `Users` means active people, not
purchased seats. Missing values stay unknown. Currency defaults to GBP; USD and
EUR are supported without implicit conversion. Annual spend is normalised to
monthly when `Period` is Annual/Yearly. Duplicate service names are skipped,
not overwritten. Limits: 10 files, 10 MB/file, 500 imported services per batch,
20 sheets/workbook, 50 MB expanded XLSX size. Rows/columns are bounded to
10,000/100 per sheet.

## Research and recommendations

- A bounded Gemini tool-calling agent can research public pricing, inspect the
  SSO index, count active users, and calculate a recommendation. Tool actions are
  checkpointed and visible in a subscription's activity log.
- Pricing research uses Gemini's Google Search grounding with vendor-source
  links. Web evidence is untrusted; the model is instructed not to invent prices.
  Extracted tiers are validated, but still need human verification.
- Deterministic capacity/price calculations constrain the final LLM explanation.
  Per-seat plans respect minimum seat purchases. Quote-only prices stay unknown;
  different currencies are never compared or summed together.
- If search times out, finds no prices, returns only quotes, or has no priced tier
  that covers the user count in the requested currency, the MVP uses a service/category
  baseline and volume bands. These estimates retain `estimated=true` internally and
  never receive invented source URLs. They are not vendor-verified prices.
- Without current spend, the recommended cost is shown without fabricated savings.
  Missing users can be entered manually or retrieved via mock SSO.
- Recommendations compare seats and public prices, **not feature equivalence**.
  Check academic eligibility, required features, tax, commitments, and cancellation
  costs before changing a contract. No subscriptions are changed automatically.
- Live research, AI filtering and agent execution require a Gemini key.
  `GEMINI_MODEL` defaults to `gemini-3.8-flash`; the previous 2.5 model is no longer
  available to new accounts. Provider authentication errors remain errors rather
  than being disguised as pricing-search failures.

## Mock SSO

The connector efficiently generates six months of synthetic login events for a
shared population of up to 7,000 numeric user identities, in batches of 5,000 rows.
Logs use `(service_id, user_id, logged_at, success)`; indexes support fast aggregate
queries. Generation is idempotent per service. Active usage is the distinct count
of successful logins in the last **three calendar months**, excluding future events.
Only aggregate results are sent to Gemini; raw logs stay local. This is not a real
SSO integration and synthetic counts should not inform actual purchases.

## Security and deployment boundary

This is a **multi-workspace prototype with no user accounts**, not a multi-tenant SaaS.
Workspace separation is for organisation, not per-user access control. Before exposing
it publicly, set a strong `APP_TOKEN`, configure HTTPS/nginx, request-body and rate
limits, backups, and appropriate access controls. Configure bearer-token forwarding
in an authenticated gateway/proxy before using a nonblank server token. There is no
user sign-in or connection form in the UI. Do not put tokens or keys in
`NEXT_PUBLIC_` variables. With a blank token, the local workspace is unauthenticated.
Provider usage has a per-job tool-call limit, not an account-wide spending cap;
configure billing alerts/quotas in Google Cloud before using real credits.

## Checks

```bash
cd backend
../.venv/bin/python -m pytest -q
```

```bash
cd frontend
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser test starts API, worker and frontend against a fresh temporary database;
ports 3001 and 8001 must be free. Screenshots/traces are written to ignored
`frontend/test-results/`. Python tests use isolated databases and no live AI calls.

To verify the ten-subscription fixture against the actual configured provider,
including SSO for the four missing counts and natural-language filtering:

```bash
.venv/bin/python backend/scripts/verify_csv.py
```

This consumes Gemini credits and uses an isolated temporary database, never the
interactive workspace. `frontend/public/test-subscriptions.csv` is downloadable
at `/test-subscriptions.csv`.
