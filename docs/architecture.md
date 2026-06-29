# Stackray Architecture

## System overview

```text
Browser UI        Agent CLI
    |                |
    +------ HTTPS API Gateway ------+
                    |
          Railway App/API Service
                    |
          +---------+----------+
          |                    |
    Railway Postgres     S3-compatible
    + Graphile Worker    object storage
          |                    |
          +---------+----------+
                    |
        Railway Worker Services
      http / intel / browser roles
                    |
       httpx, nuclei, subfinder
```

## Service boundaries

### 1. App/API service

Responsibilities:

- Better Auth browser sessions and admin/user management
- scan submission
- history and search queries
- API key management
- recurring scan schedule management
- SSE event fan-out from committed records
- Zod-backed validation at all HTTP boundaries
- screenshot and favicon proxy routes

### 2. Worker service

Responsibilities:

- claim Graphile Worker jobs
- run `httpx`, `nuclei`, `subfinder`, browser fallback, and IP intelligence phases
- normalize scanner output into persisted scan records
- write `scan_attempts`, `scan_phase_runs`, `scan_results`, `scan_events`, nuclei matches, detections, and schedule run state
- honor cancellation requests
- stay private on Railway and never act as a public HTTP surface

Worker roles are selected with `STACKRAY_WORKER_ROLE`:

- `http`: `http_probe` and legacy `run_scan`
- `browser`: `headless` and `browser_fallback`
- `intel`: `subfinder`, `nuclei_dns`, `nuclei_http`, `ip_intel`, `finalize`, and `schedule_due_scans`
- `all`: every task, mostly useful for simple deployments and local checks

### 3. Postgres and Graphile Worker

Source of truth for:

- users and auth/session tables
- scan requests
- attempts
- phase runs
- results
- event history
- API keys
- schedules and schedule dispatch history
- Graphile Worker jobs

Graphile Worker runs from the same Postgres database. Queue jobs are orchestration state, while scans, phases, results, schedules, and events remain the durable product records.

Queue messages contain lightweight identifiers such as:

- `scanId`
- `attemptId`
- `resultId`

Workers must reload the canonical scan definition from Postgres.

### 4. Object storage

Screenshots are stored outside Postgres in S3-compatible object storage. Local development uses MinIO; hosted deployments use Railway Object Storage or another S3-compatible bucket.

The database stores screenshot object keys and metadata. The app exposes authenticated screenshot routes that fetch from storage instead of exposing bucket URLs directly.

## Deployment notes

- deploy the app and worker as separate Railway services
- do not expose the worker service publicly
- split worker services by `STACKRAY_WORKER_ROLE` for production-like deployments
- enforce outbound egress policies if possible
- rate limit public scan creation endpoints
- keep Postgres as the database and Graphile Worker job store
- configure S3-compatible object storage for screenshots
- use one public app domain for the browser UI, API, and SSE routes

## Application contract choice

Stackray intentionally uses standard HTTP/JSON plus SSE instead of `tRPC` or `oRPC` in v1.

Reasons:

- the browser UI, agent CLI, and internal worker ecosystem all need a stable non-TypeScript-specific contract
- SSE is already a first-class transport for scan progress
- explicit route and event contracts are easier to debug across Railway services and Graphile Worker jobs

## Execution choice

### Scanner phases

Use scanner binaries from the worker image and persist each phase independently:

- `http_probe`: primary `httpx` probe and result selection
- `subfinder`: subdomain enrichment
- `headless`: runtime technology detection and screenshot capture
- `browser_fallback`: recovery pass for blocked or missing browser artifacts
- `nuclei_dns` and `nuclei_http`: DNS, SSL, RDAP, robots, and technology evidence
- `ip_intel`: IP and routing enrichment
- `finalize`: terminal scan status and aggregate events

## Data flow

1. UI or CLI submits scan.
2. API normalizes targets and stores canonical request.
3. API validates the request with Zod and enqueues a Graphile `http_probe` job.
4. The HTTP worker claims the job, creates an attempt, runs `httpx`, selects the authoritative result, and queues enrichment phases.
5. Browser and intelligence workers run their phase jobs and write structured findings, screenshots, detections, and events into Postgres.
6. Finalization marks the scan terminal only after persisted phase state has settled.
7. API exposes persisted normalized results plus raw evidence to UI and CLI over HTTP/JSON + SSE.
8. Comparison, targets, schedules, and search operate over stored history.

## Security posture

- treat all scan input as untrusted
- default deny private IP and localhost targets
- make "scan private network" an explicit privileged policy later
- keep browser auth and user administration in Better Auth
- audit every scan request with actor and source metadata
- keep product-resource routes on the shared session-or-bearer actor boundary
- keep account, API-key, user-management, and product-state routes session-only
