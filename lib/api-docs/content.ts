export interface TocItem {
  id: string
  label: string
}

export interface IntroSection {
  kind: "intro"
  id: string
  title: string
  description: string
  basePath: string
  primaryAuth: string
  streaming: string
}

export interface QuickStartSection {
  kind: "quick-start"
  id: string
  title: string
  description: string
  steps: string[]
  example: string
}

export interface AuthMode {
  title: string
  description: string
  example: string
}

export interface AuthenticationSection {
  kind: "authentication"
  id: string
  title: string
  description: string
  modes: AuthMode[]
}

export interface EndpointSection {
  kind: "endpoint"
  id: string
  title: string
  description: string
  method: string
  path: string
  curlExample: string
  jsExample: string
  pythonExample: string
  responseExample: string
  notes: string[]
  isSSE?: boolean
}

export interface TokenEndpoint {
  method: string
  path: string
  description: string
  responseExample: string
}

export interface TokenManagementSection {
  kind: "token-management"
  id: string
  title: string
  description: string
  endpoints: TokenEndpoint[]
  note: string
}

export interface ErrorCodeEntry {
  code: string
  description: string
}

export interface ErrorHandlingSection {
  kind: "error-handling"
  id: string
  title: string
  sampleError: string
  codes: ErrorCodeEntry[]
}

export interface TokenAccessDisabledSection {
  kind: "token-access-disabled"
  title: string
  description: string
}

export type ApiDocsSection =
  | IntroSection
  | QuickStartSection
  | AuthenticationSection
  | EndpointSection
  | TokenManagementSection
  | ErrorHandlingSection
  | TokenAccessDisabledSection

export interface ApiDocsContent {
  tocItems: TocItem[]
  sections: ApiDocsSection[]
  tokensEnabled: boolean
}

function buildEndpointSection(
  id: string,
  title: string,
  description: string,
  method: string,
  path: string,
  curlExample: string,
  jsExample: string,
  pythonExample: string,
  responseExample: string,
  notes: string[],
  isSSE = false,
): EndpointSection {
  return {
    kind: "endpoint",
    id,
    title,
    description,
    method,
    path,
    curlExample,
    jsExample,
    pythonExample,
    responseExample,
    notes,
    isSSE,
  }
}

function deriveTocItems(sections: ApiDocsSection[]): TocItem[] {
  return sections.flatMap((section) => {
    switch (section.kind) {
      case "intro":
      case "quick-start":
      case "authentication":
      case "endpoint":
      case "token-management":
      case "error-handling":
        return [{ id: section.id, label: section.title }]
      default:
        return []
    }
  })
}

export function buildApiDocsContent(tokensEnabled: boolean, publicOrigin = "https://your-stackray-instance.com"): ApiDocsContent {
  const baseUrl = publicOrigin.replace(/\/$/, "")
  const sections: ApiDocsSection[] = [
    {
      kind: "intro",
      id: "api-docs",
      title: "API docs",
      description:
        "Use Stackray's shared HTTP API to submit scans, watch progress, fetch results, and query stored history from scripts, services, and agents.",
      basePath: "/api/v1",
      primaryAuth: "Bearer token",
      streaming: "SSE events",
    },
    {
      kind: "quick-start",
      id: "quick-start",
      title: "Quick start",
      description: "Start here if you just created a token and want to verify that your integration works.",
      steps: [
        "Create a token in `/settings/tokens`.",
        "Set your base URL and token in your shell or runtime environment.",
        "Call a read endpoint like `GET /runs` first, then move on to scan submission.",
      ],
      example: `export STACKRAY_BASE_URL="${baseUrl}"
export STACKRAY_TOKEN="sr_live_your_token_here"

curl "$STACKRAY_BASE_URL/api/v1/runs?limit=5" \
  -H "Authorization: Bearer $STACKRAY_TOKEN"`,
    },
    {
      kind: "authentication",
      id: "authentication",
      title: "Authentication modes",
      description: "Most product API endpoints accept bearer tokens. Token-management endpoints remain session-authenticated.",
      modes: [
        {
          title: "Bearer token",
          description: "Use this for scans, runs, targets, results, and scan-event streaming.",
          example: `Authorization: Bearer sr_live_your_token_here`,
        },
        {
          title: "Browser session",
          description: "Use this for creating, listing, and deleting tokens in the authenticated web app.",
          example: `/api/v1/tokens

Use the web app at /settings/tokens or pass your session cookie.`,
        },
      ],
    },
    buildEndpointSection(
      "submit-scan",
      "Submit a scan",
      "Queue a new scan and get a scan ID back immediately.",
      "POST",
      "/scans",
      `curl -X POST "$STACKRAY_BASE_URL/api/v1/scans" \
  -H "Authorization: Bearer $STACKRAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targets": ["https://example.com"],
    "options": {
      "followRedirects": true,
      "includeRawResponse": false,
      "headless": false
    },
    "client": { "source": "api" }
  }'`,
      `const response = await fetch('${baseUrl}/api/v1/scans', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer sr_live_your_token_here',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    targets: ['https://example.com'],
    options: {
      followRedirects: true,
      includeRawResponse: false,
      headless: false,
    },
    client: { source: 'api' },
  }),
});

const { scanId, status, reused } = await response.json();`,
      `import httpx

response = httpx.post(
    '${baseUrl}/api/v1/scans',
    headers={
        'Authorization': 'Bearer sr_live_your_token_here',
        'Content-Type': 'application/json',
    },
    json={
        'targets': ['https://example.com'],
        'options': {
            'followRedirects': True,
            'includeRawResponse': False,
            'headless': False,
        },
        'client': {'source': 'api'},
    },
)

data = response.json()
scan_id = data['scanId']`,
      `{
  "scanId": "scn_01J...",
  "status": "queued",
  "reused": false
}`,
      [
        "Returns scanId, status, and reused immediately.",
        "Use idempotencyKey when you want replay protection for automation.",
      ],
    ),
    buildEndpointSection(
      "watch-progress",
      "Watch progress",
      "Stream live scan updates with Server-Sent Events or fall back to polling.",
      "GET",
      "/scans/:scanId/events",
      `curl -N "$STACKRAY_BASE_URL/api/v1/scans/scn_01J.../events" \
  -H "Authorization: Bearer $STACKRAY_TOKEN"`,
      `const response = await fetch(
  '${baseUrl}/api/v1/scans/scn_01J.../events',
  {
    headers: {
      Authorization: 'Bearer sr_live_your_token_here',
    },
  }
);

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (reader) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(decoder.decode(value, { stream: true }));
}`,
      `import json
import httpx
import sseclient

with httpx.stream(
    'GET',
    '${baseUrl}/api/v1/scans/scn_01J.../events',
    headers={'Authorization': 'Bearer sr_live_your_token_here'},
) as response:
    client = sseclient.SSEClient(response)
    for event in client.events():
        payload = json.loads(event.data)
        print(event.event, payload)
        if event.event in {'scan.complete', 'scan.failed', 'scan.cancelled'}:
            break`,
      `event: scan.status
data: {"scanId":"scn_01J...","status":"running","attemptId":"att_01J...","at":"2026-03-23T12:00:00Z"}

event: scan.progress
data: {"scanId":"scn_01J...","processedTargets":1,"totalTargets":3,"resultCount":1,"at":"2026-03-23T12:00:02Z"}

event: scan.result
data: {"scanId":"scn_01J...","resultId":"res_01J...","target":"https://example.com","statusCode":200,"finalUrl":"https://example.com","title":"Example Site","server":"nginx","cdn":{"enabled":true,"name":"cloudflare","type":"cdn"},"technologies":["WordPress","PHP"],"at":"2026-03-23T12:00:03Z"}

event: scan.complete
data: {"scanId":"scn_01J...","status":"completed","resultCount":1,"at":"2026-03-23T12:00:04Z"}`,
      [
        "Native browser EventSource does not let you send an Authorization header.",
        "For browser apps, use a proxy or poll GET /scans/:scanId and GET /scans/:scanId/results instead.",
        "Event types include scan.status, scan.progress, scan.result, scan.complete, scan.failed, and scan.cancelled.",
      ],
      true,
    ),
    buildEndpointSection(
      "fetch-results",
      "Fetch results",
      "Retrieve paginated scan results and filter them by target, technology, and HTTP status.",
      "GET",
      "/scans/:scanId/results",
      `curl "$STACKRAY_BASE_URL/api/v1/scans/scn_01J.../results?page=1&pageSize=20" \
  -H "Authorization: Bearer $STACKRAY_TOKEN"`,
      `const params = new URLSearchParams({
  page: '1',
  pageSize: '20',
  technology: 'wordpress',
});

const response = await fetch(
  '${baseUrl}/api/v1/scans/scn_01J.../results?' + params,
  {
    headers: { Authorization: 'Bearer sr_live_your_token_here' },
  }
);

const { items, total } = await response.json();`,
      `import httpx

response = httpx.get(
    '${baseUrl}/api/v1/scans/scn_01J.../results',
    params={'page': 1, 'pageSize': 20, 'technology': 'wordpress'},
    headers={'Authorization': 'Bearer sr_live_your_token_here'},
)

data = response.json()
items = data['items']`,
      `{
  "items": [
    {
      "resultId": "res_01J...",
      "target": "https://example.com",
      "input": "https://example.com",
      "url": "https://example.com",
      "finalUrl": "https://example.com",
      "path": "/",
      "method": "GET",
      "title": "Example Site",
      "statusCode": 200,
      "server": "nginx/1.24.0",
      "contentType": "text/html; charset=UTF-8",
      "contentLength": 12345,
      "responseTimeMs": 187,
      "cdn": { "enabled": true, "name": "cloudflare", "type": "cdn" },
      "dns": {
        "hostIp": "104.21.0.1",
        "a": ["104.21.0.1"],
        "aaaa": [],
        "cname": [],
        "resolvers": ["1.1.1.1:53"]
      },
      "asn": { "asNumber": "13335", "org": "Cloudflare, Inc." },
      "technologies": ["WordPress", "PHP"],
      "wordpress": { "plugins": ["jetpack"], "themes": [] },
      "cpe": [],
      "favicon": { "mmh3": "1494302000", "md5": "...", "url": null, "path": null },
      "hashes": { "md5": "...", "mmh3": "...", "sha256": "..." },
      "capabilities": { "http2": true, "pipeline": false, "websocket": false, "vhost": false },
      "redirectChain": { "statusCodes": [301, 200], "items": [] },
      "bodyPreview": "...",
      "bodyDomains": [],
      "bodyFqdns": [],
      "rawHttpx": {}
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}`,
      [
        "Supported query params include page, pageSize, target, technology, statusCode, and includeIncomplete.",
        "The response keeps normalized fields first and can include rawHttpx for full evidence.",
      ],
    ),
    buildEndpointSection(
      "list-runs",
      "List scan runs",
      "Query your run history with filters for status, source, text search, pagination, and sort order.",
      "GET",
      "/runs",
      `curl "$STACKRAY_BASE_URL/api/v1/runs?status=completed&limit=20" \
  -H "Authorization: Bearer $STACKRAY_TOKEN"`,
      `const params = new URLSearchParams({
  status: 'completed',
  q: 'example.com',
  sort: 'newest',
  limit: '20',
});

const response = await fetch(
  '${baseUrl}/api/v1/runs?' + params,
  {
    headers: { Authorization: 'Bearer sr_live_your_token_here' },
  }
);

const { items, nextCursor } = await response.json();`,
      `import httpx

response = httpx.get(
    '${baseUrl}/api/v1/runs',
    params={'status': 'completed', 'q': 'example.com', 'limit': 20},
    headers={'Authorization': 'Bearer sr_live_your_token_here'},
)

data = response.json()
items = data['items']`,
      `{
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
}`,
      [
        "Supported query params include q, status, source, sort, cursor, and limit.",
        "Use q for broad search across scan ID, creator, technologies, and targets.",
      ],
    ),
    buildEndpointSection(
      "query-targets",
      "Query targets",
      "Search the latest successful result for each canonical target and drill into that target's history.",
      "GET",
      "/targets/results",
      `curl "$STACKRAY_BASE_URL/api/v1/targets/results?q=wordpress&technology=php" \
  -H "Authorization: Bearer $STACKRAY_TOKEN"`,
      `const params = new URLSearchParams({
  q: 'wordpress',
  technology: 'php',
  cdn: 'fastly',
});

const response = await fetch(
  '${baseUrl}/api/v1/targets/results?' + params,
  {
    headers: { Authorization: 'Bearer sr_live_your_token_here' },
  }
);

const { items } = await response.json();`,
      `import httpx

response = httpx.get(
    '${baseUrl}/api/v1/targets/results',
    params={'q': 'wordpress', 'technology': 'php', 'cdn': 'fastly'},
    headers={'Authorization': 'Bearer sr_live_your_token_here'},
)

data = response.json()
items = data['items']`,
      `{
  "items": [
    {
      "canonicalTargetId": "ctg_01J...",
      "normalizedTarget": "https://example.com",
      "latestScanId": "scn_01J...",
      "title": "Example Site",
      "technologies": ["WordPress", "PHP"],
      "lastScannedAt": "2026-03-23T12:00:12Z",
      "faviconUrl": "https://example.com/favicon.ico"
    }
  ],
  "nextCursor": null
}`,
      [
        "Supported filters include q, technology, cdn, server, plugin, theme, cpe, statusCode, from, to, cursor, and limit.",
        "Use GET /targets/:canonicalTargetId/history to inspect the scan history for a specific canonical target.",
      ],
    ),
    buildEndpointSection(
      "list-schedules",
      "List schedules",
      "Fetch recurring scan schedules owned by the caller, including next run time and the latest dispatched slot.",
      "GET",
      "/schedules",
      `curl "$STACKRAY_BASE_URL/api/v1/schedules" \
  -H "Authorization: Bearer $STACKRAY_TOKEN"`,
      `const response = await fetch('${baseUrl}/api/v1/schedules', {
  headers: {
    Authorization: 'Bearer sr_live_your_token_here',
  },
});

const { items } = await response.json();`,
      `import httpx

response = httpx.get(
    '${baseUrl}/api/v1/schedules',
    headers={'Authorization': 'Bearer sr_live_your_token_here'},
)

data = response.json()
items = data['items']`,
      `{
  "items": [
    {
      "scheduleId": "sch_01J...",
      "targets": ["https://example.com/"],
      "frequency": "weekly",
      "timeOfDay": "10:15",
      "weekday": 1,
      "dayOfMonth": null,
      "timezone": "America/New_York",
      "enabled": true,
      "nextRunAt": "2026-04-18T14:15:00.000Z",
      "lastScheduledForAt": "2026-04-11T23:42:42.888Z",
      "lastScanId": "scn_01J...",
      "lastRunStatus": "queued",
      "lastRunLabel": "Queued",
      "createdAt": "2026-04-11T23:43:25.762Z"
    }
  ]
}`,
      [
        "The response is already filtered to schedules the caller can see.",
        "weekday is only present for weekly schedules; dayOfMonth is only present for monthly schedules.",
      ],
    ),
    buildEndpointSection(
      "create-schedule",
      "Create a schedule",
      "Store a recurring scan definition that will materialize future scan runs automatically.",
      "POST",
      "/schedules",
      `curl -X POST "$STACKRAY_BASE_URL/api/v1/schedules" \
  -H "Authorization: Bearer $STACKRAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targets": ["https://example.com"],
    "frequency": "weekly",
    "timeOfDay": "10:15",
    "weekday": 1,
    "timezone": "America/New_York",
    "options": {
      "followRedirects": true,
      "includeRawResponse": false,
      "headless": false
    }
  }'`,
      `const response = await fetch('${baseUrl}/api/v1/schedules', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer sr_live_your_token_here',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    targets: ['https://example.com'],
    frequency: 'weekly',
    timeOfDay: '10:15',
    weekday: 1,
    timezone: 'America/New_York',
    options: {
      followRedirects: true,
      includeRawResponse: false,
      headless: false,
    },
  }),
});

const { scheduleId } = await response.json();`,
      `import httpx

response = httpx.post(
    '${baseUrl}/api/v1/schedules',
    headers={
        'Authorization': 'Bearer sr_live_your_token_here',
        'Content-Type': 'application/json',
    },
    json={
        'targets': ['https://example.com'],
        'frequency': 'weekly',
        'timeOfDay': '10:15',
        'weekday': 1,
        'timezone': 'America/New_York',
        'options': {
            'followRedirects': True,
            'includeRawResponse': False,
            'headless': False,
        },
    },
)

schedule_id = response.json()['scheduleId']`,
      `{
  "scheduleId": "sch_01J..."
}`,
      [
        "Use frequency=daily, weekly, or monthly.",
        "weekly schedules require weekday (0=Sun through 6=Sat); monthly schedules require dayOfMonth (1-31).",
        "timezone must be a valid IANA timezone string such as America/New_York.",
      ],
    ),
    buildEndpointSection(
      "update-schedule",
      "Pause or resume a schedule",
      "Toggle whether a stored schedule is eligible for future dispatch.",
      "PATCH",
      "/schedules/:scheduleId",
      `curl -X PATCH "$STACKRAY_BASE_URL/api/v1/schedules/sch_01J..." \
  -H "Authorization: Bearer $STACKRAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false
  }'`,
      `const response = await fetch('${baseUrl}/api/v1/schedules/sch_01J...', {
  method: 'PATCH',
  headers: {
    Authorization: 'Bearer sr_live_your_token_here',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ enabled: false }),
});

const data = await response.json();`,
      `import httpx

response = httpx.patch(
    '${baseUrl}/api/v1/schedules/sch_01J...',
    headers={
        'Authorization': 'Bearer sr_live_your_token_here',
        'Content-Type': 'application/json',
    },
    json={'enabled': False},
)

data = response.json()`,
      `{
  "scheduleId": "sch_01J...",
  "enabled": false
}`,
      [
        "Set enabled=false to pause dispatching without deleting the schedule.",
        "Set enabled=true to resume future dispatching.",
      ],
    ),
    buildEndpointSection(
      "delete-schedule",
      "Delete a schedule",
      "Permanently remove a schedule definition and stop future dispatches for it.",
      "DELETE",
      "/schedules/:scheduleId",
      `curl -X DELETE "$STACKRAY_BASE_URL/api/v1/schedules/sch_01J..." \
  -H "Authorization: Bearer $STACKRAY_TOKEN"`,
      `const response = await fetch('${baseUrl}/api/v1/schedules/sch_01J...', {
  method: 'DELETE',
  headers: {
    Authorization: 'Bearer sr_live_your_token_here',
  },
});

const data = await response.json();`,
      `import httpx

response = httpx.delete(
    '${baseUrl}/api/v1/schedules/sch_01J...',
    headers={'Authorization': 'Bearer sr_live_your_token_here'},
)

data = response.json()`,
      `{
  "deletedScheduleId": "sch_01J..."
}`,
      [
        "Deletion removes the stored recurring schedule definition.",
        "Historical scans created by that schedule remain part of normal run history.",
      ],
    ),
    {
      kind: "token-management",
      id: "token-management",
      title: "Token management",
      description: "Token CRUD is part of the same API surface, but it is intentionally session-authenticated rather than bearer-authenticated.",
      endpoints: [
        {
          method: "GET",
          path: "/tokens",
          description: "List the tokens owned by the signed-in user.",
          responseExample: `{
  "items": [
    {
      "id": "0f5d7a0c-8eb9-4d92-9f61-76e2f5a29b10",
      "name": "Automation script",
      "tokenHint": "sr_live_abcd12",
      "lastUsedAt": "2026-03-23T12:00:00Z",
      "createdAt": "2026-03-20T10:00:00Z"
    }
  ]
}`,
        },
        {
          method: "POST",
          path: "/tokens",
          description: "Create a new token and reveal the full value once.",
          responseExample: `{
  "token": {
    "id": "0f5d7a0c-8eb9-4d92-9f61-76e2f5a29b10",
    "name": "Automation script",
    "tokenHint": "sr_live_abcd12",
    "lastUsedAt": null,
    "createdAt": "2026-03-23T12:00:00Z"
  },
  "plainTextToken": "sr_live_secret_abc123xyz..."
}`,
        },
        {
          method: "DELETE",
          path: "/tokens/:tokenId",
          description: "Delete an existing token permanently.",
          responseExample: `{
  "deletedTokenId": "0f5d7a0c-8eb9-4d92-9f61-76e2f5a29b10"
}`,
        },
      ],
      note: `Use /settings/tokens in the authenticated web app for token management.

If you call these routes outside the browser, send your session cookie.
Bearer tokens cannot create, list, or delete tokens.`,
    },
    {
      kind: "error-handling",
      id: "error-handling",
      title: "Error handling",
      sampleError: `{
  "error": {
    "code": "invalid_target",
    "message": "One or more targets could not be normalized.",
    "details": {}
  }
 }`,
      codes: [
        { code: "invalid_api_token", description: "token invalid, deleted, or no longer active" },
        { code: "invalid_authorization_header", description: "malformed Authorization header" },
        { code: "invalid_target", description: "target URL could not be processed" },
        { code: "scan_not_found", description: "requested scan does not exist or is not visible" },
        { code: "forbidden", description: "insufficient permissions" },
        { code: "unauthenticated", description: "no valid auth provided" },
      ],
    },
    ...(tokensEnabled
      ? []
      : [{
          kind: "token-access-disabled" as const,
          title: "Token access is disabled for this account",
          description:
            "You can still review the API shape here, but you will need an admin to re-enable token access before you can authenticate with a bearer token.",
        }]),
  ]

  return {
    tocItems: deriveTocItems(sections),
    sections,
    tokensEnabled,
  }
}
