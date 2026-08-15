---
name: stackray-technology-detection
description: Stackray workflow for adding, fixing, or verifying technology detection rules across Wappalyzer/httpx, Nuclei DNS/HTTP templates, TXT fallback signatures, metadata, scanner pins, and real scanner output. Use this whenever the user asks to add a new technology, compare BuiltWith/Wappalyzer/Stackray results, investigate why Stackray missed a technology, inspect a website for tech signatures, update custom-wappalyzer-fingerprints.json or custom-technology-metadata.json, add DNS/TXT service detection, or prove a detector works in httpx/Nuclei/Stackray. Always use this for Stackray technology-signature work even if the user only says “add detection for X” or “BuiltWith found X but Stackray didn’t.”
---

# Stackray Technology Detection

Use this skill to make technology detection changes in Stackray without re-discovering the process each time.

The goal is not merely to add a JSON entry. The goal is to prove, with real evidence, which Stackray detection layer should change and that the final scanner output contains the expected technology.

## Start with the repo guide

Read `docs/technology-detection.md` before changing detection code. If TXT records, DNS verification records, or DNS services are involved, also read `docs/nuclei-txt-record-fallback.md`.

Treat the repo docs as the source of truth. This skill is the execution checklist; if it disagrees with `docs/technology-detection.md`, follow the doc and update this skill after the task.

The repo guide separates these concerns:

1. `httpx` / Wappalyzer detection emits names into `payload.tech`.
2. Nuclei templates emit DNS/HTTP findings that Stackray can promote into technology detections.
3. Stackray metadata enrichment turns a detected name into display details.
4. Scanner pins choose which `httpx`, `nuclei`, `subfinder`, and nuclei-template revisions the worker builds and deploys.

Keep those layers separate. Do not hand-edit `lib/server/scans/generated/wappalyzer-catalog.json`.

Stackray currently has three `httpx` technology-detection surfaces that all receive `-cff`:

1. primary HTTP/body detection with `-td`
2. selected-result screenshot capture with `-td -screenshot`
3. selected-result runtime enrichment with `-tdh`

Do not assume a rule that works in one path works in all paths. Browser globals, rendered DOM, post-load cookies, observed `scriptSrc`, script bodies, and CSS bodies usually require the headless/runtime path. If the evidence is not exposed to Wappalyzer even through `-tdh`, change the `httpx` fork and follow the scanner-pin workflow.

## Research in parallel

Run research before deciding where to edit. Use background agents and direct tools together:

### Codebase research

Launch an `explore` agent to find local patterns:

```text
Find existing Stackray technology detection custom fingerprint, metadata, test, and worker verification patterns relevant to adding <Technology>.
Check docs/technology-detection.md, lib/server/scans, worker tests, package scripts, and whether the generated catalog already contains <Technology>.
```

Directly inspect the key files when needed:

- `lib/server/scans/custom-wappalyzer-fingerprints.json`
- `lib/server/scans/custom-technology-metadata.json`
- `lib/server/scans/generated/wappalyzer-catalog.json`
- `lib/server/scans/technology-metadata-catalog.test.ts`
- `worker/nuclei.ts`
- `worker/nuclei.test.ts`
- `worker/nuclei-templates/`
- `worker/scan-worker.test.ts`
- `worker/scan-worker.ts`
- `docs/technology-detection.md`
- `docs/nuclei-txt-record-fallback.md`
- `package.json`

Use direct search tools for targeted checks while agents handle broader research:

```bash
rg -n "<Technology>|<known-signal>|custom-wappalyzer|nuclei|TXT|dns_service" docs lib worker scripts package.json
sg --pattern 'describe($NAME, $$$)' --lang ts 'lib/server/scans/*.test.ts'
```

Do not stop at the first match. Cross-check the generated catalog, custom fingerprints, metadata, tests, and worker paths before editing.

### External Wappalyzer research

Launch a `librarian` agent to check upstream and related catalogs:

```text
Research upstream Wappalyzer/wappalyzergo/webappanalyzer entries for <Technology> and similarly named products.
Report exact rule shape, category IDs, website, icon, metadata, and whether the technology is absent upstream.
```

Distinguish similarly named products. For example, Clerk auth and Clerk.io personalization are different products.

### Product signature research

Launch another `librarian` agent for product-specific signals:

```text
Research stable public detection signatures for <Technology>: official docs, GitHub examples, scripts, cookies, headers, globals, DOM markers, package names, and CDN URLs.
Rank signals by reliability and flag overly broad substrings.
```

Prefer official docs and source code. Avoid rules based only on a product name appearing in prose.

## Manually inspect the target site when one is provided

If the user gives a real site, inspect it in a browser using `agent-browser` or any browser connected to the agent. This is often the missing piece for modern JavaScript apps.

Recommended `agent-browser` flow:

```bash
agent-browser --session tech-detect open "https://example.com"
agent-browser --session tech-detect wait --load networkidle
agent-browser --session tech-detect snapshot -i -u
agent-browser --session tech-detect eval 'JSON.stringify((()=>{const pattern=/<technology-or-signal>/i; const html=document.documentElement.outerHTML; const scripts=[...document.scripts].map((s)=>s.src||s.textContent||"").filter(Boolean); const resources=performance.getEntriesByType("resource").map((r)=>r.name); return {url:location.href,title:document.title,windowKeys:Object.getOwnPropertyNames(window).filter((key)=>pattern.test(key)),storageKeys:[...Object.keys(localStorage),...Object.keys(sessionStorage)].filter((key)=>pattern.test(key)),cookieMatches:document.cookie.split("; ").filter((cookie)=>pattern.test(cookie)),htmlMatches:[...new Set(html.match(new RegExp(".{0,100}"+pattern.source+".{0,140}","gi"))||[])].slice(0,30),scriptMatches:scripts.filter((value)=>pattern.test(value)).slice(0,50),resourceMatches:resources.filter((value)=>pattern.test(value)).slice(0,100)};})(),null,2)'
```

Replace `<technology-or-signal>` with a safe regex such as `clerk`, `@clerk`, `stripe`, or a package/domain-specific marker. Record the exact evidence: script URL, cookie name, header, global, DOM selector, or bundle string. Avoid dumping an entire page unless a targeted extraction fails.

## Decide the correct layer

Use this decision table:

| Evidence / gap | Change |
|---|---|
| Stackray already receives the correct tech name but display is poor | Edit `custom-technology-metadata.json` only |
| Signal fits Wappalyzer fields: headers, cookies, HTML, meta, `scriptSrc`, `js`, `dom`, `scripts`, `css` | Edit `custom-wappalyzer-fingerprints.json` |
| Signal is a DNS service, DNS verification record, CNAME/MX/NS/TXT answer, or domain metadata | Use an upstream or repo-local Nuclei template under `worker/nuclei-templates/` and register it in `worker/nuclei.ts` |
| Signal is TXT-based and should survive Nuclei TXT truncation/missing TXT output | Put the signature in YAML as a TXT DNS entry using supported fallback matchers; do not add hardcoded worker constants |
| Signal requires browser-evaluated evidence such as `js`, rendered `dom`, post-load cookies, observed `scriptSrc`, or collected script bodies | Use the headless `httpx -tdh` path for verification; change the `httpx` fork only if `-tdh` still does not expose the evidence |
| Signal requires runtime/browser evidence not currently exposed to Wappalyzer even in `-tdh` | Change the `httpx` fork and follow scanner-pin workflow |
| Upstream metadata exists and is good enough | Do not duplicate metadata locally |
| Upstream detector exists but Stackray still misses a real site | Add a conservative custom fingerprint if real evidence fits available fields; otherwise investigate the fork |

For custom fingerprints and Nuclei matcher names that become technologies, use the public display name Stackray should show. Use Wappalyzer category labels or existing Stackray taxonomy labels. Add metadata only if generated Wappalyzer metadata is missing or wrong.

### Preserve upstream Wappalyzer evidence when extending a technology

The pinned Stackray `httpx` fork merges custom fingerprints into its embedded WappalyzerGo catalog; a custom entry with an existing technology name is not an isolated second detector.

- Array fields such as `html`, `scriptSrc`, `scripts`, `css`, and `implies` append unique custom values to the upstream values.
- Map fields such as `headers`, `cookies`, and `js` replace the upstream value when the custom rule uses the same map key.
- DOM selectors merge only one level deep. For the same selector, a custom nested object such as `attributes` replaces the upstream `attributes` object rather than merging each attribute independently.

Before adding or changing a custom fingerprint for a technology that already exists upstream:

1. Inspect the exact fingerprint in the pinned WappalyzerGo revision used by the pinned `httpx` fork. Do not compare only against current upstream `main`.
2. Prefer adding evidence through append-only array fields when that evidence is sufficient.
3. If a custom map key or DOM selector must replace upstream data, carry forward every upstream matcher that should remain active, especially `version` directives.
4. Add a focused regression test proving the upstream evidence still detects the technology and still extracts its version after the custom evidence is merged.
5. For package or CDN URLs, keep moving aliases such as `latest`, `next`, or similar channel names detectable without emitting those aliases as versions. Capture a version only when the matched evidence contains an exact version with the precision Stackray will display and future CVE selection can safely use.

Treat loss of an upstream matcher or version directive as a regression even when the new custom signal successfully detects the technology.

Custom metadata supports sparse overrides. If the generated Wappalyzer catalog already has the correct name, description, website, categories, CPE, and implied technologies, override only the field that needs changing. For an icon-only fix, add just:

```json
{
  "baseui": {
    "icon": "https://base-ui.com/static/apple-touch-icon.png"
  }
}
```

Do not copy a full generated catalog record into `custom-technology-metadata.json` merely to fix an icon. Full local copies freeze upstream metadata and make future catalog refreshes less useful.

Treat icons as a verified metadata field, not a guess. Do not assume `https://example.com/favicon.ico` works. Prefer an existing Wappalyzer/simple-icons icon, an official brand asset, or an icon URL advertised by the product page. For any remote icon URL you add, verify it returns `200` with an image content type and is suitable for a compact technology-list icon. If a favicon-like asset is the only good option, use the exact page-advertised URL after verification rather than inventing `/favicon.ico`.

## TXT and DNS detection

For DNS-based detections, prefer Nuclei YAML over TypeScript logic.

Stackray-owned Nuclei templates live under `worker/nuclei-templates/` and must be registered in `NUCLEI_TEMPLATE_DEFINITIONS` in `worker/nuclei.ts` when they should run during normal scanner execution. Use:

- `findingKind: "technology"` when the matcher name is already the technology name.
- `findingKind: "dns_service"` when the matcher name is a DNS provider/service that should be promoted into a `source: "nuclei"` technology.
- Evidence-only kinds such as `txt_record`, `ssl_issuer`, `robots_txt`, or `domain_metadata` when the finding should not itself become a technology.

### TXT fallback contract

TXT records have a special post-Nuclei fallback in `worker/scan-worker.ts`.

Normal Nuclei execution still owns the full DNS/template surface: TXT, MX, NS, CNAME, RDAP, SSL, and HTTP templates. After Nuclei finishes, Stackray:

1. reuses Nuclei `txt_record` extracted TXT strings when present
2. otherwise calls `node:dns.resolveTxt(domain)`
3. applies YAML-loaded TXT rules over those TXT strings in TypeScript
4. persists the resulting synthetic/fallback matches through the normal Nuclei match tables

The fallback loader currently reads TXT rules from:

- pinned upstream `dns/txt-service-detect.yaml`
- repo-local `worker/nuclei-templates/dns/replit-dns-verification.yaml`
- repo-local `worker/nuclei-templates/dns/stackray-dns-service-detection.yaml`

The fallback imports only root-domain DNS entries with `name: "{{FQDN}}"` and `type: TXT`, and currently supports matcher `type: word` and `type: regex`. It intentionally does not emulate subdomain-specific TXT, NS, CNAME, MX, RDAP, SSL, or HTTP templates because `node:dns.resolveTxt(domain)` only returns root TXT records.

When adding TXT-based detections:

- Put broad upstream-style signatures upstream when practical.
- Put Stackray-owned TXT signatures in repo-local Nuclei YAML, usually `worker/nuclei-templates/dns/stackray-dns-service-detection.yaml` for DNS services or a dedicated template for a true technology.
- Keep fallback-covered signatures in TXT DNS entries using `word` or `regex` matchers, or update the fallback parser and tests before using new matcher semantics.
- Do not add duplicate hardcoded TXT signature constants in the worker.
- If the same service also has non-TXT evidence, add MX/NS/CNAME entries in YAML for normal Nuclei execution, but remember those entries are not part of the TXT fallback.

Add or update tests in:

- `worker/nuclei.test.ts` for template shape, registration, matcher semantics, and parsing.
- `worker/scan-worker.test.ts` for YAML-loaded TXT fallback behavior, source template preservation, and technology promotion.

## Write conservative detectors

Good detectors combine stable, product-specific evidence:

- exact CDN or package script URL paths
- documented cookie names that are not generic
- product-specific headers
- browser globals or global property paths
- DOM markers or attributes emitted by the product
- bundle strings only when specific enough and collected by the worker
- DNS verification records or provider hostnames documented by the product

Avoid:

- broad words like `Clerk`, `Stripe`, or `React` in arbitrary HTML text
- generic cookies such as `__session` unless paired with stronger evidence
- copied marketing names without a technical signal
- editing generated catalogs by hand
- hardcoded worker-side TXT detection constants that duplicate Nuclei YAML
- DNS guesses that derive unobserved provider domains unless the scan path explicitly collects and proves that evidence

## Add focused tests

Add or update tests that prove the change at the right layer:

- Fingerprint shape/coverage tests for custom entries.
- Metadata tests for canonical name, website, categories, bucket, and icon when metadata changes.
- Nuclei template tests for repo-local template registration, matcher semantics, and parser mapping.
- TXT fallback tests for YAML-loaded word/regex matchers and source template preservation.
- Worker argument tests only if the scan path changed.

Useful commands in Stackray:

```bash
pnpm test -- lib/server/scans/custom-wappalyzer-fingerprints.test.ts lib/server/scans/technology-metadata-catalog.test.ts
pnpm test -- worker/scan-worker.test.ts worker/nuclei.test.ts
nuclei -t worker/nuclei-templates/dns/<template>.yaml -validate
pnpm typecheck
pnpm lint
pnpm build
```

## Prove the detector in the scanner

Finish by testing the real scanner output. Prefer the dev worker container because host `httpx`, `nuclei`, and templates may be unrelated binaries or revisions.

Check the running worker services and scanner versions. Local dev may split workers by role (`worker-http`, `worker-browser`, `worker-intel`) instead of exposing a single `worker` service:

```bash
docker compose -f docker-compose.dev.yml ps --services --filter status=running
docker compose -f docker-compose.dev.yml exec -T worker-http sh -lc "httpx -version"
docker compose -f docker-compose.dev.yml exec -T worker-browser sh -lc "httpx -version"
docker compose -f docker-compose.dev.yml exec -T worker-intel sh -lc "nuclei -version"
```

Use whichever running worker role has the binary and scan path you need. Prefer `worker-http` for primary `-td`, `worker-browser` for `-tdh` and screenshot/browser proof, and `worker-intel` for Nuclei/DNS proof when those services exist.

### HTTP/Wappalyzer detectors

Run before/after when possible:

```bash
# Baseline: no custom fingerprint file
docker compose -f docker-compose.dev.yml exec -T worker-http sh -lc "printf '%s\n' 'https://example.com' | httpx -json -td"

# With Stackray custom fingerprints
docker compose -f docker-compose.dev.yml exec -T worker-http sh -lc "printf '%s\n' 'https://example.com' | httpx -json -td -cff lib/server/scans/custom-wappalyzer-fingerprints.json"
```

For JavaScript-heavy detectors, also prove the headless path because `js`, rendered `dom`, post-load cookies, observed browser `scriptSrc`, and many SPA bundle signals are only available through `-tdh`:

```bash
docker compose -f docker-compose.dev.yml exec -T worker-browser sh -lc "printf '%s\n' 'https://example.com' | httpx -json -tdh -cff lib/server/scans/custom-wappalyzer-fingerprints.json"
```

Success means the JSONL `tech` array includes the expected canonical technology name. Use `-td` for normal HTTP/body evidence and `-tdh` for JS-heavy or browser-collected evidence; run both when unsure which scan path should catch the signal.

If the detector only works through a fork change, run the focused `httpx` fork tests and then follow the scanner-pin workflow from `docs/technology-detection.md`.

### Nuclei DNS/TXT detectors

Validate custom templates:

```bash
nuclei -t worker/nuclei-templates/dns/<template>.yaml -validate
```

When possible, prove real matcher output with the worker container and the same template path Stackray uses:

```bash
docker compose -f docker-compose.dev.yml exec -T worker-intel sh -lc "nuclei -u example.com -t /app/worker/nuclei-templates/dns/<template>.yaml -jsonl -silent"
```

For TXT fallback changes, prove both code paths when feasible:

- A unit test where existing Nuclei `txt_record` evidence is reused.
- A unit test where `node:dns.resolveTxt` returns TXT chunks and fallback emits the expected `txt-fingerprint` evidence plus service/technology matches.
- A live Stackray scan when a known public domain exercises the signal.

For live Stackray proof, inspect `scan_result_nuclei_matches` and technology detections, especially:

- `template_id`
- `matcher_name`
- `finding_kind`
- `extracted_results_json`
- `raw_json["stackray-source"]`

Expected TXT fallback provenance:

- `node:dns.resolveTxt` when resolver fallback collected the TXT records
- `stackray:existing-txt-record` when fallback reused Nuclei `txt_record` output

## Final report

Summarize:

- evidence found on the real site or in docs
- upstream Wappalyzer status
- Nuclei template/fallback status when DNS or TXT is involved
- files changed and why that layer was correct
- tests and scanner commands run
- before/after `payload.tech`, Nuclei match, or Stackray DB proof when available
- any remaining risk, especially false positives or scanner-pin follow-up

Do not claim a detector works until a real `httpx`, Nuclei, Stackray scan, or equivalent worker path proves the expected technology appears.
