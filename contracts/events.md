# Stackray Events Contract

## Transport

Primary transport: Server-Sent Events

Endpoint:

`GET /api/v1/scans/:scanId/events`

## Rules

- events are emitted only after database commit
- clients may reconnect using `Last-Event-ID`
- event ids are monotonic per scan

## Event types

## `scan.status`

```json
{
  "scanId": "scn_01J...",
  "status": "running",
  "attemptId": "att_01J...",
  "at": "2026-03-23T12:00:00Z"
}
```

## `scan.progress`

```json
{
  "scanId": "scn_01J...",
  "resultCount": 1,
  "subdomainCount": 42,
  "at": "2026-03-23T12:00:02Z"
}
```

## `scan.result`

```json
{
  "scanId": "scn_01J...",
  "resultId": "res_01J...",
  "target": "https://primary.example.test",
  "statusCode": 200,
   "finalUrl": "https://primary.example.test",
   "title": "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
   "server": "Flywheel/5.1.0",
   "cdn": { "enabled": true, "name": "fastly", "type": "cdn" },
   "technologies": ["WordPress", "WooCommerce", "PHP"],
   "at": "2026-03-23T12:00:03Z"
}
```

## `scan.complete`

```json
{
  "scanId": "scn_01J...",
  "status": "completed",
  "resultCount": 1,
  "at": "2026-03-23T12:00:04Z"
}
```

## `scan.cancelled`

```json
{
  "scanId": "scn_01J...",
  "status": "cancelled",
  "at": "2026-03-23T12:00:04Z"
}
```

## `scan.failed`

```json
{
  "scanId": "scn_01J...",
  "status": "failed",
  "errorCode": "worker_execution_failed",
  "message": "The worker exited with an error.",
  "at": "2026-03-23T12:00:04Z"
}
```

## Event ordering

Expected order:

1. `scan.status`
2. zero or more `scan.progress`
3. zero or more `scan.result`
4. terminal event: `scan.complete`, `scan.failed`, or `scan.cancelled`

## Polling fallback

If SSE is unavailable, clients should poll:

- `GET /api/v1/scans/:scanId`
- `GET /api/v1/scans/:scanId/results`

For technology-focused integrations, clients can additionally call:

- `GET /api/v1/scans/:scanId/technologies`
- `GET /api/v1/scans/:scanId/results/:resultId/technologies`

The CLI and UI should use the same terminal-state rules.

Terminal states are `completed`, `failed`, and `cancelled`.
