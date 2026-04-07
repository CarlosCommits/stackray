# Stackray Routes

Base path: `/api/v1`

All endpoints return JSON except the SSE stream endpoint.

Note: this file documents API routes only. Canonical web UI routes such as `/dashboard`, `/runs`, `/targets`, and `/settings/...` are documented in `pages.md`.

## Auth model

- browser: Better Auth session cookie
- agent CLI: bearer token
- internal worker: service token or internal network auth

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
  "targets": ["https://tpss.coop"],
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
      "targetCount": 1,
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

### Response shape

```json
{
  "scanId": "scn_01J...",
  "status": "running",
  "source": "ui",
  "targets": [
    {
      "scanTargetId": "tgt_01J...",
      "inputTarget": "https://tpss.coop",
      "normalizedTarget": "https://tpss.coop"
    }
  ],
  "currentAttempt": {
    "attemptId": "att_01J...",
    "attemptNumber": 1,
    "status": "running"
  },
  "progress": {
    "processedTargets": 1,
    "totalTargets": 1,
    "resultCount": 1
  }
}
```

## 4. Cancel scan

**Status:** Planned contract

`POST /api/v1/scans/:scanId/cancel`

Marks the scan as cancellation requested. Worker checks for cancellation between batches or result flushes.

## 5. Get scan results

**Status:** Implemented

`GET /api/v1/scans/:scanId/results`

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
- supports either a Better Auth browser session or a bearer token

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

- current handler requires an app session via `requireAppSession()`; bearer-token CLI access is not implemented yet
- supports either a Better Auth browser session or a bearer token

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

## 10. Saved searches

**Status:** Implemented

`GET /api/v1/saved-searches`

`POST /api/v1/saved-searches`

`PATCH /api/v1/saved-searches/:savedSearchId`

`DELETE /api/v1/saved-searches/:savedSearchId`

These are user-scoped saved searches in the current single-tenant app.

## 11. User admin routes

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
    "requiresPasswordChange": true,
    "hasPassword": true,
    "lastLoginAt": null
  },
  "temporaryPassword": "generated-temp-password"
}
```

## 12. Change password

**Status:** Implemented

`POST /api/v1/auth/change-password`

Used to clear the forced-password-change flow after a temp password has been issued.

## 13. Tokens

**Status:** Implemented

`GET /api/v1/tokens`

`POST /api/v1/tokens`

`DELETE /api/v1/tokens/:tokenId`

These routes let an authenticated user create, list, and delete their own API tokens.

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
