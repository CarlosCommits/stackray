# Agent API Report Plan

## Goal

Make the bearer-token API usable by an AI agent without the web UI.

The agent should be able to answer questions like:

- What was the latest completed scan for `vercel.com`?
- What did Stackray detect on the primary page?
- Which technologies were detected, including Wappalyzer, WordPress, CPE, nuclei, and DNS-promoted services?
- What is the metadata for a specific technology such as Next.js?
- Where can the agent fetch full paginated evidence when a summary is not enough?

The API should expose Stackray's product opinion directly. Agents should not have to reconstruct scan-detail page logic, choose the best `resultId` by hand, or page through raw scan results just to answer common questions.

## Concepts to Clarify

### `scanId`

`scanId` identifies the top-level scan job/run requested by a user or API client.

Example: "Scan `vercel.com`."

### `resultId`

`resultId` identifies one observed result inside a scan.

A scan can produce multiple results because Stackray may observe redirects, alternate URLs, subdomains, retries, or browser/runtime fallback results.

Example result rows for one scan:

- `https://vercel.com`
- `https://www.vercel.com`
- `https://vercel.com/docs`
- discovered subdomain result rows

### Authoritative Result

The authoritative result is the single result Stackray selects as the best representation of the primary scanned target.

This is the result the scan-detail page uses for its main overview and technology section. The API should expose this selection directly so agents do not have to duplicate ranking logic.

## Proposed Endpoint

### `GET /api/v1/scans/:scanId/report`

Returns a bounded, agent-friendly report for one scan.

This endpoint should use bearer API key or browser session auth via the shared product-resource auth boundary.

The response should be a stable API contract, not a direct dump of React view-model props. It can reuse scan-detail server services internally, but the public shape should be designed for agents and scripts.

## Default Response Shape

```json
{
  "scan": {
    "scanId": "scn_...",
    "status": "completed",
    "source": "api",
    "target": {
      "inputTarget": "vercel.com",
      "normalizedTarget": "vercel.com",
      "canonicalTargetId": "ctg_..."
    },
    "submittedAt": "2026-06-27T12:00:00.000Z",
    "completedAt": "2026-06-27T12:01:00.000Z",
    "currentAttempt": {},
    "progress": {
      "resultCount": 1,
      "subdomainCount": 500
    }
  },
  "authoritativeResult": {
    "resultId": "res_...",
    "url": "https://vercel.com",
    "finalUrl": "https://vercel.com",
    "title": "Vercel",
    "statusCode": 200,
    "server": "Vercel",
    "cdn": {},
    "screenshotUrl": "/api/v1/scans/scn_.../results/res_.../screenshot",
    "faviconUrl": "/api/v1/scans/scn_.../results/res_.../favicon"
  },
  "technologies": {
    "scope": "authoritative",
    "total": 12,
    "items": []
  },
  "infrastructure": {
    "dns": {},
    "asn": {},
    "tls": {},
    "capabilities": {}
  },
  "subdomains": {
    "summary": {
      "state": "completed",
      "targetDomain": "vercel.com",
      "resultCount": 500,
      "errorMessage": null
    },
    "sample": [],
    "total": 500,
    "truncated": true,
    "next": "/api/v1/scans/scn_.../subdomains?page=2&pageSize=50"
  },
  "links": {
    "scan": "/api/v1/scans/scn_...",
    "results": "/api/v1/scans/scn_.../results",
    "technologies": "/api/v1/scans/scn_.../technologies?scope=authoritative",
    "subdomains": "/api/v1/scans/scn_.../subdomains",
    "events": "/api/v1/scans/scn_.../events"
  }
}
```

## Bounded Output Rules

The report endpoint must be safe to call from agents by default. It should not emit every row and every raw evidence blob.

| Section | Default behavior |
| --- | --- |
| Scan metadata | Always included |
| Authoritative result summary | Always included when available |
| Authoritative technologies | Include all by default |
| Infrastructure summary | Included, bounded |
| Subdomains | Include summary plus a small sample |
| Full subdomain list | Paginated through `/subdomains` |
| Full result list | Linked through `/results` |
| Raw HTTP evidence | Excluded by default |
| Nuclei findings | Summarized or linked by default |
| Screenshots and favicons | URL links only |

Recommended default caps:

| Data | Default cap | Hard cap |
| --- | ---: | ---: |
| Subdomain sample | 50 | 250 |
| Result sample, if added later | 10 | 100 |
| Nuclei finding sample, if added later | 25 | 100 |

If a scan finds 500 subdomains, the report should include:

- summary count: `500`
- first sample page, for example 50 items
- `truncated: true`
- a `next` URL to continue through `GET /api/v1/scans/:scanId/subdomains`

The report should not support unbounded `includeAll=true` behavior.

## Optional Expansions

The endpoint may support explicit includes with hard caps:

```txt
GET /api/v1/scans/:scanId/report?include=subdomains&subdomainLimit=100
GET /api/v1/scans/:scanId/report?include=nucleiFindings
GET /api/v1/scans/:scanId/report?include=rawEvidence
```

Rules:

- Expansions must be opt-in.
- Expansions must still be capped.
- Raw evidence should remain off by default.
- If an expansion is truncated, the response should say so and provide the canonical paginated endpoint.

## Technologies Contract

### `GET /api/v1/scans/:scanId/technologies`

Clarify and extend the existing endpoint so agents can fetch technologies without paging through raw results.

Recommended query parameters:

| Query | Meaning |
| --- | --- |
| `scope=authoritative` | Technologies shown for the authoritative scan result. This should match the scan-detail page technology section. |
| `scope=all-results` | Technologies across all latest-attempt result rows. Paginated. |
| `scope=result&resultId=res_...` | Technologies for a specific result. |
| `q=Next.js` or `technology=Next.js` | Search by technology name, normalized name, category, or CPE. |
| `source=wappalyzer` | Filter by source. |
| `bucket=framework` | Filter by Stackray technology bucket. |
| `includeEvidence=true` | Include result URLs, result IDs, and source-specific evidence references. |

Default recommendation:

- `scope=authoritative` should be the default for agents and docs.
- `scope=authoritative` should be non-paginated because the authoritative technology set should be small.
- `scope=all-results` should remain paginated because subdomain-heavy scans can produce many duplicate detections.

## Required Technology Sources

`scope=authoritative` must include every technology source represented in the scan-detail page technology section:

- Wappalyzer detections
- WordPress plugins and themes
- CPE-promoted technologies
- Nuclei technology matches
- DNS service technologies promoted from nuclei DNS findings, if they are treated as technology signals in the UI

Each item should keep source attribution.

Example:

```json
{
  "displayName": "Next.js",
  "normalizedName": "nextjs",
  "sources": ["wappalyzer", "cpe"],
  "version": null,
  "description": "Next.js is a React framework...",
  "website": "https://nextjs.org",
  "iconUrl": "https://...",
  "categories": ["Web frameworks", "JavaScript frameworks"],
  "primaryCategory": "Web frameworks",
  "bucket": "framework",
  "cpe": "cpe:2.3:a:vercel:next.js:*:*:*:*:*:*:*:*",
  "evidence": [
    {
      "kind": "result",
      "resultId": "res_...",
      "url": "https://vercel.com",
      "source": "wappalyzer"
    }
  ]
}
```

DNS-promoted service example:

```json
{
  "displayName": "Amazon Route 53",
  "normalizedName": "amazonroute53",
  "sources": ["nuclei", "dns_service"],
  "version": null,
  "description": "Amazon Route 53 is AWS's scalable domain name system...",
  "website": "https://aws.amazon.com/route53/",
  "categories": ["DNS"],
  "bucket": "infrastructure",
  "evidence": [
    {
      "kind": "dns_service",
      "subject": "vercel.com",
      "matchedAt": "2026-06-27T12:00:00.000Z"
    }
  ]
}
```

## Implementation Plan

1. Add contract schemas under `lib/contracts/scans.ts` or a new `lib/contracts/scan-report.ts`.
2. Add a shared server service that builds the authoritative scan report data.
3. Reuse existing scan-detail logic where appropriate:
   - `getScanRecord`
   - `getScanDetail`
   - `getAuthoritativeScanResult`
   - `getTargetHistoryForScan`
   - `getScanSubdomains`
   - technology metadata helpers
4. Extract or create a reusable authoritative technology builder.
5. Ensure this builder includes Wappalyzer, WordPress, CPE, nuclei, and DNS-promoted service signals.
6. Add `GET /api/v1/scans/:scanId/report`.
7. Extend `GET /api/v1/scans/:scanId/technologies` with `scope=authoritative`.
8. Keep `scope=all-results` paginated.
9. Update API docs content shown under `/settings/api-docs`.
10. Update `docs/routes.md` after implementation.
11. Add unit tests for:
    - report auth boundary
    - bounded subdomain sample
    - authoritative result selection
    - authoritative technology parity
    - DNS-promoted technology inclusion
    - `q` and `source` filtering

## Public API Cleanup Plan

Do not delete UI/internal endpoints as part of this work. Some routes are useful implementation details for the web app, but they should not all be presented as the public bearer-token contract.

The cleanup should focus on what `/settings/api-docs` presents as the supported public API for agents and automation.

### Keep as Public Agent API

| Endpoint | Public status | Notes |
| --- | --- | --- |
| `POST /api/v1/scans` | Keep | Starts a scan. |
| `GET /api/v1/scans` | Keep | Lists and searches scans; can support latest-scan agent workflows. |
| `GET /api/v1/scans/:scanId` | Keep | Basic scan status, attempts, phases, and progress. |
| `GET /api/v1/scans/:scanId/report` | Add | Primary agent-friendly scan detail endpoint. |
| `GET /api/v1/scans/:scanId/events` | Keep | SSE progress stream. |
| `GET /api/v1/scans/:scanId/results` | Keep, advanced | Paginated result rows and detailed evidence. |
| `GET /api/v1/scans/:scanId/subdomains` | Keep | Paginated large collection. |
| `GET /api/v1/scans/:scanId/technologies` | Keep and clarify | Add authoritative scope and source filtering. |
| `GET /api/v1/scans/:scanId/results/:resultId/technologies` | Keep, advanced | Useful for result-level inspection, but not a primary agent workflow. |
| `GET /api/v1/scans/:scanId/results/:resultId/screenshot` | Keep | Media link used by reports and integrations. |
| `GET /api/v1/scans/:scanId/results/:resultId/favicon` | Keep | Media link used by reports and integrations. |
| `GET /api/v1/runs` | Keep or de-emphasize | Keep if it remains meaningfully different from `GET /scans`; otherwise make it secondary. |
| `GET /api/v1/targets/results` | Keep, secondary | Useful historical target intelligence. |
| `GET /api/v1/targets/:canonicalTargetId/history` | Keep, secondary | Useful after a scan/report references a canonical target. |
| `GET /api/v1/targets/:canonicalTargetId/technologies` | Keep, secondary | Target-level technology history. |
| `GET/POST/PATCH/DELETE /api/v1/schedules` | Keep | Agents may manage recurring scan work. |

### Remove from Public API Docs

These routes may continue to exist for the UI, but `/settings/api-docs` should not present them as supported public agent endpoints:

| Endpoint | Docs action | Reason |
| --- | --- | --- |
| `GET /api/v1/dashboard/recent-scans` | Remove from public docs | Dashboard-specific helper; agents can use `GET /scans`. |
| `GET /api/v1/targets/filter-options` | Remove from public docs | UI filter dropdown helper. |
| `GET /api/v1/targets/technology-options` | Remove from public docs | Technology compare picker helper. |
| `GET /api/v1/targets/technology-comparison` | Remove unless explicitly productized | UI comparison surface, not a core agent primitive today. |
| `GET /api/v1/image-proxy` | Remove from public docs | Utility proxy, not product data. |
| `GET/POST/DELETE /api/v1/api-keys` | Mention only as session-only management | API keys cannot manage API keys; this belongs in account docs, not bearer-token workflow docs. |
| `/api/v1/settings/users/*` | Exclude from agent docs | Session-only admin UI. |
| `/api/v1/me/product-state` | Exclude from agent docs | Session-only UI state. |
| `/api/v1/auth/change-password` | Exclude from agent docs | Session-only account route. |

### Endpoint Deletion Guidance

Do not delete public API endpoints until the new report and technology contracts exist and clients have a replacement path.

Potential future deprecations should be evaluated after implementation:

- If `GET /api/v1/runs` duplicates `GET /api/v1/scans`, either clarify the distinction or de-emphasize one in docs.
- If result-level technologies are fully covered by `GET /scans/:scanId/technologies?scope=result&resultId=...`, consider whether the nested `results/:resultId/technologies` route remains necessary.
- Do not remove paginated lower-level endpoints such as `results`, `subdomains`, or `technologies`; these are the necessary escape hatches behind the bounded report.

## `/settings/api-docs` Cleanup Plan

The API docs should become a concise agent/automation guide, not a complete web-app route list.

Recommended structure:

1. Authentication with bearer API keys.
2. Common agent workflows:
   - create a scan
   - stream or poll until completion
   - fetch the scan report
   - query authoritative technologies
   - page through subdomains or raw results when needed
3. Public endpoint reference.
4. Pagination, errors, and rate-limit notes.
5. Session-only account/API-key management note.

### Examples Policy

Use curl as the default and primary example format.

Remove repeated JavaScript and Python examples from individual endpoint sections unless the project later ships SDKs or separate cookbook pages.

Rationale:

- curl shows the canonical method, URL, headers, and JSON payload with minimal noise.
- Agents and humans can translate curl into their runtime of choice.
- Repeated language snippets make the page longer and easier to let drift.
- A single top-level JavaScript fetch quickstart is acceptable, but per-endpoint docs should stay curl-first.

Each endpoint section should include:

- purpose
- auth mode
- method and path
- query parameters
- request body, when relevant
- response shape
- one curl example

## Open Design Questions

- Should `GET /api/v1/scans/:scanId/report` include target history by default, or only link to it?
- Should nuclei security findings be summarized in the default report, or remain a separate expansion?
- Should `scope=authoritative` replace the current default for `/technologies`, or should it be explicit for backward compatibility?
- Should the report include an LLM-oriented `summary` string, or should it remain structured JSON only?
- Should API keys eventually get explicit scopes, for example `scans:read`, `scans:write`, and `schedules:manage`, instead of inheriting user permissions wholesale?

## Recommended Defaults

- Keep the report structured JSON only.
- Make `scope=authoritative` explicit in docs.
- Do not include full raw evidence in the default report.
- Include all authoritative technologies without pagination.
- Include subdomain summary plus a sample only.
- Provide `links` for every larger collection an agent may need to page through.
