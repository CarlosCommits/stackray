# Stackray Routes

Base path: `/api/v1`

All endpoints return JSON except the SSE stream endpoint.

Note: this file documents API routes only. Canonical web UI routes such as `/dashboard`, `/history`, `/search`, and `/settings/...` are documented in `pages.md`.

## Auth model

- browser: session cookie
- agent CLI: bearer token
- internal worker: service token or internal network auth

## 1. Create scan

`POST /api/v1/scans`

Returns `202 Accepted` for a newly queued scan.

### Request

```json
{
  "targets": ["https://primary.example.test"],
  "profile": "stack-default",
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

`GET /api/v1/scans`

### Query params

- `status`
- `source`
- `profile`
- `target`
- `cursor`
- `limit`

### Response shape

```json
{
  "items": [
    {
      "scanId": "scn_01J...",
      "status": "completed",
      "profile": "stack-default",
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
  "profile": "stack-default",
  "source": "ui",
  "targets": [
    {
      "scanTargetId": "tgt_01J...",
      "inputTarget": "https://primary.example.test",
      "normalizedTarget": "https://primary.example.test"
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

`POST /api/v1/scans/:scanId/cancel`

Marks the scan as cancellation requested. Worker checks for cancellation between batches or result flushes.

## 5. Get scan results

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
      "target": "https://primary.example.test",
      "url": "https://primary.example.test",
      "title": "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      "statusCode": 200,
      "server": "Flywheel/5.1.0",
      "cdn": {
        "enabled": true,
        "name": "fastly",
        "type": "cdn"
      },
      "technologies": ["WordPress", "WooCommerce", "PHP"],
      "wordpress": {
        "plugins": ["jetpack"],
        "themes": ["pro"]
      },
      "cpe": []
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

By default this route returns rows from the final selected attempt only. `includeIncomplete=true` is reserved for privileged diagnostic use.

## 6. Stream scan events

`GET /api/v1/scans/:scanId/events`

Content type: `text/event-stream`

Event types are documented in `contracts/events.md`.

## 7. Compare scans

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

## 8. Search results across history

`GET /api/v1/search/results`

### Query params

- `q`
- `technology`
- `cdn`
- `server`
- `plugin`
- `theme`
- `cpe`
- `from`
- `to`
- `cursor`
- `limit`
- `mode`

### Semantics

- default `mode=latest` returns the latest successful result per canonical target
- `mode=snapshots` returns every matching historical snapshot

### Response shape

```json
{
  "items": [
    {
      "canonicalTargetId": "ctg_01J...",
      "normalizedTarget": "https://primary.example.test",
      "latestScanId": "scn_01J...",
      "title": "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      "technologies": ["WordPress", "WooCommerce", "PHP"],
      "lastScannedAt": "2026-03-23T12:00:12Z"
    }
  ],
  "nextCursor": null
}
```

## 9. Target timeline

`GET /api/v1/targets/:targetId/history`

Returns scan history for one canonical target.

### Response shape

```json
{
  "canonicalTargetId": "ctg_01J...",
  "normalizedTarget": "https://primary.example.test",
  "items": [
    {
      "scanId": "scn_01J...",
      "status": "completed",
      "title": "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      "technologies": ["WordPress", "WooCommerce", "PHP"],
      "completedAt": "2026-03-23T12:00:12Z"
    }
  ]
}
```

## 10. Saved searches

`GET /api/v1/saved-searches`

`POST /api/v1/saved-searches`

`PATCH /api/v1/saved-searches/:savedSearchId`

`DELETE /api/v1/saved-searches/:savedSearchId`

## 11. Tokens

`GET /api/v1/tokens`

`POST /api/v1/tokens`

`DELETE /api/v1/tokens/:tokenId`

## 12. Worker claim route (optional future)

`POST /api/v1/internal/work-claims`

Only needed if a local trusted CLI or remote registered worker will pull jobs from the central backend.

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
