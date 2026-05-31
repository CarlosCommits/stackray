# Stackray Architecture

## System overview

```text
Browser UI        Agent CLI
    |                |
    +------ HTTPS API Gateway ------+
                    |
          Railway App/API Service
                    |
            +-------+--------+
            |                |
      Railway Postgres  Railway Redis/BullMQ
            |                |
            +-------+--------+
                    |
          Railway Worker Service
                    |
                  httpx
```

## Service boundaries

### 1. App/API service

Responsibilities:

- Better Auth browser sessions and admin/user management
- scan submission
- history and search queries
- API key management
- SSE event fan-out from committed records
- Zod-backed validation at all HTTP boundaries

### 2. Worker service

Responsibilities:

- claim queued scans
- run `httpx`
- normalize raw `httpx` results into the Stackray worker envelope
- write `scan_attempts`, `scan_results`, and `scan_events`
- honor cancellation requests
- stay private on Railway and never act as a public HTTP surface

### 3. Postgres

Source of truth for:

- users and auth/session tables
- scan requests
- attempts
- results
- event history
- API keys

### 4. Redis/BullMQ

Used only for orchestration, not truth.

Queue messages contain:

- `scan_id`
- `attempt_number`
- lightweight execution metadata

Workers must reload the canonical scan definition from Postgres.

## Deployment notes

- deploy the app and worker as separate Railway services
- do not expose the worker service publicly
- enforce outbound egress policies if possible
- rate limit public scan creation endpoints
- keep raw response retention configurable globally or by future feature flag, not by tenant
- keep Postgres and Redis as Railway-managed services for the MVP
- use one public app domain for the browser UI, API, and SSE routes
- only add external object storage if retained artifacts become too large for Postgres-backed storage patterns

## Application contract choice

Stackray intentionally uses standard HTTP/JSON plus SSE instead of `tRPC` or `oRPC` in v1.

Reasons:

- the browser UI, agent CLI, and internal worker ecosystem all need a stable non-TypeScript-specific contract
- SSE is already a first-class transport for scan progress
- explicit route and event contracts are easier to debug across Railway services and background jobs

## Execution choice

### Preferred

Use the `httpx` binary with `-json` and parse JSONL output in the worker.

### Future option

Use `httpx` library integration if we later decide the tighter callback model is worth the operational coupling.

## Data flow

1. UI or CLI submits scan.
2. API normalizes targets and stores canonical request.
3. API validates the request with Zod and enqueues the `scan_id`.
4. Railway worker claims the job and creates an attempt.
5. Worker runs `httpx`, normalizes each result, and writes structured findings into Postgres.
6. API exposes persisted normalized results plus raw evidence to UI and CLI over HTTP/JSON + SSE.
7. Comparison and search operate over stored history.

## Security posture

- treat all scan input as untrusted
- default deny private IP and localhost targets
- make "scan private network" an explicit privileged policy later
- keep browser auth and user administration in Better Auth
- audit every scan request with actor and source metadata
