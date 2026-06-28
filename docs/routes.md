# Stackray Routes

Base path: `/api/v1`

All endpoints return JSON except the SSE stream endpoint.

Note: this file documents API routes only. Canonical web UI routes such as `/dashboard`, `/runs`, `/targets`, and `/settings/...` are documented in `pages.md`.

## Auth model

- browser UI: Better Auth session cookie
- external automation/agent CLI: bearer API key
- internal worker: service token or internal network auth

Most product-resource routes accept either a Better Auth browser session cookie or an `Authorization: Bearer ...` API key. Account, admin, and API key management routes are intentionally session-only so bearer API keys cannot manage users, passwords, product state, or other bearer API keys.

### Auth modes by route family

| Route family | Auth mode | Notes |
| --- | --- | --- |
| `/scans`, `/scans/:scanId`, `/scans/:scanId/report`, `/scans/:scanId/results`, `/scans/:scanId/technologies`, `/scans/:scanId/events` | Browser session or bearer API key | Shared product API used by the UI and external automation. |
| `/runs` | Browser session or bearer API key | Lists visible scan runs for the actor. |
| `/targets/results`, `/targets/:canonicalTargetId/history`, `/targets/:canonicalTargetId/technologies` | Browser session or bearer API key | Reads target intelligence visible to the actor. |
| `/schedules`, `/schedules/:scheduleId` | Browser session or bearer API key | Manages scan schedules for the actor. |
| `/api-keys`, `/api-keys/:apiKeyId` | Browser session only | Bearer API keys cannot create, list, or revoke API keys. |
| `/settings/users`, `/settings/users/:userId`, `/settings/users/:userId/password` | Browser session only | Admin account-management surface. |
| `/auth/change-password`, `/me/product-state` | Browser session only | Session/user-experience state, not external API automation. |
| `/setup/bootstrap` | Bootstrap-only public guard | Only available while first-admin bootstrap is open. |

## Status legend

- **Implemented** — route exists and is wired in the current app
- **Partially implemented** — route exists but some surrounding product surface is still incomplete
- **Planned contract** — route is still part of the intended contract but does not exist yet

## 1. Create scan

**Status:** Implemented

`POST /api/v1/scans`

Returns `202 Accepted` for a newly queued scan.

### Request

```json
{
  "target": "https://tpss.coop",
  "options": {
    "followRedirects": true,
    "includeRawResponse": false,
    "headless": false
  },
  "idempotencyKey": "agent-run-001",
  "client": {
    "source": "cli"
  }
}
```

### Response

```json
{
  "scanId": "scn_01J...",
  "status": "queued",
  "reused": false
}
```

## 2. List scans

**Status:** Implemented

`GET /api/v1/scans`

### Query params

- `status`
- `source`
- `target`
- `limit`

### Response shape

```json
{
  "items": [
    {
      "scanId": "scn_01J...",
      "status": "completed",
      "source": "cli",
      "target": "https://tpss.coop",
      "submittedAt": "2026-03-23T12:00:00Z",
      "completedAt": "2026-03-23T12:00:12Z"
    }
  ],
  "nextCursor": null
}
```

## 3. Get scan

**Status:** Implemented

`GET /api/v1/scans/:scanId`

### Response fields

- scan metadata
- progress summary
- attempt summary
- aggregate result counts
- subdomain discovery summary

### Response shape

```json
{
  "scanId": "scn_01J...",
  "status": "running",
  "source": "ui",
  "target": {
    "inputTarget": "https://tpss.coop",
    "normalizedTarget": "https://tpss.coop",
    "canonicalTargetId": "ctg_01J..."
  },
  "currentAttempt": {
    "attemptId": "att_01J...",
    "attemptNumber": 1,
    "status": "running"
  },
  "progress": {
    "resultCount": 1,
    "subdomainCount": 42
  },
  "subdomains": {
    "state": "completed",
    "runId": "sdr_01J...",
    "targetDomain": "tpss.coop",
    "resultCount": 42,
    "engineVersion": null,
    "errorMessage": null,
    "startedAt": "2026-03-23T12:00:02Z",
    "completedAt": "2026-03-23T12:00:07Z"
  }
}
```

## 4. Get scan report

**Status:** Implemented

`GET /api/v1/scans/:scanId/report`

Returns the default agent-readable summary for a scan. This endpoint exposes Stackray's authoritative result, primary technologies, infrastructure summary, a bounded subdomain sample, and links to paginated evidence. Use this before paging through raw results.

### Response fields

- `scan`: same scan detail shape as `GET /api/v1/scans/:scanId`, plus `submittedAt` and `completedAt`
- `authoritativeResult`: the selected primary result row, or `null`
- `technologies`: all technology inventory items for the authoritative result
- `infrastructure`: DNS, ASN, TLS, capability, and IP intelligence summary from the authoritative result
- `subdomains`: summary plus a bounded sample; use the `next` link or `/subdomains` endpoint for the full list
- `links`: canonical follow-up endpoints for scan detail, results, technologies, subdomains, and events

### Response shape

```json
{
  "scan": {
    "scanId": "scn_01J...",
    "status": "completed",
    "source": "api",
    "target": {
      "inputTarget": "https://tpss.coop",
      "normalizedTarget": "tpss.coop",
      "canonicalTargetId": "ctg_01J..."
    },
    "currentAttempt": {
      "attemptId": "att_01J...",
      "attemptNumber": 1,
      "status": "completed",
      "requestProfile": "baseline",
      "fallbackReason": null,
      "resultCount": 1,
      "forbiddenResultCount": 0
    },
    "attemptHistory": [],
    "phases": [],
    "progress": {
      "resultCount": 1,
      "subdomainCount": 500
    },
    "subdomains": {
      "state": "completed",
      "runId": "sdr_01J...",
      "targetDomain": "tpss.coop",
      "resultCount": 500,
      "engineVersion": "subfinder-2.9.0",
      "errorMessage": null,
      "startedAt": "2026-03-23T12:00:02Z",
      "completedAt": "2026-03-23T12:00:07Z"
    },
    "submittedAt": "2026-03-23T12:00:00Z",
    "completedAt": "2026-03-23T12:00:12Z"
  },
  "authoritativeResult": {
    "resultId": "res_01J...",
    "url": "https://tpss.coop",
    "finalUrl": "https://tpss.coop",
    "title": "Takoma Park Silver Spring Co-op",
    "statusCode": 200,
    "server": "nginx",
    "cdn": {
      "enabled": true,
      "name": "cloudflare",
      "type": "cdn"
    },
    "screenshotUrl": "/api/v1/scans/scn_01J.../results/res_01J.../screenshot",
    "faviconUrl": "/api/v1/scans/scn_01J.../results/res_01J.../favicon"
  },
  "technologies": {
    "scope": "authoritative",
    "items": [],
    "total": 0
  },
  "infrastructure": {
    "dns": null,
    "asn": null,
    "tls": null,
    "capabilities": null,
    "ipIntelligence": null
  },
  "subdomains": {
    "summary": {
      "state": "completed",
      "runId": "sdr_01J...",
      "targetDomain": "tpss.coop",
      "resultCount": 500,
      "engineVersion": "subfinder-2.9.0",
      "errorMessage": null,
      "startedAt": "2026-03-23T12:00:02Z",
      "completedAt": "2026-03-23T12:00:07Z"
    },
    "sample": [],
    "total": 500,
    "truncated": true,
    "next": "/api/v1/scans/scn_01J.../subdomains?page=2&pageSize=50"
  },
  "links": {
    "scan": "/api/v1/scans/scn_01J...",
    "results": "/api/v1/scans/scn_01J.../results",
    "technologies": "/api/v1/scans/scn_01J.../technologies?scope=authoritative",
    "subdomains": "/api/v1/scans/scn_01J.../subdomains",
    "events": "/api/v1/scans/scn_01J.../events"
  }
}
```

## 5. Cancel scan

**Status:** Planned contract

`POST /api/v1/scans/:scanId/cancel`

Marks the scan as cancellation requested. Worker checks for cancellation between batches or result flushes.

## 6. Get scan results

**Status:** Implemented

`GET /api/v1/scans/:scanId/results`

This remains the full scan-result payload. For technology-only retrieval, prefer the dedicated endpoints below.

## 6.1 Get subdomains for a scan

**Status:** Implemented

`GET /api/v1/scans/:scanId/subdomains`

Returns Subfinder-validated subdomains for the latest scan attempt. The scan detail route exposes only a compact summary; use this endpoint for the paginated host list.

### Query params

- `page`
- `pageSize` (capped at 250)
- `host`
- `source`

### Response shape

```json
{
  "summary": {
    "state": "completed",
    "runId": "sdr_01J...",
    "targetDomain": "tpss.coop",
    "resultCount": 42,
    "engineVersion": null,
    "errorMessage": null,
    "startedAt": "2026-03-23T12:00:02Z",
    "completedAt": "2026-03-23T12:00:07Z"
  },
  "items": [
    {
      "subdomainId": "sub_01J...",
      "scanId": "scn_01J...",
      "host": "shop.tpss.coop",
      "rootDomain": "tpss.coop",
      "ip": "203.0.113.10",
      "source": "crtsh",
      "wildcardCertificate": false,
      "observedAt": "2026-03-23T12:00:05Z",
      "rawSubfinder": {}
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 42
}
```

## 6.2 Get technologies for a scan

**Status:** Implemented

`GET /api/v1/scans/:scanId/technologies`

Returns a flat list of canonical detection rows for the scan. Each item includes the scan/result IDs, detection kind and source, normalized name, enrichment metadata, and optional CPE fields.

### Query params

- `scope`: `authoritative`, `all-results`, or `result`; defaults to `all-results` for backwards compatibility. Use `authoritative` for the scan-detail primary technology set.
- `q`: search by technology name, normalized name, category, or CPE.
- `technology`: backwards-compatible alias for `q`.
- `source`: filter by source, such as `wappalyzer`, `wordpress`, `cpe`, or `nuclei`.
- `bucket`: filter by Stackray bucket, such as `platform`, `framework`, `infrastructure`, or `ecosystem`.
- `resultId`: required when `scope=result`.
- `page`: page number for `scope=all-results`.
- `pageSize`: page size for `scope=all-results`.
- `target`: filter result rows before aggregating technologies.
- `statusCode`: filter result rows before aggregating technologies.
- `includeIncomplete`: include results outside the latest completed attempt.

### Scope behavior

- `scope=authoritative`: non-paginated technology inventory for the authoritative result selected by Stackray.
- `scope=all-results`: paginated aggregate over matching latest-attempt result rows.
- `scope=result&resultId=res_...`: non-paginated technology inventory for one exact result row.

## 6.3 Get technologies for a scan result

**Status:** Implemented

`GET /api/v1/scans/:scanId/results/:resultId/technologies`

Returns the flat list of canonical detection rows for one exact persisted result row.

## 6.4 Get technologies for a target

**Status:** Implemented

`GET /api/v1/targets/:canonicalTargetId/technologies`

Returns the latest flat technology inventory for the canonical target, or a specific historical scan when `scanId` is supplied as a query param.

### Query params

- `page`
- `pageSize`
- `target`
- `technology`
- `statusCode`
- `includeRaw`
- `includeIncomplete`

### Response shape

```json
{
  "items": [
    {
      "resultId": "res_01J...",
      "target": "https://tpss.coop",
      "input": "https://tpss.coop",
      "url": "https://tpss.coop",
      "finalUrl": "https://tpss.coop",
      "path": "/",
      "method": "GET",
      "title": "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      "statusCode": 200,
      "server": "Flywheel/5.1.0",
      "location": null,
      "contentType": "text/html; charset=UTF-8",
      "contentLength": 12345,
      "responseTimeMs": 187,
      "cdn": {
        "enabled": true,
        "name": "fastly",
        "type": "cdn"
      },
      "dns": {
        "hostIp": "104.18.7.192",
        "a": ["104.18.7.192"],
        "aaaa": [],
        "cname": [],
        "resolvers": ["1.1.1.1:53"]
      },
      "asn": {
        "asNumber": "13335",
        "org": "Cloudflare, Inc."
      },
      "tls": {
        "sni": "tpss.coop",
        "jarmHash": "...",
        "certificate": {}
      },
      "technologies": ["WordPress", "WooCommerce", "PHP"],
      "wordpress": {
        "plugins": ["jetpack"],
        "themes": ["pro"]
      },
      "cpe": [],
      "favicon": {
        "mmh3": "1494302000",
        "md5": "...",
        "url": "https://tpss.coop/favicon.ico",
        "path": "/favicon.ico"
      },
      "hashes": {
        "md5": "...",
        "mmh3": "...",
        "sha256": "..."
      },
      "capabilities": {
        "http2": true,
        "pipeline": false,
        "websocket": false,
        "vhost": false
      },
      "redirectChain": {
        "statusCodes": [301, 200],
        "items": []
      },
      "bodyPreview": "...",
      "bodyDomains": [],
      "bodyFqdns": [],
      "rawHttpx": {}
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

By default this route returns rows from the final selected attempt only. `includeIncomplete=true` is reserved for privileged diagnostic use.

The route should expose a normalized result summary first and keep the full raw `httpx` result attached under `rawHttpx` for evidence/debugging.

## 6. Stream scan events

**Status:** Implemented

`GET /api/v1/scans/:scanId/events`

Content type: `text/event-stream`

Event types are documented in `contracts/events.md` / `lib/contracts/events.ts`.

## 7. Compare scans

**Status:** Planned contract

`GET /api/v1/scans/:scanId/compare/:baselineScanId`

Returns a normalized diff response.

### Response shape

```json
{
  "scanId": "scn_new",
  "baselineScanId": "scn_old",
  "summary": {
    "addedTechnologies": 2,
    "removedTechnologies": 1,
    "changedTargets": 1
  },
  "changes": {
    "technologiesAdded": ["WooCommerce"],
    "technologiesRemoved": ["Jetpack"],
    "metadata": [
      {
        "field": "webServer",
        "before": "nginx",
        "after": "Flywheel/5.1.0"
      }
    ]
  }
}
```

## 8. Target results

**Status:** Implemented

`GET /api/v1/targets/results`

### Query params

- `q`
- `technology`
- `cdn`
- `server`
- `plugin`
- `theme`
- `cpe`
- `statusCode`
- `from`
- `to`
- `cursor`
- `limit`

### Semantics

- returns the latest successful result per canonical target
- supports either a Better Auth browser session or a bearer API key

### Response shape

```json
{
  "items": [
    {
      "canonicalTargetId": "ctg_01J...",
      "normalizedTarget": "https://tpss.coop",
      "latestScanId": "scn_01J...",
      "title": "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      "technologies": ["WordPress", "WooCommerce", "PHP"],
      "lastScannedAt": "2026-03-23T12:00:12Z",
      "faviconUrl": "https://tpss.coop/favicon.ico"
    }
  ],
  "nextCursor": null
}
```

## 9. Target history

**Status:** Implemented

`GET /api/v1/targets/:canonicalTargetId/history`

Returns scan history for one canonical target.

- supports either a Better Auth browser session or a bearer API key

### Response shape

```json
{
  "canonicalTargetId": "ctg_01J...",
  "normalizedTarget": "https://tpss.coop",
  "items": [
    {
      "scanId": "scn_01J...",
      "status": "completed",
      "title": "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      "technologies": ["WordPress", "WooCommerce", "PHP"],
      "submittedAt": "2026-03-23T11:59:58Z",
      "completedAt": "2026-03-23T12:00:12Z"
    }
  ]
}
```

## 10. User admin routes

**Status:** Implemented

`GET /api/v1/settings/users`

`POST /api/v1/settings/users`

`PATCH /api/v1/settings/users/:userId`

`DELETE /api/v1/settings/users/:userId`

`POST /api/v1/settings/users/:userId/password`

These routes are admin-only and operate against the single-tenant Better Auth user model.

### Create user request

```json
{
  "email": "viewer@example.com",
  "displayName": "Viewer User",
  "role": "viewer",
  "apiKeyAccessEnabled": false,
  "deliveryMode": "temp-password"
}
```

### Create user response

```json
{
  "user": {
    "userId": "usr_01J...",
    "email": "viewer@example.com",
    "displayName": "Viewer User",
    "role": "viewer",
    "isActive": true,
    "apiKeyAccessEnabled": false,
    "requiresPasswordChange": true,
    "hasPassword": true,
    "lastLoginAt": null
  },
  "temporaryPassword": "generated-temp-password"
}
```

### Update user request

```json
{
  "email": "viewer@example.com",
  "displayName": "Viewer User",
  "role": "user",
  "apiKeyAccessEnabled": true
}
```

Admins always retain API key access. Sending `"role": "admin"` forces `apiKeyAccessEnabled` to `true`.

## 11. Change password

**Status:** Implemented

`POST /api/v1/auth/change-password`

Used to clear the forced-password-change flow after a temp password has been issued.

## 12. API keys

**Status:** Implemented

`GET /api/v1/api-keys`

`POST /api/v1/api-keys`

`DELETE /api/v1/api-keys/:apiKeyId`

These routes let an authenticated user create, list, and revoke their own API keys.

## Better Auth routes

**Status:** Implemented

The application also exposes Better Auth at:

- `GET|POST /api/auth/[...all]`

Important browser auth flows currently in use:

- `/api/auth/sign-in/email`
- `/api/auth/sign-out`
- `/api/auth/get-session`
- `/api/auth/request-password-reset`
- `/api/auth/reset-password`

## Error shape

```json
{
  "error": {
    "code": "invalid_target",
    "message": "One or more targets could not be normalized.",
    "details": {}
  }
}
```
