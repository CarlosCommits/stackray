import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { canAccessApiTokens } from "@/lib/authorization/authz"
import { requireAppSession } from "@/lib/session/app-session"
import { ApiDocsNav, type TocItem } from "@/components/settings/api-docs/api-docs-nav"

const tocItems: TocItem[] = [
  { id: "quick-start", label: "Quick start" },
  { id: "authentication", label: "Authentication" },
  { id: "submit-scan", label: "Submit a scan" },
  { id: "watch-progress", label: "Watch progress" },
  { id: "fetch-results", label: "Fetch results" },
  { id: "list-runs", label: "List scan runs" },
  { id: "query-targets", label: "Query targets" },
  { id: "token-management", label: "Token management" },
  { id: "error-handling", label: "Error handling" },
]

export default async function ApiDocsPage() {
  const session = await requireAppSession()
  const tokensEnabled = canAccessApiTokens(session)

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex gap-8">
        <ApiDocsNav items={tocItems} />
        
        <div className="flex-1 min-w-0" data-docs-content="true">
          <div className="space-y-6">
            <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--foreground)]">API docs</CardTitle>
                <CardDescription className="text-[var(--text-dim)]">
                  Use Stackray's shared HTTP API to submit scans, watch progress, fetch results, and query stored history from scripts, services, and agents.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <InfoPill label="Base path" value="/api/v1" />
                <InfoPill label="Primary auth" value="Bearer token" />
                <InfoPill label="Streaming" value="SSE events" />
              </CardContent>
            </Card>

            <section id="quick-start" className="scroll-mt-24">
              <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
                <CardHeader>
                  <CardTitle className="text-lg text-[var(--foreground)]">Quick start</CardTitle>
                  <CardDescription className="text-[var(--text-dim)]">
                    Start here if you just created a token and want to verify that your integration works.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ol className="space-y-3 text-sm text-[var(--text-dim)]">
                    <li>1. Create a token in <code className="text-[var(--foreground)]">/settings/tokens</code>.</li>
                    <li>2. Set your base URL and token in your shell or runtime environment.</li>
                    <li>3. Call a read endpoint like <code className="text-[var(--foreground)]">GET /runs</code> first, then move on to scan submission.</li>
                  </ol>
                  <CodeBlock>{`export STACKRAY_BASE_URL="https://your-stackray-instance.com"
export STACKRAY_TOKEN="sr_live_your_token_here"

curl "$STACKRAY_BASE_URL/api/v1/runs?limit=5" \
  -H "Authorization: Bearer $STACKRAY_TOKEN"`}</CodeBlock>
                </CardContent>
              </Card>
            </section>

            <section id="authentication" className="scroll-mt-24">
              <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
                <CardHeader>
                  <CardTitle className="text-lg text-[var(--foreground)]">Authentication modes</CardTitle>
                  <CardDescription className="text-[var(--text-dim)]">
                    Most product API endpoints accept bearer tokens. Token-management endpoints remain session-authenticated.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-4">
                    <p className="text-sm font-medium text-[var(--foreground)]">Bearer token</p>
                    <p className="text-xs text-[var(--text-dim)]">
                      Use this for scans, runs, targets, results, and scan-event streaming.
                    </p>
                    <CodeBlock>{`Authorization: Bearer sr_live_your_token_here`}</CodeBlock>
                  </div>
                  <div className="space-y-2 rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-4">
                    <p className="text-sm font-medium text-[var(--foreground)]">Browser session</p>
                    <p className="text-xs text-[var(--text-dim)]">
                      Use this for creating, listing, and deleting tokens in the authenticated web app.
                    </p>
                    <CodeBlock>{`/api/v1/tokens

Use the web app at /settings/tokens or pass your session cookie.`}</CodeBlock>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section id="submit-scan" className="scroll-mt-24">
              <EndpointCard
                title="Submit a scan"
                description="Queue a new scan and get a scan ID back immediately."
                method="POST"
                path="/scans"
                curlExample={`curl -X POST "$STACKRAY_BASE_URL/api/v1/scans" \\
  -H "Authorization: Bearer $STACKRAY_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "targets": ["https://example.com"],
    "options": {
      "followRedirects": true,
      "includeRawResponse": false,
      "headless": false
    },
    "client": { "source": "api" }
  }'`}
                jsExample={`const response = await fetch('https://your-stackray-instance.com/api/v1/scans', {
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

const { scanId, status, reused } = await response.json();`}
                pythonExample={`import httpx

response = httpx.post(
    'https://your-stackray-instance.com/api/v1/scans',
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
scan_id = data['scanId']`}
                responseExample={`{
  "scanId": "scn_01J...",
  "status": "queued",
  "reused": false
}`}
                notes={[
                  "Returns scanId, status, and reused immediately.",
                  "Use idempotencyKey when you want replay protection for automation.",
                ]}
              />
            </section>

            <section id="watch-progress" className="scroll-mt-24">
              <EndpointCard
                title="Watch scan progress"
                description="Stream live scan updates with Server-Sent Events or fall back to polling."
                method="GET"
                path="/scans/:scanId/events"
                curlExample={`curl -N "$STACKRAY_BASE_URL/api/v1/scans/scn_01J.../events" \\
  -H "Authorization: Bearer $STACKRAY_TOKEN"`}
                jsExample={`const response = await fetch(
  'https://your-stackray-instance.com/api/v1/scans/scn_01J.../events',
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
}`}
                pythonExample={`import json
import httpx
import sseclient

with httpx.stream(
    'GET',
    'https://your-stackray-instance.com/api/v1/scans/scn_01J.../events',
    headers={'Authorization': 'Bearer sr_live_your_token_here'},
) as response:
    client = sseclient.SSEClient(response)
    for event in client.events():
        payload = json.loads(event.data)
        print(event.event, payload)
        if event.event in {'scan.complete', 'scan.failed', 'scan.cancelled'}:
            break`}
                responseExample={`event: scan.status
data: {"scanId":"scn_01J...","status":"running","attemptId":"att_01J...","at":"2026-03-23T12:00:00Z"}

event: scan.progress
data: {"scanId":"scn_01J...","processedTargets":1,"totalTargets":3,"resultCount":1,"at":"2026-03-23T12:00:02Z"}

event: scan.result
data: {"scanId":"scn_01J...","resultId":"res_01J...","target":"https://example.com","statusCode":200,"finalUrl":"https://example.com","title":"Example Site","server":"nginx","cdn":{"enabled":true,"name":"cloudflare","type":"cdn"},"technologies":["WordPress","PHP"],"at":"2026-03-23T12:00:03Z"}

event: scan.complete
data: {"scanId":"scn_01J...","status":"completed","resultCount":1,"at":"2026-03-23T12:00:04Z"}`}
                notes={[
                  "Native browser EventSource does not let you send an Authorization header.",
                  "For browser apps, use a proxy or poll GET /scans/:scanId and GET /scans/:scanId/results instead.",
                  "Event types include scan.status, scan.progress, scan.result, scan.complete, scan.failed, and scan.cancelled.",
                ]}
                isSSE={true}
              />
            </section>

            <section id="fetch-results" className="scroll-mt-24">
              <EndpointCard
                title="Fetch scan results"
                description="Retrieve paginated scan results and filter them by target, technology, and HTTP status."
                method="GET"
                path="/scans/:scanId/results"
                curlExample={`curl "$STACKRAY_BASE_URL/api/v1/scans/scn_01J.../results?page=1&pageSize=20" \\
  -H "Authorization: Bearer $STACKRAY_TOKEN"`}
                jsExample={`const params = new URLSearchParams({
  page: '1',
  pageSize: '20',
  technology: 'wordpress',
});

const response = await fetch(
  'https://your-stackray-instance.com/api/v1/scans/scn_01J.../results?' + params,
  {
    headers: { Authorization: 'Bearer sr_live_your_token_here' },
  }
);

const { items, total } = await response.json();`}
                pythonExample={`import httpx

response = httpx.get(
    'https://your-stackray-instance.com/api/v1/scans/scn_01J.../results',
    params={'page': 1, 'pageSize': 20, 'technology': 'wordpress'},
    headers={'Authorization': 'Bearer sr_live_your_token_here'},
)

data = response.json()
items = data['items']`}
                responseExample={`{
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
}`}
                notes={[
                  "Supported query params include page, pageSize, target, technology, statusCode, and includeIncomplete.",
                  "The response keeps normalized fields first and can include rawHttpx for full evidence.",
                ]}
              />
            </section>

            <section id="list-runs" className="scroll-mt-24">
              <EndpointCard
                title="List scan runs"
                description="Query your run history with filters for status, source, text search, pagination, and sort order."
                method="GET"
                path="/runs"
                curlExample={`curl "$STACKRAY_BASE_URL/api/v1/runs?status=completed&limit=20" \\
  -H "Authorization: Bearer $STACKRAY_TOKEN"`}
                jsExample={`const params = new URLSearchParams({
  status: 'completed',
  q: 'example.com',
  sort: 'newest',
  limit: '20',
});

const response = await fetch(
  'https://your-stackray-instance.com/api/v1/runs?' + params,
  {
    headers: { Authorization: 'Bearer sr_live_your_token_here' },
  }
);

const { items, nextCursor } = await response.json();`}
                pythonExample={`import httpx

response = httpx.get(
    'https://your-stackray-instance.com/api/v1/runs',
    params={'status': 'completed', 'q': 'example.com', 'limit': 20},
    headers={'Authorization': 'Bearer sr_live_your_token_here'},
)

data = response.json()
items = data['items']`}
                responseExample={`{
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
}`}
                notes={[
                  "Supported query params include q, status, source, sort, cursor, and limit.",
                  "Use q for broad search across scan ID, creator, technologies, and targets.",
                ]}
              />
            </section>

            <section id="query-targets" className="scroll-mt-24">
              <EndpointCard
                title="Query targets"
                description="Search the latest successful result for each canonical target and drill into that target's history."
                method="GET"
                path="/targets/results"
                curlExample={`curl "$STACKRAY_BASE_URL/api/v1/targets/results?q=wordpress&technology=php" \\
  -H "Authorization: Bearer $STACKRAY_TOKEN"`}
                jsExample={`const params = new URLSearchParams({
  q: 'wordpress',
  technology: 'php',
  cdn: 'fastly',
});

const response = await fetch(
  'https://your-stackray-instance.com/api/v1/targets/results?' + params,
  {
    headers: { Authorization: 'Bearer sr_live_your_token_here' },
  }
);

const { items } = await response.json();`}
                pythonExample={`import httpx

response = httpx.get(
    'https://your-stackray-instance.com/api/v1/targets/results',
    params={'q': 'wordpress', 'technology': 'php', 'cdn': 'fastly'},
    headers={'Authorization': 'Bearer sr_live_your_token_here'},
)

data = response.json()
items = data['items']`}
                responseExample={`{
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
}`}
                notes={[
                  "Supported filters include q, technology, cdn, server, plugin, theme, cpe, statusCode, from, to, cursor, and limit.",
                  "Use GET /targets/:canonicalTargetId/history to inspect the scan history for a specific canonical target.",
                ]}
              />
            </section>

            <section id="token-management" className="scroll-mt-24">
              <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
                <CardHeader>
                  <CardTitle className="text-lg text-[var(--foreground)]">Token management</CardTitle>
                  <CardDescription className="text-[var(--text-dim)]">
                    Token CRUD is part of the same API surface, but it is intentionally session-authenticated rather than bearer-authenticated.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <TokenEndpointCard 
                      method="GET" 
                      path="/tokens" 
                      description="List the tokens owned by the signed-in user."
                      responseExample={`{
  "items": [
    {
      "id": "0f5d7a0c-8eb9-4d92-9f61-76e2f5a29b10",
      "name": "Automation script",
      "tokenHint": "sr_live_abcd12",
      "lastUsedAt": "2026-03-23T12:00:00Z",
      "createdAt": "2026-03-20T10:00:00Z"
    }
  ]
}`}
                    />
                    <TokenEndpointCard 
                      method="POST" 
                      path="/tokens" 
                      description="Create a new token and reveal the full value once."
                      responseExample={`{
  "token": {
    "id": "0f5d7a0c-8eb9-4d92-9f61-76e2f5a29b10",
    "name": "Automation script",
    "tokenHint": "sr_live_abcd12",
    "lastUsedAt": null,
    "createdAt": "2026-03-23T12:00:00Z"
  },
  "plainTextToken": "sr_live_secret_abc123xyz..."
}`}
                    />
                    <TokenEndpointCard 
                      method="DELETE" 
                      path="/tokens/:tokenId" 
                      description="Delete an existing token permanently."
                      responseExample={`{
  "deletedTokenId": "0f5d7a0c-8eb9-4d92-9f61-76e2f5a29b10"
}`}
                    />
                  </div>
                  <CodeBlock>{`Use /settings/tokens in the authenticated web app for token management.

If you call these routes outside the browser, send your session cookie.
Bearer tokens cannot create, list, or delete tokens.`}</CodeBlock>
                </CardContent>
              </Card>
            </section>

            <section id="error-handling" className="scroll-mt-24">
              <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
                <CardHeader>
                  <CardTitle className="text-lg text-[var(--foreground)]">Error handling</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CodeBlock>{`{
  "error": {
    "code": "invalid_target",
    "message": "One or more targets could not be normalized.",
    "details": {}
  }
 }`}</CodeBlock>
                  <div className="grid gap-2 text-xs text-[var(--text-dim)] md:grid-cols-2">
                    <p><code className="text-[var(--foreground)]">invalid_api_token</code> — token invalid, deleted, or no longer active</p>
                    <p><code className="text-[var(--foreground)]">invalid_authorization_header</code> — malformed Authorization header</p>
                    <p><code className="text-[var(--foreground)]">invalid_target</code> — target URL could not be processed</p>
                    <p><code className="text-[var(--foreground)]">scan_not_found</code> — requested scan does not exist or is not visible</p>
                    <p><code className="text-[var(--foreground)]">forbidden</code> — insufficient permissions</p>
                    <p><code className="text-[var(--foreground)]">unauthenticated</code> — no valid auth provided</p>
                  </div>
                </CardContent>
              </Card>
            </section>

            {!tokensEnabled && (
              <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
                <CardHeader>
                  <CardTitle className="text-lg text-[var(--foreground)]">Token access is disabled for this account</CardTitle>
                  <CardDescription className="text-[var(--text-dim)]">
                    You can still review the API shape here, but you will need an admin to re-enable token access before you can authenticate with a bearer token.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function EndpointCard({
  title,
  description,
  method,
  path,
  curlExample,
  jsExample,
  pythonExample,
  responseExample,
  notes,
  isSSE = false,
}: {
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
}) {
  return (
    <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg text-[var(--foreground)]">{title}</CardTitle>
          <span className="rounded-full border border-[var(--gray-border)] px-2 py-0.5 text-[10px] font-mono text-[var(--accent)]">
            {method} {path}
          </span>
        </div>
        <CardDescription className="text-[var(--text-dim)]">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ExampleBlock label="curl" code={curlExample} />
        <ExampleBlock label="JavaScript / TypeScript" code={jsExample} />
        <ExampleBlock label="Python" code={pythonExample} />
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--accent)]">
            {isSSE ? "Event stream response" : "Response"}
          </p>
          <CodeBlock>{responseExample}</CodeBlock>
        </div>
        <ul className="space-y-1 text-xs text-[var(--text-dim)]">
          {notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function TokenEndpointCard({ 
  method, 
  path, 
  description,
  responseExample,
}: { 
  method: string
  path: string
  description: string
  responseExample: string
}) {
  return (
    <div className="rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-[var(--foreground)]">{method} {path}</p>
        <p className="mt-1 text-xs text-[var(--text-dim)]">{description}</p>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-medium text-[var(--text-dim)] uppercase tracking-wide">Response</p>
        <CodeBlock>{responseExample}</CodeBlock>
      </div>
    </div>
  )
}

function ExampleBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[var(--accent)]">{label}</p>
      <CodeBlock>{code}</CodeBlock>
    </div>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--text-dim)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  )
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-3">
      <code className="whitespace-pre text-xs font-mono text-[var(--foreground)]">{children}</code>
    </div>
  )
}
