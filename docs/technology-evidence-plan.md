# Technology evidence plan

## Goal

Add first-class evidence for each detected technology so the scan detail page can explain why Stackray believes a technology is present. The end state is a Technologies table with reliable evidence such as response headers, script URLs, DNS TXT records, Nuclei matcher output, CPE matches, WordPress inventory, and headless browser signals.

This is intentionally a later project. The current UI can show category, technology, type, version, and sources from existing data, but it should not invent evidence strings.

## Current state

Stackray persists canonical technology rows in `scan_result_detections`. These rows contain `kind`, `name`, `version`, `source`, `slug`, `vendor`, `product`, and `cpe`, but no evidence payload.

Nuclei matches are richer. `scan_result_nuclei_matches` stores `templateId`, `matcherName`, `matchedAt`, `extractedResultsJson`, `rawJson`, `technologyName`, `findingKind`, `subject`, and `subjectType`. We already keep useful evidence there for TXT/DNS service detections, custom DNS templates, RDAP/domain metadata, TLS findings, robots.txt, and some technology templates.

The httpx fork currently emits `tech` as an array of technology names. Its internal `TechnologyDetails` is metadata only and is intentionally excluded from JSONL. `wappalyzergo` returns `AppInfo` with description, website, CPE, icon, and categories, but not matched rule evidence.

The Stackray httpx fork already owns a broader headless technology path. It evaluates JS globals, DOM selectors, browser cookies, same-origin headers, script URLs, script bodies, CSS bodies, and some custom runtime heuristics. Those helpers currently return only match boolean/version data, so evidence must be threaded through intentionally.

## Evidence model

Use a child table rather than overloading `scan_result_detections`.

Suggested table: `scan_result_detection_evidence`

Columns:

- `id`
- `result_id`
- `detection_id` nullable, because evidence can be collected before canonical rows are rebuilt
- `technology_name`
- `technology_version`
- `source`: `wappalyzer`, `headless_wappalyzer`, `headless_heuristic`, `nuclei`, `wordpress`, `cpe`, `derived`
- `surface`: `header`, `cookie`, `html`, `meta`, `script_src`, `script_body`, `css`, `js`, `dom`, `dns_txt`, `dns_mx`, `dns_ns`, `dns_cname`, `tls`, `nuclei_template`, `wordpress_plugin`, `wordpress_theme`, `cpe`, `heuristic`
- `label`: short reader-facing summary
- `key`: header name, cookie name, DOM selector, JS path, meta name, Nuclei matcher name, CPE string, or DNS record type
- `value`: sanitized/truncated value or snippet
- `url` nullable
- `matched_at` nullable
- `template_id` nullable
- `matcher_name` nullable
- `confidence` nullable
- `raw_ref` nullable JSON for non-sensitive pointer data
- `created_at`

Keep evidence values compact. Do not store full response bodies, full script bodies, complete cookie values, authorization headers, or large raw payloads in this table.

## httpx fork work

Add a new explicit output field in `~/projects/httpx`, preferably behind a Stackray-focused flag at first.

Suggested JSON shape:

```json
"tech_evidence": [
  {
    "technology": "Google Tag Manager",
    "version": null,
    "source": "wappalyzer",
    "surface": "script_src",
    "key": "script[src]",
    "value": "https://www.googletagmanager.com/gtm.js?id=GTM-...",
    "confidence": 100
  }
]
```

Implementation notes:

- Do not copy the fingerprint catalog into httpx.
- Use the already-loaded Wappalyzer fingerprints from `GetFingerprints()` and `GetCompiledFingerprints()`.
- For standard `-td`, either re-evaluate the loaded rules in the httpx fork to collect evidence, or patch/fork `wappalyzergo` with `FingerprintWithEvidence`.
- For `-tdh`, extend the existing headless match helpers to return a structured evidence item in addition to version.
- Preserve current `tech` behavior as the canonical compatibility output.
- Add contract tests proving `tech_evidence` exists only when enabled and does not leak internal `TechnologyDetails`.

Sanitization rules:

- Headers: allow safe headers such as `server`, `x-powered-by`, `via`, `x-served-by`, `content-type`; redact security-sensitive headers.
- Cookies: store cookie names only by default.
- Script/CSS/body matches: store URL when available; otherwise store a short snippet around the match with a strict byte limit.
- JS/DOM: store property path or selector and a short value summary.
- Heuristics: store a label and the smallest stable signal, such as `React DOM internal marker` or `TanStack bundle marker`.

## Nuclei work

Nuclei already provides useful evidence for many findings. Stackray currently persists it, then flattens technology matches into `scan_result_detections`.

Implementation notes:

- When inserting `scan_result_nuclei_matches`, also create evidence rows for technology and `dns_service` findings.
- For `technology` findings, map `technologyName` or `matcherName` to the canonical technology name.
- For `dns_service` findings, use `getNucleiDnsServiceTechnologyName` for the promoted technology name.
- Use `extractedResultsJson` as the preferred evidence value when present.
- Fall back to `matchedAt`, `templateId`, and `matcherName` for generic templates that do not extract concrete values.
- Add extractors to Stackray-owned templates where we need better evidence.

## WordPress and CPE work

WordPress plugin and theme rows already have a clear evidence source.

Implementation notes:

- WordPress plugin evidence: `surface = wordpress_plugin`, `key = slug`, `value = plugin slug`.
- WordPress theme evidence: `surface = wordpress_theme`, `key = slug`, `value = theme slug`.
- CPE evidence: `surface = cpe`, `key = cpe`, `value = cpe string`, with vendor/product split into structured columns where available.

## Stackray ingestion work

Update the worker ingestion path after httpx emits `tech_evidence`.

Steps:

1. Add schema and migration for evidence rows.
2. Parse `rawJson.tech_evidence` from httpx result payloads.
3. Insert sanitized evidence rows in the same result transaction as detections.
4. Link evidence to canonical `scan_result_detections` after detection rows are rebuilt.
5. Backfill evidence from existing Nuclei matches where possible.
6. Extend scan result contracts with optional evidence arrays on `technologyDetections`.
7. Update `buildTechnologyDisplayModel` and `buildTechnologySection` to preserve evidence.

## UI work

Once evidence exists, add an Evidence column to the Technologies table.

Display rules:

- Show one compact primary evidence string per row.
- Prefer concrete evidence over generic source labels.
- Use a details drawer/popover for multiple evidence items.
- Keep sensitive values redacted and truncated.
- Let rows show source badges so users can distinguish Wappalyzer, headless, Nuclei, WordPress, and CPE.

## Testing

Add tests at each layer:

- httpx contract tests for JSON shape and redaction.
- httpx unit tests for standard and headless evidence surfaces.
- worker tests for parsing `tech_evidence`.
- Nuclei tests for evidence extraction and promoted DNS service mapping.
- migration/startup migration tests.
- view-model tests for evidence merging and deterministic ordering.
- UI tests for the table, empty evidence, multiple sources, and redacted values.

## Rollout

Ship in phases:

1. Document and table UI without evidence.
2. Nuclei evidence rows, because the data already exists.
3. httpx headless evidence, because Stackray owns that matcher path.
4. standard httpx/Wappalyzer evidence.
5. UI Evidence column and details drawer.
6. Optional historical backfill for recent scans.
