# Browser Technology Sweep Reference

Use this reference for Stackray manual browser sweeps. Keep outputs small and targeted.

## Subagent Prompt

```text
Use agent-browser to manually inspect <domains>. Also query the local Stackray DB for the latest completed scan results for those domains. Report:
1. Browser-evidenced technologies with exact signals: script URLs, globals, cookies/storage keys, DOM markers, resource URLs, headers.
2. Technologies already detected by Stackray, including `source = nuclei` DNS/TXT promotions.
3. Persisted TXT records and DNS service findings from the Stackray scan, with token-like values redacted.
4. BuiltWith leads that look like DNS/TXT services and whether TXT evidence confirms or rejects them.
5. Conservative missing detections worth adding, with the correct layer: Wappalyzer fields for runtime signals or Nuclei YAML/TXT fallback rules for DNS evidence.
6. Noisy signals to avoid, especially logos, testimonials, broad text, bundle-only product names, and BuiltWith-only claims without public browser or DNS evidence.

Do not edit files.
```

## Local Baseline Commands

Find running services:

```bash
tmux ls
docker compose -f docker-compose.dev.yml ps --services --filter status=running
```

Check worker scanner path:

```bash
docker compose -f docker-compose.dev.yml exec -T worker-browser sh -lc 'pwd && httpx -version'
docker compose -f docker-compose.dev.yml exec -T worker-http sh -lc 'pwd && httpx -version'
```

Use the app's local database connection from `.env.local`. Query exact table names from `drizzle/schema.ts` when unsure. Useful targets are latest scan rows, scan results, technology detections, Nuclei matches, and TXT records.

## DNS TXT Baseline Commands

Always inspect DNS/TXT evidence during a sweep. Stackray can promote DNS services to technologies from Nuclei matches, and BuiltWith often reports DNS, email, verification, AI, and infrastructure services that will not appear in browser JavaScript.

For a result ID, list persisted TXT records, DNS service matches, and nuclei-promoted technologies:

```bash
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d stackray -P pager=off -F $'\t' -A <<'SQL'
WITH selected_result AS (
  SELECT '<result-id>'::uuid AS result_id
)
SELECT
  'technology' AS row_type,
  d.name,
  d.version,
  d.source,
  NULL::text AS template_id,
  NULL::text AS matcher_name,
  NULL::text AS finding_kind,
  NULL::text AS subject,
  NULL::jsonb AS extracted_results_json
FROM selected_result sr
JOIN scan_result_detections d ON d.result_id = sr.result_id
WHERE d.kind = 'technology' AND d.source = 'nuclei'
UNION ALL
SELECT
  'nuclei_match' AS row_type,
  m.technology_name AS name,
  m.technology_version AS version,
  NULL::text AS source,
  m.template_id,
  m.matcher_name,
  m.finding_kind,
  m.subject,
  m.extracted_results_json
FROM selected_result sr
JOIN scan_result_nuclei_matches m ON m.result_id = sr.result_id
WHERE m.finding_kind IN ('txt_record', 'dns_service', 'technology')
ORDER BY row_type, template_id, matcher_name, name;
SQL
```

For a domain list, resolve current root TXT records as live DNS evidence when persisted Stackray TXT evidence is missing or the DNS phase failed/skipped:

```bash
node - <<'NODE'
const { resolveTxt } = require('node:dns/promises')
const domains = ['example.com']

for (const domain of domains) {
  try {
    const chunks = await resolveTxt(domain)
    const records = chunks.map((chunk) => chunk.join(''))
    console.log(JSON.stringify({ domain, records }, null, 2))
  } catch (error) {
    console.log(JSON.stringify({ domain, error: error.code || error.message }))
  }
}
NODE
```

When reporting TXT evidence, redact token-like content. Keep only stable provider-identifying fragments such as `openai-domain-verification=...`, `google-site-verification=...`, `MS=ms...`, `v=spf1 include:_spf...`, or a provider hostname in the value.

Compare the persisted TXT evidence and live DNS evidence against:

- accepted technologies in `scan_result_detections` with `source = 'nuclei'`
- DNS service matches in `scan_result_nuclei_matches.finding_kind = 'dns_service'`
- repo-local TXT rules in `worker/nuclei-templates/dns/stackray-dns-service-detection.yaml`
- upstream/fallback TXT rules loaded by `worker/txt-fallback.ts`

If a TXT value clearly identifies a public service but has no promoted technology, add or update a YAML rule. Use `worker/nuclei-templates/dns/stackray-dns-service-detection.yaml` for Stackray-owned root TXT signatures that should work in normal Nuclei and the TXT fallback. Keep root fallback-compatible entries as `name: "{{FQDN}}"`, `type: TXT`, and `word` or `regex` matchers unless you also update fallback parser tests.

## When No Local Scan Exists

If the user asks for a comparison and the target has no completed local Stackray scan, first create a baseline scan when possible. This gives the manual sweep a real Stackray result to compare against.

Use the running local app and an available session or API key:

```bash
curl -X POST "$STACKRAY_BASE_URL/api/v1/scans" \
  -H "Authorization: Bearer $STACKRAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"target":"https://example.com","options":{"followRedirects":true,"includeRawResponse":false,"headless":false},"idempotencyKey":"manual-tech-sweep-example-com","client":{"source":"cli"}}'
```

Then wait for completion through the API, SSE events, UI, or local DB before doing the comparison:

```bash
curl "$STACKRAY_BASE_URL/api/v1/scans/<scanId>/report" \
  -H "Authorization: Bearer $STACKRAY_API_KEY"
```

If auth is unavailable, the app is not running, or the scan cannot be created without user input, state that the Stackray baseline is missing. Continue with `agent-browser` evidence and worker `httpx -tdh -cff` proof, but label the result as provisional and do not claim "Stackray missed X" until a real Stackray scan or equivalent worker path proves the baseline.

## Agent-Browser Extraction

Open and wait:

```bash
agent-browser --session tech-sweep open "https://example.com"
agent-browser --session tech-sweep wait --load networkidle
agent-browser --session tech-sweep snapshot -i -u
```

Targeted extraction:

```bash
agent-browser --session tech-sweep eval 'JSON.stringify((()=>{const pattern=/(vendor|package|signal)/i; const html=document.documentElement.outerHTML; const scripts=[...document.scripts].map((s)=>s.src||s.textContent||"").filter(Boolean); const resources=performance.getEntriesByType("resource").map((r)=>r.name); return {url:location.href,title:document.title,windowKeys:Object.getOwnPropertyNames(window).filter((key)=>pattern.test(key)),storageKeys:[...Object.keys(localStorage),...Object.keys(sessionStorage)].filter((key)=>pattern.test(key)),cookieMatches:document.cookie.split("; ").filter((cookie)=>pattern.test(cookie)),htmlMatches:[...new Set(html.match(new RegExp(".{0,100}"+pattern.source+".{0,140}","gi"))||[])].slice(0,30),scriptMatches:scripts.filter((value)=>pattern.test(value)).slice(0,50),resourceMatches:resources.filter((value)=>pattern.test(value)).slice(0,100)};})(),null,2)'
```

Use multiple narrow regexes instead of one broad dump. Good patterns include exact vendor domains, package scopes, cookie prefixes, and API hostnames.

## Evidence Rules

Prefer these signals:

- `scriptSrc`: exact CDN/package/vendor JavaScript URL.
- `js`: stable browser global such as `__STATSIG__` or `Munchkin`.
- `cookies`: product-specific cookie names.
- `html` or `dom`: product-specific attributes or script tags.
- `scripts`: fetched script body strings only when specific and stable.
- Nuclei YAML: DNS/TXT/CNAME/MX/NS verification or provider records.

Reject these signals:

- customer logo filenames such as `salesforce.svg`, `stripe-logo.svg`, or `intercom-card.png`
- testimonial text and customer lists
- broad product words in marketing copy
- generic keys such as `session`, `visitor`, `analytics`, or `next`
- same-origin bundle chunks that merely mention a vendor integration by name

## Worker Runtime Proof

Use `-tdh` for browser/runtime detections:

```bash
printf '%s\n' https://www.example.com \
| docker compose -f docker-compose.dev.yml exec -T worker-browser sh -lc 'httpx -json -tdh -cff lib/server/scans/custom-wappalyzer-fingerprints.json -silent -timeout 35 -retries 0' \
| node -e 'const fs=require("fs"); const wanted=/Technology A|Technology B/; for (const line of fs.readFileSync(0,"utf8").split(/\n/).filter(Boolean)) { const j=JSON.parse(line); const tech=Array.isArray(j.tech)?j.tech:[]; console.log(`${j.url||j.input}: ${tech.filter((item)=>wanted.test(String(item))).toSorted().join(", ") || "none"}`); }'
```

Run a multi-domain proof after implementation:

```bash
printf '%s\n' https://site-a.com https://site-b.com \
| docker compose -f docker-compose.dev.yml exec -T worker-browser sh -lc 'httpx -json -tdh -cff lib/server/scans/custom-wappalyzer-fingerprints.json -silent -timeout 35 -retries 0'
```

## Test Set

Run the narrow tests for the touched layer:

```bash
pnpm vitest run lib/server/scans/custom-wappalyzer-fingerprints.test.ts lib/server/scans/technology-metadata-catalog.test.ts
pnpm vitest run worker/nuclei.test.ts worker/scan-worker.test.ts
```

For TXT/DNS rules, also validate the template in the worker image or with the pinned local Nuclei binary:

```bash
docker compose -f docker-compose.dev.yml exec -T worker-intel sh -lc 'nuclei -t worker/nuclei-templates/dns/stackray-dns-service-detection.yaml -validate'
```

Then run:

```bash
pnpm lint
pnpm typecheck
```

## Final Report Shape

Include:

- latest scan IDs/results used for comparison
- technologies added and which domains proved them
- exact worker proof summary from `httpx -tdh`
- tests run
- rejected noisy signals
- DNS TXT status: persisted TXT evidence checked, accepted TXT/DNS promotions, rejected TXT leads, and any live DNS evidence that was not in the local scan
- whether workers/new scans are needed for the UI to show the new detections
