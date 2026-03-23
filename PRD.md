# Stackray PRD

## Product summary

Stackray is a web app and API for analyzing the visible technology, infrastructure, and product signals of a website. It presents `httpx` results in a polished UI, keeps a searchable historical record of every scan, and supports both human operators and AI agents through a shared backend.

## Problem

BuiltWith-like data is useful, but ad hoc command output is hard to search, compare over time, or share across humans and agents. `httpx` can detect a large amount of site metadata, but it needs a product layer for:

- readable presentation
- historical storage
- diffing and change tracking
- repeatable scan workflows
- agent-friendly automation

## Product goals

1. Let a user scan a single URL or domain and immediately understand what is powering it.
2. Preserve every scan as a historical snapshot that can be searched later.
3. Show differences between snapshots over time.
4. Let an AI agent or CLI queue scans and consume the same results the UI shows.
5. Keep the system safe by isolating scan execution from the public application tier.

## Platform assumptions

- the product is hosted on Railway
- the web app and scanner worker run as separate services
- PostgreSQL and Redis are Railway-managed in the MVP
- the shared product contract is HTTP/JSON + SSE, not TypeScript-only RPC

## Technology decisions for v1

- Next.js App Router for the web app
- Drizzle ORM for database access and migrations
- Zod for runtime validation and contract enforcement
- Better Auth for sessions and API token management
- BullMQ + Redis for scan orchestration
- no `tRPC` or `oRPC` in v1

## Non-goals

- internet-wide crawling or mass indexing in v1
- vulnerability scanning or exploit execution
- public anonymous scanning
- exposing `httpx` itself as a public raw service
- replacing all search engines with a custom Elasticsearch cluster in v1

## Personas

### 1. Researcher

Needs a fast answer to: what stack is this site using right now?

### 2. Operator

Needs history, comparisons, saved searches, and workspace-level visibility.

### 3. AI agent

Needs a deterministic way to submit a scan, wait for completion, fetch structured results, and know those same results appear in the web app.

## Primary use cases

1. Scan a target and view a technology card summary.
2. Search historical scans for sites using a given technology.
3. Compare a fresh scan to the last successful scan for the same target.
4. Let an agent queue a scan from a CLI and retrieve the final result programmatically.
5. Save useful filters such as "WordPress + WooCommerce" or "behind Fastly".

## User stories

- As a user, I can enter `https://example.com` and get a clean report of detected tech, infra, and product signals.
- As a user, I can reopen a prior scan and see exactly what changed.
- As a user, I can search all prior scans for a technology or title.
- As an agent, I can submit a scan and receive a `scan_id`.
- As an agent, I can watch progress or poll for completion.
- As an agent, I can fetch machine-readable results that match what humans see in the UI.

## Core features for v1

### Scanning

- single target scan by URL or hostname
- optional multi-target scan for uploaded lists
- configurable scan profile
- safe defaults based on `httpx` technology detection probes

### Results UI

- summary cards for technologies, CDN/WAF, title, server, favicon, JARM, and WordPress details
- normalized results table
- raw JSON panel for debugging

### History

- per-target scan history
- workspace-wide scan history
- diff between two scans

### Search

- search by target, title, server, CDN, technology, CPE, WordPress plugin, theme, or date range
- saved searches

### Agent and API support

- API token auth
- async scan submission
- streaming or polling for progress
- final results endpoint

## Success metrics

- median time from submit to first visible result under 5 seconds for common sites
- median time from submit to completed scan under 30 seconds for common sites
- at least 90 percent of completed scans stored successfully with searchable metadata
- at least 95 percent of agent-submitted scans visible in UI history within 2 seconds of completion

## Risks

- exposing scan execution too broadly can create abuse and SSRF risk
- storing too much raw response data can inflate cost and compliance scope
- tech detection changes over time, so snapshot fidelity must preserve raw outputs and schema versioning

## Release phases

### Phase 1

- auth
- scan submission
- scan history
- scan detail page
- search across results
- agent CLI support

### Phase 2

- comparisons and change feeds
- saved searches and alerts
- local registered worker mode for scans that must originate from a private network

### Phase 3

- bulk scanning workflows
- shared team annotations
- export pipelines and webhook automation
