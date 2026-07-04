interface TocItem {
  id: string
  label: string
}

const TOC_SECTION_IDS = new Set([
  "quick-start",
  "concepts",
  "authentication",
  "submit-scan",
  "watch-progress",
  "scan-report",
  "scan-technologies",
  "fetch-results",
  "list-runs",
  "list-schedules",
  "api-key-management",
  "error-handling",
])

interface IntroSection {
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

interface AuthMode {
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

interface ConceptItem {
  term: string
  description: string
}

export interface ConceptsSection {
  kind: "concepts"
  id: string
  title: string
  description: string
  items: ConceptItem[]
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

export interface ApiKeyEndpoint {
  method: string
  path: string
  description: string
  responseExample: string
}

export interface ApiKeyManagementSection {
  kind: "api-key-management"
  id: string
  title: string
  description: string
  endpoints: ApiKeyEndpoint[]
  note: string
}

interface ErrorCodeEntry {
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

interface ApiKeyAccessDisabledSection {
  kind: "api-key-access-disabled"
  title: string
  description: string
}

type ApiDocsSection =
  | IntroSection
  | QuickStartSection
  | ConceptsSection
  | AuthenticationSection
  | EndpointSection
  | ApiKeyManagementSection
  | ErrorHandlingSection
  | ApiKeyAccessDisabledSection

export interface ApiDocsContent {
  tocItems: TocItem[]
  sections: ApiDocsSection[]
  apiKeysEnabled: boolean
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
      case "concepts":
      case "authentication":
      case "endpoint":
      case "api-key-management":
      case "error-handling":
        return TOC_SECTION_IDS.has(section.id) ? [{ id: section.id, label: section.title }] : []
      default:
        return []
    }
  })
}

export function buildApiDocsContent(apiKeysEnabled: boolean, publicOrigin = "https://your-stackray-instance.com"): ApiDocsContent {
  const baseUrl = publicOrigin.replace(/\/$/, "")
  const sections: ApiDocsSection[] = [
    {
      kind: "intro",
      id: "api-docs",
      title: "API docs",
      description:
        "Use Stackray's shared HTTP API to submit scans, watch progress, fetch results, and query stored history from scripts, services, and agents.",
      basePath: "/api/v1",
      primaryAuth: "Bearer API key",
      streaming: "SSE events",
    },
    {
      kind: "quick-start",
      id: "quick-start",
      title: "Quick start",
      description: "Start here if you just created an API key and want to verify that your integration works.",
      steps: [
        "Create an API key in `/settings/api-keys`.",
        "Set your base URL and API key in your shell or runtime environment.",
        "Submit a scan, wait for completion, then fetch `GET /scans/:scanId/report`.",
      ],
      example: `export STACKRAY_BASE_URL="${baseUrl}"
export STACKRAY_API_KEY="sr_live_your_api_key_here"

curl -X POST "$STACKRAY_BASE_URL/api/v1/scans" \
  -H "Authorization: Bearer $STACKRAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"target":"https://example.com","options":{"followRedirects":true,"includeRawResponse":false,"headless":false},"client":{"source":"api"}}'

curl "$STACKRAY_BASE_URL/api/v1/scans/scn_01J.../report" \
  -H "Authorization: Bearer $STACKRAY_API_KEY"`,
    },
    {
      kind: "concepts",
      id: "concepts",
      title: "Concepts",
      description: "Most agents can start with the scan report and only use result or target endpoints when they need deeper evidence.",
      items: [
        {
          term: "scanId",
          description: "The scan job you submitted, such as one request to analyze example.com.",
        },
        {
          term: "resultId",
          description: "One observed URL/result row inside a scan. Use result-level endpoints only when you already need to inspect a specific row.",
        },
        {
          term: "target",
          description: "The historical identity Stackray uses to connect repeated scans of the same normalized site over time.",
        },
        {
          term: "report",
          description: "The default agent-readable answer for a scan: authoritative result, primary technologies, infrastructure summary, and links to larger paginated collections.",
        },
      ],
    },
    {
      kind: "authentication",
      id: "authentication",
      title: "Authentication modes",
      description: "Product-resource endpoints accept either bearer API keys or browser sessions. Account, admin, and API key management endpoints remain browser-session-only.",
      modes: [
        {
          title: "Bearer API key",
          description: "Use this for scans, runs, targets, schedules, results, and scan-event streaming.",
          example: `Authorization: Bearer sr_live_your_api_key_here`,
        },
        {
          title: "Browser session",
          description: "Use this for the web UI, API key management, user administration, password changes, and product-state endpoints.",
          example: `/api/v1/api-keys

Use the web app at /settings/api-keys or pass your session cookie.`,
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
  -H "Authorization: Bearer $STACKRAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "target": "https://example.com",
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
    Authorization: 'Bearer sr_live_your_api_key_here',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    target: 'https://example.com',
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
        'Authorization': 'Bearer sr_live_your_api_key_here',
        'Content-Type': 'application/json',
    },
    json={
        'target': 'https://example.com',
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
        "Each scan represents one target domain or URL.",
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
  -H "Authorization: Bearer $STACKRAY_API_KEY"`,
      `const response = await fetch(
  '${baseUrl}/api/v1/scans/scn_01J.../events',
  {
    headers: {
      Authorization: 'Bearer sr_live_your_api_key_here',
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
    headers={'Authorization': 'Bearer sr_live_your_api_key_here'},
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
data: {"scanId":"scn_01J...","resultCount":1,"subdomainCount":42,"at":"2026-03-23T12:00:02Z"}

event: scan.result
data: {"scanId":"scn_01J...","resultId":"res_01J...","target":"https://example.com","statusCode":200,"finalUrl":"https://example.com","title":"Example Site","server":"nginx","cdn":{"enabled":true,"name":"cloudflare","type":"cdn"},"technologies":["WordPress","PHP"],"at":"2026-03-23T12:00:03Z"}

event: scan.complete
data: {"scanId":"scn_01J...","status":"completed","resultCount":1,"at":"2026-03-23T12:00:04Z"}`,
      [
        "Native browser EventSource does not let you send an Authorization header.",
        "For browser apps, use a proxy or poll GET /scans/:scanId and GET /scans/:scanId/results instead.",
        "scan.status attemptId is null when recovery requeues a scan before an attempt exists.",
        "Event types include scan.status, scan.progress, scan.result, scan.complete, scan.failed, and scan.cancelled.",
      ],
      true,
    ),
    buildEndpointSection(
      "scan-report",
      "Get the scan summary",
      "Use this as the default result endpoint for agents. It returns Stackray's authoritative result, primary technologies, infrastructure summary, bounded subdomain sample, and links to paginated evidence.",
      "GET",
      "/scans/:scanId/report",
      `curl "$STACKRAY_BASE_URL/api/v1/scans/scn_01J.../report" \
  -H "Authorization: Bearer $STACKRAY_API_KEY"`,
      "",
      "",
      `{
  "scan": {
    "scanId": "scn_01J...",
    "status": "completed",
    "source": "api",
    "target": {
      "inputTarget": "https://example.com",
      "normalizedTarget": "example.com",
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
    "attemptHistory": [
      {
        "attemptId": "att_01J...",
        "attemptNumber": 1,
        "status": "completed",
        "requestProfile": "baseline",
        "fallbackReason": null,
        "resultCount": 1,
        "forbiddenResultCount": 0
      }
    ],
    "phases": [],
    "progress": {
      "resultCount": 1,
      "subdomainCount": 500
    },
    "subdomains": {
      "state": "completed",
      "runId": "sdr_01J...",
      "targetDomain": "example.com",
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
    "url": "https://example.com",
    "finalUrl": "https://example.com",
    "title": "Example Site",
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
    "total": 2,
    "items": [
      {
        "scanId": "scn_01J...",
        "resultId": "res_01J...",
        "canonicalTargetId": "ctg_01J...",
        "url": "https://example.com",
        "kind": "technology",
        "sources": ["wappalyzer"],
        "displayName": "Next.js",
        "normalizedName": "nextjs",
        "version": null,
        "description": "Next.js is a React framework...",
        "website": "https://nextjs.org",
        "iconUrl": null,
        "categories": ["Web frameworks"],
        "primaryCategory": "Web frameworks",
        "bucket": "framework",
        "inferred": false,
        "vendor": null,
        "product": null,
        "cpe": null
      }
    ]
  },
  "infrastructure": {
    "dns": {
      "hostIp": "203.0.113.10",
      "a": ["203.0.113.10"],
      "aaaa": [],
      "cname": [],
      "resolvers": ["1.1.1.1:53"]
    },
    "asn": {
      "asNumber": "13335",
      "org": "Cloudflare, Inc."
    },
    "tls": null,
    "capabilities": null,
    "ipIntelligence": null
  },
  "subdomains": {
    "summary": {
      "state": "completed",
      "runId": "sdr_01J...",
      "targetDomain": "example.com",
      "resultCount": 500,
      "engineVersion": "subfinder-2.9.0",
      "errorMessage": null,
      "startedAt": "2026-03-23T12:00:02Z",
      "completedAt": "2026-03-23T12:00:07Z"
    },
    "sample": [
      {
        "subdomainId": "sub_01J...",
        "scanId": "scn_01J...",
        "host": "app.example.com",
        "rootDomain": "example.com",
        "ip": "203.0.113.11",
        "source": "subfinder",
        "wildcardCertificate": false,
        "observedAt": "2026-03-23T12:00:05Z",
        "rawSubfinder": {}
      }
    ],
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
}`,
      [
        "Use this as the default endpoint for agent-readable scan detail.",
        "The report is bounded: large collections such as subdomains are summarized with a sample and links to paginated endpoints.",
        "Technologies use the authoritative result selected by Stackray, so agents do not need to choose a resultId for common questions.",
      ],
    ),
    buildEndpointSection(
      "scan-technologies",
      "Get primary technologies",
      "Use this to answer technology questions about the authoritative scan result, including metadata for a specific technology such as Next.js.",
      "GET",
      "/scans/:scanId/technologies",
      `curl "$STACKRAY_BASE_URL/api/v1/scans/scn_01J.../technologies?scope=authoritative&q=Next.js" \
  -H "Authorization: Bearer $STACKRAY_API_KEY"`,
      "",
      "",
      `{
  "items": [
    {
      "scanId": "scn_01J...",
      "resultId": "res_01J...",
      "canonicalTargetId": "ctg_01J...",
      "url": "https://example.com",
      "kind": "technology",
      "sources": ["wappalyzer", "cpe"],
      "displayName": "Next.js",
      "normalizedName": "nextjs",
      "version": null,
      "description": "Next.js is a React framework...",
      "website": "https://nextjs.org",
      "iconUrl": null,
      "categories": ["Web frameworks", "JavaScript frameworks"],
      "primaryCategory": "Web frameworks",
      "bucket": "framework",
      "inferred": false,
      "vendor": null,
      "product": null,
      "cpe": null
    }
  ],
  "page": 1,
  "pageSize": 1,
  "total": 1
}`,
      [
        "Use scope=authoritative for the selected primary result; this response is not paginated.",
        "Use scope=all-results for the paginated aggregate over matching result rows.",
        "Use q, source, and bucket to narrow metadata questions without paging raw result rows.",
      ],
    ),
    buildEndpointSection(
      "fetch-results",
      "Page through observed result rows",
      "Use this when the bounded scan summary is not enough and you need the lower-level URLs/results observed during the scan.",
      "GET",
      "/scans/:scanId/results",
      `curl "$STACKRAY_BASE_URL/api/v1/scans/scn_01J.../results?page=1&pageSize=20" \
  -H "Authorization: Bearer $STACKRAY_API_KEY"`,
      `const params = new URLSearchParams({
  page: '1',
  pageSize: '20',
  technology: 'wordpress',
});

const response = await fetch(
  '${baseUrl}/api/v1/scans/scn_01J.../results?' + params,
  {
    headers: { Authorization: 'Bearer sr_live_your_api_key_here' },
  }
);

const { items, total } = await response.json();`,
      `import httpx

response = httpx.get(
    '${baseUrl}/api/v1/scans/scn_01J.../results',
    params={'page': 1, 'pageSize': 20, 'technology': 'wordpress'},
    headers={'Authorization': 'Bearer sr_live_your_api_key_here'},
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
        "A scan is single-target, but it can still emit multiple persisted result rows across attempts or profiles.",
        "Supported query params include page, pageSize, target, technology, statusCode, and includeIncomplete.",
        "The response keeps normalized fields first and can include rawHttpx for full evidence.",
        "Use the dedicated technology endpoints when you want flat technology inventory rows without the rest of the scan result fields.",
      ],
    ),
    buildEndpointSection(
      "scan-subdomains",
      "Page through subdomains",
      "Use this when a report says the subdomain list is truncated and you need the full paginated collection.",
      "GET",
      "/scans/:scanId/subdomains",
      `curl "$STACKRAY_BASE_URL/api/v1/scans/scn_01J.../subdomains?page=1&pageSize=50" \
  -H "Authorization: Bearer $STACKRAY_API_KEY"`,
      `const params = new URLSearchParams({
  page: '1',
  pageSize: '50',
  host: 'shop',
});

const response = await fetch(
  '${baseUrl}/api/v1/scans/scn_01J.../subdomains?' + params,
  {
    headers: { Authorization: 'Bearer sr_live_your_api_key_here' },
  }
);

const { items, summary } = await response.json();`,
      `import httpx

response = httpx.get(
    '${baseUrl}/api/v1/scans/scn_01J.../subdomains',
    params={'page': 1, 'pageSize': 50, 'host': 'shop'},
    headers={'Authorization': 'Bearer sr_live_your_api_key_here'},
)

data = response.json()
items = data['items']`,
      `{
  "summary": {
    "state": "completed",
    "runId": "sdr_01J...",
    "targetDomain": "example.com",
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
      "host": "shop.example.com",
      "rootDomain": "example.com",
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
}`,
      [
        "Subdomain rows are DNS-validated by Subfinder's active mode, not HTTP-live probes.",
        "pageSize is capped at 250.",
        "The compact subdomain summary is also available on GET /scans/:scanId.",
        "Use GET /scans/:scanId/results for httpx result rows and content-derived body domains.",
      ],
    ),
    buildEndpointSection(
      "result-technologies",
      "Advanced: technologies for one result row",
      "Use this only when you already know the exact resultId and need technology rows for that specific observed URL/result.",
      "GET",
      "/scans/:scanId/results/:resultId/technologies",
      `curl "$STACKRAY_BASE_URL/api/v1/scans/scn_01J.../results/res_01J.../technologies" \
  -H "Authorization: Bearer $STACKRAY_API_KEY"`,
      `const response = await fetch(
  '${baseUrl}/api/v1/scans/scn_01J.../results/res_01J.../technologies',
  {
    headers: { Authorization: 'Bearer sr_live_your_api_key_here' },
  }
);

const technologyResult = await response.json();`,
      `import httpx

response = httpx.get(
    '${baseUrl}/api/v1/scans/scn_01J.../results/res_01J.../technologies',
    headers={'Authorization': 'Bearer sr_live_your_api_key_here'},
)

technology_result = response.json()`,
      `{
  "items": [
    {
      "scanId": "scn_01J...",
      "resultId": "res_01J...",
      "canonicalTargetId": "ctg_01J...",
      "url": "https://example.com",
      "kind": "technology",
      "sources": ["wappalyzer", "cpe"],
      "displayName": "WordPress",
      "normalizedName": "wordpress",
      "version": null,
      "description": "Blog tool and publishing platform.",
      "website": "https://wordpress.org",
      "iconUrl": null,
      "categories": ["CMS"],
      "primaryCategory": "CMS",
      "bucket": "platform",
      "inferred": false,
      "vendor": null,
      "product": null,
      "cpe": null
    },
    {
      "scanId": "scn_01J...",
      "resultId": "res_01J...",
      "canonicalTargetId": "ctg_01J...",
      "url": "https://example.com",
      "kind": "wordpress_plugin",
      "sources": ["wordpress"],
      "displayName": "Jetpack",
      "normalizedName": "jetpack",
      "version": null,
      "description": null,
      "website": null,
      "iconUrl": null,
      "categories": [],
      "primaryCategory": null,
      "bucket": "ecosystem",
      "inferred": false,
      "vendor": null,
      "product": null,
      "cpe": null
    }
  ],
  "total": 2
}`,
      [
        "Use this when you already know the exact resultId you want.",
        "The route returns a flat list of detection rows for the exact result row you selected, not the scan-level aggregate.",
      ],
    ),
    buildEndpointSection(
      "list-runs",
      "Search scan history",
      "Find previous scans by status, source, target text, or sort order. Use this to locate a scanId before fetching a report.",
      "GET",
      "/runs",
      `curl "$STACKRAY_BASE_URL/api/v1/runs?status=completed&limit=20" \
  -H "Authorization: Bearer $STACKRAY_API_KEY"`,
      `const params = new URLSearchParams({
  status: 'completed',
  q: 'example.com',
  sort: 'newest',
  limit: '20',
});

const response = await fetch(
  '${baseUrl}/api/v1/runs?' + params,
  {
    headers: { Authorization: 'Bearer sr_live_your_api_key_here' },
  }
);

const { items, nextCursor } = await response.json();`,
      `import httpx

response = httpx.get(
    '${baseUrl}/api/v1/runs',
    params={'status': 'completed', 'q': 'example.com', 'limit': 20},
    headers={'Authorization': 'Bearer sr_live_your_api_key_here'},
)

data = response.json()
items = data['items']`,
      `{
  "items": [
    {
      "scanId": "scn_01J...",
      "status": "completed",
      "source": "cli",
      "target": "https://example.com",
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
      "Search historical targets",
      "Search the latest successful snapshot for each canonical target when you care about site history rather than one scan job.",
      "GET",
      "/targets/results",
      `curl "$STACKRAY_BASE_URL/api/v1/targets/results?q=wordpress&technology=php" \
  -H "Authorization: Bearer $STACKRAY_API_KEY"`,
      `const params = new URLSearchParams({
  q: 'wordpress',
  technology: 'php',
  cdn: 'fastly',
});

const response = await fetch(
  '${baseUrl}/api/v1/targets/results?' + params,
  {
    headers: { Authorization: 'Bearer sr_live_your_api_key_here' },
  }
);

const { items } = await response.json();`,
      `import httpx

response = httpx.get(
    '${baseUrl}/api/v1/targets/results',
    params={'q': 'wordpress', 'technology': 'php', 'cdn': 'fastly'},
    headers={'Authorization': 'Bearer sr_live_your_api_key_here'},
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
        "Use GET /targets/:canonicalTargetId/technologies to retrieve flat technology inventory rows for a target.",
      ],
    ),
    buildEndpointSection(
      "target-technologies",
      "Advanced: target technology history",
      "Use this after resolving a canonical target when you need technology inventory from the target history view instead of one scan report.",
      "GET",
      "/targets/:canonicalTargetId/technologies",
      `curl "$STACKRAY_BASE_URL/api/v1/targets/ctg_01J.../technologies" \
  -H "Authorization: Bearer $STACKRAY_API_KEY"`,
      `const response = await fetch(
  '${baseUrl}/api/v1/targets/ctg_01J.../technologies?scanId=scn_01J...',
  {
    headers: { Authorization: 'Bearer sr_live_your_api_key_here' },
  }
);

const targetTechnologies = await response.json();`,
      `import httpx

response = httpx.get(
    '${baseUrl}/api/v1/targets/ctg_01J.../technologies',
    params={'scanId': 'scn_01J...'},
    headers={'Authorization': 'Bearer sr_live_your_api_key_here'},
)

target_technologies = response.json()`,
      `{
  "canonicalTargetId": "ctg_01J...",
  "normalizedTarget": "https://example.com",
  "latestScanId": "scn_01J_latest",
  "scanId": "scn_01J...",
  "lastScannedAt": "2026-03-23T12:00:12Z",
  "items": [
    {
      "scanId": "scn_01J...",
      "resultId": "res_01J...",
      "canonicalTargetId": "ctg_01J...",
      "url": "https://example.com",
      "kind": "technology",
      "sources": ["wappalyzer", "cpe"],
      "displayName": "WordPress",
      "normalizedName": "wordpress",
      "version": null,
      "description": "Blog tool and publishing platform.",
      "website": "https://wordpress.org",
      "iconUrl": null,
      "categories": ["CMS"],
      "primaryCategory": "CMS",
      "bucket": "platform",
      "inferred": false,
      "vendor": null,
      "product": null,
      "cpe": null
    },
    {
      "scanId": "scn_01J...",
      "resultId": "res_01J...",
      "canonicalTargetId": "ctg_01J...",
      "url": "https://example.com",
      "kind": "wordpress_plugin",
      "sources": ["wordpress"],
      "displayName": "Jetpack",
      "normalizedName": "jetpack",
      "version": null,
      "description": null,
      "website": null,
      "iconUrl": null,
      "categories": [],
      "primaryCategory": null,
      "bucket": "ecosystem",
      "inferred": false,
      "vendor": null,
      "product": null,
      "cpe": null
    }
  ]
}`,
      [
        "Without scanId, the endpoint returns the latest completed scan for the canonical target that the caller can access.",
        "With scanId, the endpoint returns the technology payload for that target within the selected scan.",
      ],
    ),
    buildEndpointSection(
      "list-schedules",
      "List schedules",
      "Fetch recurring schedule definitions owned by the caller. A single schedule can group many targets and each dispatch can fan out into many single-target scans.",
      "GET",
      "/schedules",
      `curl "$STACKRAY_BASE_URL/api/v1/schedules" \
  -H "Authorization: Bearer $STACKRAY_API_KEY"`,
      `const response = await fetch('${baseUrl}/api/v1/schedules', {
  headers: {
    Authorization: 'Bearer sr_live_your_api_key_here',
  },
});

const { items } = await response.json();`,
      `import httpx

response = httpx.get(
    '${baseUrl}/api/v1/schedules',
    headers={'Authorization': 'Bearer sr_live_your_api_key_here'},
)

data = response.json()
items = data['items']`,
      `{
  "items": [
    {
      "scheduleId": "sch_01J...",
      "targets": ["https://example.com/", "https://example2.com/"],
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
        "lastScanId points at one scan linked to the latest dispatch group so the UI can deep-link into recent activity.",
      ],
    ),
    buildEndpointSection(
      "create-schedule",
      "Create a schedule",
      "Store a recurring schedule definition that can target many domains and fan out into one scan per target each time it fires.",
      "POST",
      "/schedules",
      `curl -X POST "$STACKRAY_BASE_URL/api/v1/schedules" \
  -H "Authorization: Bearer $STACKRAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "targets": ["https://example.com", "https://example2.com"],
    "frequency": "weekly",
    "timeOfDay": "10:15",
    "weekday": 1,
    "timezone": "America/New_York",
    "options": {
      "followRedirects": true
    }
  }'`,
      `const response = await fetch('${baseUrl}/api/v1/schedules', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer sr_live_your_api_key_here',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    targets: ['https://example.com', 'https://example2.com'],
    frequency: 'weekly',
    timeOfDay: '10:15',
    weekday: 1,
    timezone: 'America/New_York',
    options: {
      followRedirects: true,
    },
  }),
});

const { scheduleId } = await response.json();`,
      `import httpx

response = httpx.post(
    '${baseUrl}/api/v1/schedules',
    headers={
        'Authorization': 'Bearer sr_live_your_api_key_here',
        'Content-Type': 'application/json',
    },
    json={
        'targets': ['https://example.com', 'https://example2.com'],
        'frequency': 'weekly',
        'timeOfDay': '10:15',
        'weekday': 1,
        'timezone': 'America/New_York',
        'options': {
            'followRedirects': True,
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
        "When the schedule fires, the backend creates one scan per target instead of creating a multi-target scan.",
      ],
    ),
    buildEndpointSection(
      "update-schedule",
      "Pause or resume a schedule",
      "Toggle whether a stored schedule is eligible for future dispatch.",
      "PATCH",
      "/schedules/:scheduleId",
      `curl -X PATCH "$STACKRAY_BASE_URL/api/v1/schedules/sch_01J..." \
  -H "Authorization: Bearer $STACKRAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false
  }'`,
      `const response = await fetch('${baseUrl}/api/v1/schedules/sch_01J...', {
  method: 'PATCH',
  headers: {
    Authorization: 'Bearer sr_live_your_api_key_here',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ enabled: false }),
});

const data = await response.json();`,
      `import httpx

response = httpx.patch(
    '${baseUrl}/api/v1/schedules/sch_01J...',
    headers={
        'Authorization': 'Bearer sr_live_your_api_key_here',
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
  -H "Authorization: Bearer $STACKRAY_API_KEY"`,
      `const response = await fetch('${baseUrl}/api/v1/schedules/sch_01J...', {
  method: 'DELETE',
  headers: {
    Authorization: 'Bearer sr_live_your_api_key_here',
  },
});

const data = await response.json();`,
      `import httpx

response = httpx.delete(
    '${baseUrl}/api/v1/schedules/sch_01J...',
    headers={'Authorization': 'Bearer sr_live_your_api_key_here'},
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
      kind: "api-key-management",
      id: "api-key-management",
      title: "API key management",
      description: "API key management is part of the same API surface, but it is intentionally session-authenticated rather than bearer-authenticated.",
      endpoints: [
        {
          method: "GET",
          path: "/api-keys",
          description: "List the API keys owned by the signed-in user.",
          responseExample: `{
  "items": [
    {
      "id": "0f5d7a0c-8eb9-4d92-9f61-76e2f5a29b10",
      "name": "Automation script",
      "keyHint": "sr_live_abcd12",
      "lastUsedAt": "2026-03-23T12:00:00Z",
      "createdAt": "2026-03-20T10:00:00Z"
    }
  ]
}`,
        },
        {
          method: "POST",
          path: "/api-keys",
          description: "Create a new API key and reveal the full value once.",
          responseExample: `{
  "apiKey": {
    "id": "0f5d7a0c-8eb9-4d92-9f61-76e2f5a29b10",
    "name": "Automation script",
    "keyHint": "sr_live_abcd12",
    "lastUsedAt": null,
    "createdAt": "2026-03-23T12:00:00Z"
  },
  "plainTextApiKey": "sr_live_secret_abc123xyz..."
}`,
        },
        {
          method: "DELETE",
          path: "/api-keys/:apiKeyId",
          description: "Revoke an existing API key so it can no longer authenticate new requests.",
          responseExample: `{
  "revokedApiKeyId": "0f5d7a0c-8eb9-4d92-9f61-76e2f5a29b10"
}`,
        },
      ],
      note: `Use /settings/api-keys in the authenticated web app for API key management.

If you call these routes outside the browser, send your session cookie.
API keys cannot create, list, or revoke API keys.`,
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
        { code: "invalid_api_key", description: "API key invalid, deleted, or no longer active" },
        { code: "invalid_authorization_header", description: "malformed Authorization header" },
        { code: "invalid_target", description: "target URL could not be processed" },
        { code: "scan_not_found", description: "requested scan does not exist or is not visible" },
        { code: "forbidden", description: "insufficient permissions" },
        { code: "unauthenticated", description: "no valid auth provided" },
      ],
    },
    ...(apiKeysEnabled
      ? []
      : [{
          kind: "api-key-access-disabled" as const,
          title: "API key access is disabled for this account",
          description:
            "You can still review the API shape here, but you will need an admin to re-enable API key access before you can authenticate with an API key.",
        }]),
  ]

  return {
    tocItems: deriveTocItems(sections),
    sections,
    apiKeysEnabled,
  }
}
