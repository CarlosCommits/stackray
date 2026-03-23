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

- `PRD.md` - product goals, personas, scope, success metrics
- `spec.md` - technical implementation blueprint
- `pages.md` - web UI page inventory and behavior
- `routes.md` - HTTP API contract and payload shapes
- `contracts/agent-cli.md` - agent CLI commands and interaction model
- `contracts/events.md` - event and streaming contract
- `docs/architecture.md` - deployment and service boundaries
- `db/schema.sql` - PostgreSQL schema for scans, results, history, and search

Suggested stack:

- frontend: Next.js App Router + TypeScript + Tailwind
- backend API: Next.js route handlers with plain HTTP/JSON + SSE
- validation: Zod for API payloads, SSE envelopes, queue payloads, env parsing, and auth inputs
- auth: Better Auth with a Drizzle adapter
- database ORM: Drizzle ORM + drizzle-kit
- jobs: Redis + BullMQ
- scanner workers: internal Go worker using `httpx` as a library first, CLI fallback if needed
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
- the repo warns against exposing `httpx` directly as a public service, so Stackray uses an internal worker model
