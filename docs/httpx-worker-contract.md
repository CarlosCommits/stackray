# Stackray httpx Worker Contract

## Purpose

This document defines exactly what Stackray will ask `httpx` to probe, what the worker should return, and which parts of the raw `httpx` output become first-class product data.

The goal is to make the worker contract stable enough that the UI, API, agent CLI, and database schema can all be built against real `httpx` behavior rather than assumptions.

## Source of truth in the httpx repo

The authoritative `httpx` result structure is `runner.Result` in `httpx/runner/types.go`.

Important implementation references:

- `httpx/runner/types.go` — canonical result fields
- `httpx/runner/options.go` — available options, probes, and `OnResult` callback
- `httpx/runner/runner.go` — result assembly and JSON output
- `httpx/examples/simple/main.go` — library usage example
- `httpx/README.md` — CLI flags and output behavior

## Execution choice for Stackray

### V1 recommendation: CLI JSONL first

Even though `httpx` can be used as a Go library through `runner.New(...)`, `RunEnumeration()`, and `OnResult`, Stackray should prefer spawning the `httpx` CLI and parsing JSONL output in v1.

Reasons:

- the `httpx` project explicitly warns that it was built primarily as a standalone CLI and that running it as a service can pose security risks
- CLI JSON output is first-class and already uses the same `runner.Result` model
- subprocess execution gives Stackray a cleaner fault boundary and simpler worker lifecycle management
- CLI execution keeps the Stackray worker contract stable even if we later swap the internal implementation language of the worker

### Future option: library mode

Library integration remains useful if we later need tighter callback control, lower subprocess overhead, or deeper progress instrumentation. If we ever switch, the worker must still emit the same normalized Stackray envelope described below.

## What Stackray will probe

Stackray has one primary use case — identify what a site appears to be built with — but we also want to capture adjacent OSINT and infrastructure signals that `httpx` makes cheaply available.

### Default product profile: `stack-deep`

This is the baseline profile for a user clicking “Scan” in the UI.

Default probes/signals:

- technology detection via `-td` / Wappalyzer-backed identification
- page title
- status code
- content length
- content type
- response time
- redirect location and final URL
- server banner
- CDN/WAF detection
- IP and CNAME resolution
- ASN lookup
- TLS grab
- WordPress plugin/theme detection when available
- favicon hashing (MMH3 and MD5)
- JARM TLS fingerprinting
- CPE detection
- DNS enrichment such as A, AAAA, CNAME, and resolver visibility
- HTTP/2, pipeline, WebSocket, and virtual host capability flags
- redirect chain details
- content hashes
- CSP-derived domains when enabled
- extracted FQDNs/domains from body content when enabled

This is intentionally the richer profile rather than a minimal tech-only profile.

### Explicitly not first-class in v1

These remain optional or raw-only until the product proves they are worth a dedicated UI surface:

- screenshots and screenshot bytes
- headless body HTML
- full raw response bodies by default
- trace-level network timing internals
- custom regex extraction outputs beyond raw JSON storage

## Probe-to-product mapping

### 1. Core stack and product signals

These are central to the UI and should have first-class support.

| httpx signal | Notes | Stackray treatment |
|---|---|---|
| `tech` / technology list | Wappalyzer-backed | normalized child table + summary arrays |
| `webserver` | server banner | first-class column |
| `title` | HTML title | first-class column |
| `wordpress` | plugins/themes | normalized child tables |
| `cpe` | common platform enumerations | normalized child table |

### 2. Redirect and response metadata

These are useful both for UX and OSINT.

| httpx signal | Notes | Stackray treatment |
|---|---|---|
| `status_code` | response code | first-class column |
| `location` | immediate redirect location | first-class column |
| `final_url` | landing URL after redirects | first-class column |
| `content_type` | MIME type | first-class column |
| `content_length` | bytes | first-class column |
| `time` | response duration string | normalize into `response_time_ms` plus retain raw in JSON |
| `words`, `lines` | content metrics | first-class columns |
| `method` | request method | first-class column |

### 3. Infrastructure and network signals

These are high-value OSINT for identifying how a site is delivered.

| httpx signal | Notes | Stackray treatment |
|---|---|---|
| `host_ip` | resolved IP | first-class column |
| `a`, `aaaa`, `cname`, `resolvers` | DNS outputs | JSONB columns |
| `asn` | ownership/network data | JSONB column |
| `cdn`, `cdn_name`, `cdn_type` | CDN/WAF classification | first-class columns |
| `tls` | certificate payload | JSONB column |
| `sni` | server name indication | first-class column |
| `jarm_hash` | TLS fingerprint | first-class column |
| `http2`, `pipeline`, `websocket`, `vhost` | protocol/capability probes | first-class booleans |

### 4. Content correlation signals

These help grouping, deduplication, and future search features.

| httpx signal | Notes | Stackray treatment |
|---|---|---|
| `favicon`, `favicon_md5`, `favicon_url`, `favicon_path` | asset correlation | first-class columns |
| `hash` | body/header hashes | JSONB column |
| `body_preview` | safe response preview | first-class column |
| `body_fqdn`, `body_domains` | extracted domains | JSONB columns |
| `csp` | domains referenced by CSP | JSONB column |

### 5. Redirect-chain and response internals

These matter to debugging and richer UI flows.

| httpx signal | Notes | Stackray treatment |
|---|---|---|
| `chain_status_codes` | status codes in redirect chain | JSONB column |
| `chain` | full redirect chain objects | JSONB column |
| `header` / `raw_header` | response headers | JSONB + text columns |
| `stored_response_path` | persisted raw response path | first-class column |

## Normalized Stackray worker envelope

The Stackray worker should not stream raw `httpx` JSON directly to the API/UI. It should emit a normalized envelope with a stable top-level shape.

Recommended shape:

```json
{
  "worker": {
    "engine": "httpx",
    "engineVersion": "v1.9.0",
    "executionMode": "cli-jsonl",
    "profile": "stack-deep"
  },
  "scan": {
    "scanId": "scn_01J...",
    "attemptId": "att_01J...",
    "target": "https://tpss.coop"
  },
  "observation": {
    "timestamp": "2026-03-23T12:00:03Z",
    "input": "https://tpss.coop",
    "url": "https://tpss.coop",
    "finalUrl": "https://tpss.coop",
    "statusCode": 200,
    "title": "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
    "server": "Flywheel/5.1.0",
    "location": null,
    "contentType": "text/html; charset=UTF-8",
    "contentLength": 12345,
    "responseTimeMs": 187,
    "cdn": { "enabled": true, "name": "fastly", "type": "cdn" },
    "dns": {
      "hostIp": "104.18.7.192",
      "a": ["104.18.7.192"],
      "aaaa": [],
      "cname": [],
      "resolvers": ["1.1.1.1:53"]
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
    "cpe": [
      { "cpe": "cpe:2.3:a:...", "vendor": "...", "product": "..." }
    ],
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
    "bodyFqdns": []
  },
  "rawHttpx": {}
}
```

## What goes to the database versus raw JSON

### First-class and searchable

- target identity and URL fields
- status/title/server/content-type/content-length/time
- redirect location/final URL
- technologies
- WordPress plugins/themes
- CPEs
- CDN/WAF identifiers
- favicon hashes
- JARM
- IP/CNAME/ASN/TLS summary fields

### First-class but not necessarily primary search facets in v1

- redirect chain objects
- protocol/capability flags
- CSP/domain extraction lists
- header maps and raw headers
- stored raw response path

### Raw-only for now

- large headless payloads
- full response bodies
- future screenshot/image bytes
- lower-level trace internals

## Nuclei enrichment sharp edge

Stackray now runs nuclei in phases for each result:

- domain-targeted templates against the original registrable domain
- domain-targeted templates against the redirected/final registrable domain when it differs
- URL-targeted templates against the final URL

This currently persists as a single nuclei run row per scan result. That means phase execution is all-or-nothing at the persistence layer.

Example:

- original-domain phase succeeds and produces matches
- final-domain or URL phase later exits non-zero, times out, or otherwise fails at the process level
- the overall nuclei run is marked `failed`
- earlier phase matches are not persisted as partial results

Important clarification:

- this is about phase/process failure, not a template returning no findings
- templates that simply do not match are not considered failures

Future refinement:

- preserve partial matches from completed phases even if a later phase fails
- optionally track per-phase status instead of folding all phases into one run-level status
- make the UI explicit about partial success vs total failure once per-phase persistence exists

## UI implications

Because `httpx` returns more than just technologies, the Stackray UI should treat scan results as a layered intelligence object.

Suggested UI sections per site:

1. **Technology Summary** — technologies, WordPress plugins/themes, CPEs
2. **Delivery & Redirects** — status, final URL, redirect location/chain
3. **Infrastructure** — server, CDN/WAF, ASN, IPs, CNAMEs
4. **TLS & Fingerprints** — TLS issuer/subject summary, JARM, favicon hashes
5. **Content Signals** — title, content type, content length, body preview, hashes
6. **Raw Evidence** — opt-in raw JSON and privileged raw-response references

## Recommended v1 design rule

Stackray should present a concise normalized result first and keep the full `httpx` JSON object attached as evidence. That gives us a product-friendly UI while preserving fidelity to the scanner.
