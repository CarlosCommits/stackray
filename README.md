# Stackray

Stackray is a product blueprint for a BuiltWith-style site intelligence app powered by `httpx`.

The product serves two clients through one backend:

- a human-facing web UI for running scans, browsing history, and comparing changes
- an agent-friendly CLI/API for queueing scans, watching progress, and retrieving results

Core principles:

- one backend is the source of truth
- scans are asynchronous jobs
- results are persisted before they are streamed
- the UI and agent CLI read the same records
- `httpx` runs inside internal workers, not as a public internet-facing service

Docs in this folder:

- `CONTRIBUTING.md` - local development setup, Docker services, scripts, and schema-change workflow
- `docs/pages.md` - web UI page inventory and behavior
- `contracts/agent-cli.md` - agent CLI commands and interaction model
- `contracts/events.md` - event and streaming contract
- `docs/architecture.md` - deployment and service boundaries
- `docs/technology-detection.md` - scanner detection rules and update workflow
- `docs/nuclei-txt-record-fallback.md` - TXT record detection recovery behavior
- `docs/railway-template-readme.md` - Railway template copy
- `drizzle/schema.ts` - canonical Drizzle schema definition used by the application
- `lib/db/schema.ts` - app-facing re-export of the Drizzle schema

Suggested stack:

- frontend: Next.js App Router + TypeScript + Tailwind
- backend API: Next.js route handlers with plain HTTP/JSON + SSE
- validation: Zod for API payloads, SSE envelopes, queue payloads, env parsing, and auth inputs
- auth: Better Auth with a Drizzle adapter
- database ORM: Drizzle ORM + drizzle-kit
- jobs: Redis + BullMQ
- scanner workers: internal worker service that normalizes `httpx` results into a Stackray worker envelope; v1 should prefer CLI JSONL execution, with library mode reserved for future use if it becomes operationally beneficial
- database: PostgreSQL with JSONB and GIN indexes
- hosting: Railway for the app service, worker service, PostgreSQL, and Redis

Deliberate non-choices for v1:

- no `tRPC`
- no `oRPC`
- no GraphQL

Stackray's shared contract is standard HTTP + JSON + SSE because it must serve the web app, an agent CLI, and internal Go-based scanning components without forcing a TypeScript-only RPC layer.

Why `httpx` is the right engine:

- library integration with `RunEnumeration` and `OnResult` callback is documented in `httpx/examples/simple/main.go`
- rich result fields already exist in `httpx/runner/types.go`
- JSON and DB-oriented output already exist in `httpx/README.md`
- the repo warns against exposing `httpx` directly as a public service, so Stackray uses an internal worker model and normalizes `httpx` output before it ever reaches the API/UI
- `httpx` exposes much more than Wappalyzer-like tech detection, including redirects, headers, TLS certificate data, ASN, CDN/WAF, DNS records, favicon hashes, JARM, WordPress plugins/themes, and CPEs

Local development:

The recommended local setup keeps the Next.js dev server on the host and runs scan dependencies in Docker:

- Postgres stores app data and Graphile Worker jobs
- MinIO provides a local S3-compatible screenshot bucket
- the worker container provides `httpx`, `nuclei`, nuclei templates, and browser/screenshot Linux libraries

First install Docker Desktop with the WSL 2 backend. Then initialize the local environment:

```powershell
pnpm dev:init
```

This creates `.env.local` from `.env.local.example` if needed, starts Postgres and MinIO, applies database migrations, and creates a local admin user:

- email: `admin@stackray.local`
- password: `StackrayDev123!`

Run the local app and worker:

```powershell
pnpm dev:local
```

Useful local commands:

```powershell
pnpm dev:infra        # start Postgres, MinIO, and bucket initialization
pnpm dev:local:down   # stop local Docker services, keeping data volumes
pnpm dev:local:wipe   # stop local Docker services and delete local data volumes
pnpm dev:infra:logs   # follow local service logs
```

Local service URLs:

- `pnpm dev:local` prints the app, Postgres, MinIO API, and MinIO console URLs after it chooses available ports.
- The first local stack normally uses app `http://localhost:3000`, Postgres `127.0.0.1:5432`, MinIO API `127.0.0.1:9000`, and MinIO console `127.0.0.1:9001`.
- Parallel worktrees get separate Docker Compose projects, separate data volumes, and the next available host ports.
