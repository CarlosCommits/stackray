# Nuclei TXT record fallback

## Summary

Stackray uses Nuclei DNS templates for two related but different jobs:

1. capture TXT record evidence for display on the scan detail page
2. detect technology/service signatures from TXT records, such as Google Workspace verification, Amazon SES, Zoom, Cursor, OpenAI, Stripe, and similar domain verification records

The normal path still starts with Nuclei. The fallback exists for domains where Nuclei does not emit TXT record matches even though the domain has TXT records.

## What went wrong

The issue showed up when a domain with a large TXT record set did not display TXT records on the scan detail page.

- Domains display TXT records when Nuclei emits a `txt-fingerprint` match with `findingKind: "txt_record"` and TXT values in `extractedResults`.
- A domain may fail to display TXT records when Nuclei's TXT lookup emits no answers for the scan, even though `node:dns.resolveTxt(domain)` returns records.

The important debug difference was DNS truncation:

```text
flags: qr tc rd ra; QUERY: 1, ANSWER: 0
```

The `tc` flag is the DNS protocol's truncated-response bit. It is not the same as Nuclei's `-tc` CLI flag, which means `--template-condition`. Removing Nuclei `-tc` would not fix this because the observed problem is a DNS response truncation behavior, not Stackray intentionally truncating persisted Nuclei results.

In practice, domains with large TXT RRsets can produce a truncated DNS response. In the observed failure mode, Nuclei did not emit the full TXT answer set, so Stackray had nothing to persist or render for `txt_record` findings.

## Why service detection is separate from TXT display

Nuclei templates emit findings only when their matchers/extractors produce output. A TXT service-detection template is meant to identify specific signatures, not to act as a guaranteed inventory of every TXT record.

Stackray's scan detail page displays TXT records through the evidence path:

- persisted table: `scan_result_nuclei_matches`
- persisted values: `extracted_results_json`
- finding kind: `txt_record`
- view-model path: `lib/server/scans/scan-detail-view-model.ts`
- UI path: `DnsInfrastructureCard` in `components/scans/scan-detail-sections.tsx`

So if Nuclei does not emit a `txt_record` match, the UI has no TXT values to show, even if a separate service-detection template could theoretically match a specific TXT signature.

## Why we did not add a new storage column

Stackray already has a working TXT display path: `txt_record` findings stored in `scan_result_nuclei_matches.extracted_results_json` render correctly on the `[scanId]` page.

Because of that, the fallback reuses the existing storage and rendering shape instead of adding a separate `scan_results.dns_txt_records` JSON column. This keeps the data model simple and makes fallback TXT records behave like normal Nuclei TXT evidence in downstream read and UI code.

## Current flow

The worker now follows this flow:

1. Run Nuclei normally.
2. Collect all Nuclei matches for the result.
3. For each domain scan subject:
   - if Nuclei already emitted a `txt_record`, reuse those extracted TXT records
   - if Nuclei did not emit a `txt_record`, call `resolveTxt(domain)` from `node:dns/promises`
4. When `resolveTxt(domain)` returns records, synthesize a `ParsedNucleiMatch` using the existing TXT record shape:
   - `templateId: "txt-fingerprint"`
   - `templatePath: "dns/txt-fingerprint.yaml"`
   - `matcherName: "regex-1"`
   - `findingKind: "txt_record"`
   - `subjectType: "domain"`
   - `extractedResults`: all resolved TXT records, joined from DNS TXT chunks
   - `rawJson["stackray-source"]: "node:dns.resolveTxt"`
   - `rawJson["stackray-txt-record-chunks"]`: original TXT chunks for debugging
5. Run YAML-loaded TXT detection rules over the TXT records in TypeScript.
6. Append the synthetic TXT and service matches to the Nuclei match list with deduplication.
7. Persist everything through the existing `scan_result_nuclei_matches` insert path.

The implementation lives in `worker/scan-worker.ts`, primarily around:

- `buildStackrayResolvedTxtMatches(...)`
- `buildStackrayTxtDetectionMatches(...)`
- `collectStackrayResolvedTxtMatches(...)`

## TXT detection rules run in TypeScript

When TXT records come from the fallback resolver, Nuclei templates are not re-run by Nuclei against those records. Stackray has TXT strings in memory, not a Nuclei DNS answer object. Instead, the worker parses selected Nuclei YAML files and applies supported TXT matchers over those strings in TypeScript.

The fallback loader currently reads three sources:

- `${NUCLEI_TEMPLATES_DIR}/dns/txt-service-detect.yaml`
- `worker/nuclei-templates/dns/replit-dns-verification.yaml`
- `worker/nuclei-templates/dns/stackray-dns-service-detection.yaml`

The worker image clones the pinned upstream `projectdiscovery/nuclei-templates` repository into `/opt/nuclei-templates` and then overlays Stackray's repo-local templates. At runtime, upstream fallback rules come from `${NUCLEI_TEMPLATES_DIR}`. Repo-local fallback rules come from the worker source tree so tests and local development do not depend on the built image overlay.

The parser only imports DNS entries with `type: TXT`. It currently supports matcher `type: word` and `type: regex`. This covers the current upstream `txt-service-detect` template and the current repo-local TXT rules. It intentionally ignores NS, CNAME, MX, RDAP, SSL, and HTTP rules because `node:dns.resolveTxt` cannot supply those signals.

This keeps fallback matching aligned with the same pinned Nuclei template revision that the worker image uses for normal upstream Nuclei scans. When `worker/scanner-pins.json` moves to a newer `nuclei-templates` commit and the worker image is rebuilt, the fallback automatically reads the newer pinned upstream `txt-service-detect.yaml`.

These rules cover upstream-style TXT service signatures, such as:

- `google-site-verification` -> `google-workspace`
- `stripe-verification` -> `stripe`
- `apple-domain-verification` -> `apple`
- `openai-domain-verification` -> `openai`
- `twilio-domain-verification` -> `twilio`
- `atlassian-domain-verification` -> `atlassian`
- `canva-site-verification` -> `canva`

The repo-local YAML sources cover Stackray-specific TXT signatures that are not fully covered by upstream, including:

- Amazon SES via `amazonses:` and `include:amazonses.com`
- Pardot Mail via Pardot verification and SPF include values
- Mailgun via SPF includes for `mailgun.org`
- Proofpoint via SPF includes under `spf.has.pphosted.com`
- Zoom via `ZOOM_verify_`
- Cursor via formatted `cursor-domain-verification-<suffix>=<token>` TXT verification values
- Replit via `replit-verify=<token>`

`worker/nuclei-templates/dns/stackray-dns-service-detection.yaml` also contains NS and CNAME matchers for services such as Amazon Route 53, Microsoft Azure DNS, and Convex. Those matchers run during normal Nuclei execution, but the TXT fallback does not import them because it only has TXT records.

Generated fallback findings preserve the source template:

- upstream TXT service matches use `templateId: "txt-service-detect"` and `findingKind: "dns_service"`
- Stackray DNS service matches use `templateId: "stackray-dns-service-detection"` and `findingKind: "dns_service"`
- Replit matches use `templateId: "replit-dns-verification"` and `findingKind: "technology"`
- `matcherName`: the service identifier or display name

When service detections are derived from resolver fallback records, `rawJson["stackray-source"]` is `"node:dns.resolveTxt"`. When they are derived from a Nuclei-provided `txt_record`, the source is `"stackray:existing-txt-record"`.

## Why both Nuclei TXT and fallback matching exist

The fallback is not a second Nuclei run. Normal Nuclei execution still owns the full DNS/template surface:

- CNAME service detection through `dns-saas-service-detection`
- MX service detection through `mx-service-detector`
- TXT inventory through `txt-fingerprint`
- upstream TXT services through `txt-service-detect`
- repo-local Replit TXT detection
- repo-local Stackray DNS service detection, including TXT, NS, and CNAME entries
- RDAP lookup through `rdap-whois`

The fallback only handles the case where TXT strings are available from either an existing Nuclei `txt_record` match or `node:dns.resolveTxt`. Because of that, fallback matching is limited to YAML rules that can be evaluated against raw TXT strings.

## Deduplication behavior

Fallback matches are appended with `appendUniqueNucleiMatches(...)` before persistence.

The dedupe behavior is intentional:

- `txt_record` findings dedupe by subject, so a domain gets at most one TXT record evidence row from this path.
- `dns_service` findings dedupe by finding kind, canonical service name, and subject, so aliases such as `zoom-alternative` and `Zoom` merge into one service row while preserving combined extracted evidence.
- If Nuclei already emitted TXT records, Stackray derives service detections from those records but does not synthesize another `txt_record` row.

## Known limitations

- This fallback only runs for domain subjects in the Nuclei enrichment flow.
- It is opportunistic: if `resolveTxt(domain)` fails, Stackray keeps the normal Nuclei results and does not fail the scan.
- Fallback parity depends on selected TXT templates remaining parseable as TXT `type: word` or `type: regex` matchers with names. If a selected template adds matcher types such as DSL, negative matchers, or condition semantics that matter for TXT matching, the loader may need to learn those shapes or reject the template loudly.
- The fallback does not fix Nuclei's DNS truncation behavior itself; it works around missing Nuclei TXT output by using Node DNS resolution for TXT inventory and then reusing Stackray's existing TXT persistence path.

## How to verify

Focused tests live in `worker/scan-worker.test.ts` and cover:

- materializing TXT service matches from TXT strings
- loading upstream and repo-local TXT rules from YAML
- applying both word and regex matchers
- preserving source template IDs on fallback matches
- synthesizing `txt-fingerprint` / `txt_record` rows from resolved TXT records
- preserving TXT chunk debug information
- deriving service matches from existing Nuclei `txt_record` evidence
- deriving Replit technology matches from repo-local TXT YAML
- avoiding duplicate `txt_record` rows for duplicate subjects

Useful commands:

```bash
pnpm test -- worker/scan-worker.test.ts worker/nuclei.test.ts
pnpm typecheck
pnpm lint
BETTER_AUTH_SECRET=<local-secret> pnpm build
```
