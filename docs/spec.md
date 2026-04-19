# Stackray Technical Spec

## 1. Overview

Stackray is a control plane and presentation layer around `httpx`.

The system has five logical parts:

1. web application
2. public API
3. queue and job orchestration
4. internal scanner workers
5. PostgreSQL persistence and search

The public app never calls `httpx` directly. The app writes a canonical scan request to the database, enqueues the `scan_id`, and an internal worker executes the scan.

## 2. Why this shape

This design matches `httpx`'s strengths and constraints:

- `httpx` can run as a library using `RunEnumeration` and `OnResult`
- `httpx` already exposes a rich `Result` struct with tech, CDN, WordPress, CPE, favicon, title, and more
- `httpx` warns that running it directly as a public service is risky
- `httpx` CLI JSONL and library mode both derive from the same `Result` model, so Stackray can standardize a single worker envelope even if the execution engine changes later

## 3. Recommended stack

V1 stack decisions are intentionally conservative.

- host the app, worker, Postgres, and Redis on Railway
- use Drizzle as the only ORM and migration tool
- use Zod at every runtime boundary
- use standard HTTP/JSON + SSE as the application contract
- do not use `tRPC` or `oRPC` in v1

### Frontend

- Next.js App Router
- TypeScript
- Tailwind CSS
- Server Components for data-heavy pages
- client components only for live updates, filters, and scan submission UX
- React Hook Form for scan forms and settings forms

### Backend

- Next.js route handlers on Railway
- plain HTTP/JSON endpoints plus explicit SSE endpoints
- Zod for request validation, response envelopes, SSE event payloads, queue payloads, and environment parsing
- Postgres access through Drizzle
- Better Auth for browser sessions and token issuance

Why not `tRPC` or `oRPC` for v1:

- the public contract must work equally well for the web app, agent CLI, and Go-based worker components
- SSE and REST-like routes are already the natural shape of the product
- adding an RPC abstraction now would create another layer without removing the need for explicit HTTP and event contracts

### Jobs

- Redis
- BullMQ

### Workers

- internal worker service that normalizes `httpx` output into a Stackray worker envelope
- v1 execution mode: spawn the `httpx` CLI and parse JSONL output
- future option: library integration via `github.com/projectdiscovery/httpx/runner` if operationally justified

### Storage

- PostgreSQL for canonical records and search
- object storage later for oversized raw artifacts if needed

### Hosting

- Railway web service for the Next.js app and API routes
- Railway worker service for scan orchestration and `httpx` execution
- Railway PostgreSQL for relational data
- Railway Redis for BullMQ
- optional external object storage later if raw artifacts outgrow Postgres comfort

## 4. Domain model

### User

Authenticated application user managed by Better Auth.

### Role

Global single-tenant role on `users.role`:

- `admin`
- `user`
- `viewer`

### Scan

User-visible job record. Represents a single requested run with immutable request parameters.

### ScanAttempt

Internal execution attempt for retry handling. One scan may have multiple attempts.

### ScanTarget

Normalized target belonging to a scan. A single scan may include one or many targets.

### ScanResult

One persisted result row per target observation.

### ScanEvent

Append-only event log used for SSE streaming, troubleshooting, and replay.

## 5. Scan lifecycle

States:

- `pending`
- `queued`
- `running`
- `processing`
- `completed`
- `failed`
- `cancelled`

Transitions:

1. client submits scan request
2. backend validates input and computes request fingerprint
3. backend inserts one `scans` row for one target
4. backend enqueues `scan_id`
5. worker claims job and creates `scan_attempt`
6. worker streams `httpx` findings into `scan_results`
7. worker emits `scan_events`
8. backend/UI/CLI consume stored results and events

## 6. Shared backend contract for UI and agents

The UI and agent CLI use the same API surface.

The CLI should never maintain its own result store.

Flow:

1. `POST /api/v1/scans`
2. receive `scan_id`
3. stream events from `/api/v1/scans/:scanId/events` or poll `/api/v1/scans/:scanId`
4. fetch final data from `/api/v1/scans/:scanId/results`

When an integration only needs technology inventory rather than full result detail, it should use:

- `/api/v1/scans/:scanId/technologies`
- `/api/v1/scans/:scanId/results/:resultId/technologies`
- `/api/v1/targets/:canonicalTargetId/technologies`

This ensures agent-triggered scans appear in the UI automatically.

## 6.1 Route model

- `/` is the public landing page
- `/sign-in`, `/forgot-password`, `/reset-password`, and `/change-password` are the public auth pages
- authenticated pages are organized in Next.js route groups such as `(public)` and `(authenticated)`
- `/dashboard` is the authenticated home page
- authenticated product pages use clean top-level paths like `/runs`, `/targets`, `/scans/...`, and `/settings/...`
- scan runs and cross-result search are separate destinations because they serve different user intents

## 7. Idempotency

`POST /api/v1/scans` accepts an optional `idempotency_key`.

The backend also computes a `request_fingerprint` from:

- authenticated actor
- normalized target
- normalized scan profile
- normalized options

Idempotency policy:

- automatic fingerprint dedupe applies only to active scans in `pending`, `queued`, `running`, or `processing`
- completed, failed, and cancelled scans always remain in history and do not block intentional rescans
- `idempotency_key` is treated as a client-supplied dedupe hint for request replay protection, not a forever-unique business identifier

## 8. Scan profile

V1 uses one authoritative default profile rather than multiple named profiles.

### `stack-deep`

- this is the default and only first-class scan profile in v1
- the API and UI may still expose advanced toggles later, but they all resolve into this one baseline profile plus explicit option overrides
- `-td`
- `-title`
- `-sc`
- `-cl`
- `-ct`
- `-rt`
- `-location`
- `-server`
- `-wp`
- `-cpe`
- `-favicon`
- `-jarm`
- `-cdn`
- `-ip`
- `-cname`
- `-asn`
- `-tls-grab`
- `-csp-probe`
- `-hash md5,mmh3,sha256`
- `-extract-fqdn`
- `-include-chain`
- `-json`
- `-fr`

The backend stores resolved normalized options on every scan.

Note: `httpx` docs explicitly call out `-favicon` as a probe to use for specific use cases rather than as a general default, but Stackray intentionally chooses the richer profile as its default product behavior because the additional OSINT and fingerprint signals are useful enough to justify the wider probe set.

## 8.1 What Stackray actually probes for

Stackray is no longer just a Wappalyzer-style wrapper. For each site, the worker should attempt to collect:

- technologies (`tech`), WordPress themes/plugins, and CPEs when enabled
- status code, redirect location, final URL, title, server banner, content type, content length, response time, and body preview
- CDN/WAF identity, DNS/IP/CNAME/ASN signals, TLS certificate payload, SNI, and JARM
- favicon hashes, selected content hashes, and redirect-chain details
- optional body-derived FQDN/domain extraction and CSP-derived domains in deep mode

See `docs/httpx-worker-contract.md` for the full probe-to-product mapping.

## 9. Data storage rules

- `scans` are immutable in request shape after creation
- `scan_attempts` are append-only per retry
- `scan_results` are append-only observations
- `scan_events` are append-only
- derived comparison records may be regenerated

## 9.1 Attempt visibility rules

- during an active scan, the scan detail page may show partial rows from the current attempt
- after a scan reaches a terminal state, default user-facing routes return rows from the final selected attempt only
- workspace history and cross-target search default to completed scans only
- incomplete attempt rows remain stored for diagnostics but are excluded from default search/runs views unless explicitly requested

## 10. Search strategy

V1 uses PostgreSQL only.

Searchable dimensions:

- target
- final URL
- redirect location
- host
- host IP
- ASN
- title
- server
- CDN name/type
- JARM hash
- favicon hashes
- technology name
- WordPress plugin/theme
- CPE vendor/product
- date range
- scan status

## 11. UI data strategy

- Server Components should load initial scan details, history, and search pages
- use parallel server fetches to avoid waterfalls
- use SSE for live progress and new results
- keep client state minimal and derived from server data where possible
- avoid introducing a general RPC client layer in v1; fetch from route handlers directly

## 12. Security rules

- never expose raw worker execution publicly
- validate targets and block private IPs/localhost unless explicitly allowed later by privileged policy
- rate limit scan creation per user and token
- store audit metadata for every scan request
- redact sensitive response data by default
- treat `include raw response` as privileged functionality gated by scope and explicit request flags

## 13. Worker execution model

### Preferred for v1

Run the `httpx` CLI with JSONL output and normalize each emitted `runner.Result` into a Stackray worker envelope.

Benefits:

- aligns with `httpx`'s CLI-first design and service-safety warning
- preserves process isolation for each scan execution
- still yields the full `runner.Result` field set because JSONL is serialized from the same result model

### Future option

Switch the worker implementation to `httpx` library callbacks (`OnResult`) if we later decide the tighter in-process model is worth the added coupling.

Benefits:

- tighter callback-level control
- less subprocess overhead

Tradeoff:

- more operational coupling to `httpx` internals and fewer process-isolation benefits

## 13.1 Worker return model

The Stackray worker should return a normalized envelope with three layers:

1. worker metadata (`engine`, `engineVersion`, `executionMode`, `profile`)
2. scan/attempt identity (`scanId`, `attemptId`, `target`)
3. normalized observation plus the attached raw `httpx` result object

That envelope is documented in `docs/httpx-worker-contract.md` and should be treated as the stable contract regardless of whether the worker uses CLI JSONL or library callbacks.

## 14. Diffing model

Each new completed scan may be compared to the most recent successful scan for the same canonical target.

Diff categories:

- added technologies
- removed technologies
- changed title
- changed server
- changed CDN/WAF
- added or removed WordPress plugins/themes
- changed CPEs

## 15. Observability

- store worker id on attempts
- store queue timestamps, start time, completion time, and error code
- emit structured logs with `scan_id` and `attempt_id`
- show user-facing duration, queue wait, and result count in UI

## 16. Railway deployment assumptions

- keep the Next.js app and the Go worker as separate Railway services
- app service is the only public entrypoint
- worker service is private/internal and only consumes queue jobs plus database state
- use Railway-managed Postgres and Redis for the MVP
- treat SSE as an app-service concern and avoid proxying it through the worker

## 17. MVP delivery order

1. Better Auth login and admin-managed users
2. scan submission API
3. queue + worker
4. scan detail page
5. history page
6. targets page
7. agent CLI
8. diffing
