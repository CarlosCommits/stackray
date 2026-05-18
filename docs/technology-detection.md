# Technology detection guide

## Purpose

This document is the operational guide for adding or changing technology detection in Stackray.

Stackray has three related but separate layers:

1. `httpx` detection, which decides which technology names appear in `payload.tech`.
2. Stackray metadata enrichment, which turns a detected name into display details such as description, website, icon, category, and implied technologies.
3. Scanner pinning, which decides which `httpx`, `nuclei`, `subfinder`, and nuclei-template revisions the worker image builds and deploys.

Keep those layers separate when adding a new technology. A detection rule without metadata may find the technology but render poorly. Metadata without a detector may improve display for an existing upstream detection but will not discover anything new.

## Detection sources

### Upstream Wappalyzer catalog

Most HTTP/body technology detection comes from the Wappalyzer-compatible catalog embedded in `wappalyzergo`, which is used by `httpx -td` and `httpx -tdh`.

Stackray also keeps a generated metadata snapshot at:

- `lib/server/scans/generated/wappalyzer-catalog.json`

That generated file is for Stackray enrichment and display. Do not hand-edit it to add custom technologies. Refresh it with:

```bash
pnpm wappalyzer:update-catalog
```

### Custom Wappalyzer fingerprints

Stackray-owned Wappalyzer-compatible detection rules live in:

- `lib/server/scans/custom-wappalyzer-fingerprints.json`

The worker passes this file to `httpx` with `-cff` in both detection paths:

- the primary HTTP/body scan using `-td`
- the selected-result headless scan using `-tdh`

Use this file when the evidence can be expressed as normal Wappalyzer-style signals such as headers, cookies, HTML, script URLs, meta tags, JavaScript globals, DOM markers, or script body patterns that `httpx` already supplies to Wappalyzer.

Custom fingerprint names should match the public display name expected in Stackray, for example `TanStack Start`.

### Custom metadata

Stackray-owned metadata overrides live in:

- `lib/server/scans/custom-technology-metadata.json`

This file is metadata-only. It does not cause a technology to be detected.

Use it when:

- upstream Wappalyzer does not include the technology at all
- upstream metadata exists but Stackray needs a better canonical name, description, category, website, icon, or implied technology list
- a custom `httpx` detector emits a technology name that upstream Wappalyzer does not know about

Metadata is merged in `lib/server/scans/technology-metadata-catalog.ts`. Custom metadata overrides the generated Wappalyzer metadata by normalized key.

### Custom nuclei templates

Stackray-owned nuclei templates live in:

- `worker/nuclei-templates/`

The worker image clones the pinned upstream `projectdiscovery/nuclei-templates` repository and then overlays `worker/nuclei-templates` on top of it. Keep repo-local templates in a path that mirrors the upstream template tree, for example `worker/nuclei-templates/dns/my-service-detector.yaml`.

Register every worker-used template in `NUCLEI_TEMPLATE_DEFINITIONS` in `worker/nuclei.ts`. For repo-local templates, set `repoLocal: true`; this makes Stackray pass the template by path with `-t <path>` instead of by ID with `-id <csv>`. Use the right `subjectType` (`domain` for DNS/domain templates, `url` for HTTP/TLS templates) and the right `findingKind`:

- `technology` when the matcher name is already the technology name and should be treated as a technology template.
- `dns_service` for DNS service/provider templates where the specific service comes from `matcher-name`; Stackray promotes these matcher names into `source: "nuclei"` technology detections.
- A namespaced finding kind such as `txt_record`, `ssl_issuer`, `robots_txt`, or `domain_metadata` when the match is evidence but not itself a technology.

Nuclei template selection uses two different modes:

- `-id <csv>` runs upstream templates by their YAML `id`. Stackray uses this only for non-repo-local templates when no `NUCLEI_TEMPLATES_DIR` is configured.
- `-t <path>` runs an exact template file or directory. Stackray always uses this for repo-local templates, and also uses it for non-repo-local templates when `NUCLEI_TEMPLATES_DIR` points at the pinned template directory.

For grouped DNS service detection, prefer one template with multiple named matchers when the services share the same protocol, severity, target type, and lifecycle. Group matchers by DNS record type, use `matchers-condition: or`, and make each matcher `name` the display name Stackray should promote. Split into separate templates only when the technologies need different scan behavior, phase placement, severity, ownership, or rollout.

Validate custom templates before relying on them:

```bash
nuclei -t worker/nuclei-templates/dns/my-service-detector.yaml -validate
```

Add focused tests in `worker/nuclei.test.ts` for argument construction (`-id` vs `-t`, repo-local path resolution, `templatesDir` behavior) and parser mapping. Add `worker/scan-worker.test.ts` coverage when a nuclei match should become a persisted technology detection.

### Stackray httpx fork

Stackray builds the worker image from the pinned fork and ref in:

- `worker/scanner-pins.json`
- `worker/Dockerfile`
- `worker/Dockerfile.dev`

The fork currently lives at `CarlosCommits/httpx`, branch `dev`. The pin update workflow is:

1. change and push the `httpx` fork
2. the `Notify Stackray scanner update` workflow in `httpx` dispatches Stackray
3. Stackray's `Update scanner pins` workflow opens a scanner-pin PR
4. Stackray CI validates the pin PR, including the real worker scanner image smoke test
5. the trusted scanner-pin auto-merge workflow merges the PR only when the branch, author, file list, semantic diff, checks, and head SHA match the expected automation output

The cross-repo dispatch requires the `STACKRAY_DISPATCH_TOKEN` secret in the `CarlosCommits/httpx` repository.

## Standard vs headless detection

Stackray runs two relevant `httpx` technology detection passes:

1. The primary scan uses `-td` against HTTP response data.
2. The selected-result enrichment pass uses `-tdh` in a browser/headless context and may also capture a screenshot.

Both passes receive the same custom fingerprint file through `-cff`.

That means a custom fingerprint can work in both paths, but only if the needed evidence is present in that path. For example:

- A header rule can work in the primary `-td` pass.
- A simple HTML marker can work in the primary `-td` pass if it is in the original response body.
- A rendered DOM or browser-global signal may only work in `-tdh`.
- A script body marker only works if `httpx` has fetched or observed that script body and fed it into the Wappalyzer `scripts` signal.

Do not assume that adding a `scripts` rule to the custom fingerprint file is enough for modern SPA bundles. If `httpx` does not collect the bundle body for that scan path, Wappalyzer cannot match it.

### What `-tdh` can match from custom fingerprints

The headless `-tdh` pass has a broader evidence surface than the primary `-td` pass. In the Stackray `httpx` fork, custom fingerprints can use these rule shapes against browser-collected evidence:

- `html`: rendered page HTML from the browser.
- `js`: browser-evaluated JavaScript globals and property paths.
- `dom`: rendered DOM selectors, text, attributes, and selected DOM properties.
- `cookies`: browser cookies after the page loads.
- `headers`: same-origin response headers observed by the browser.
- `scriptSrc`: URLs of scripts observed by the browser.
- `scripts`: same-origin script bodies collected from browser network responses or fetched fallback script URLs.
- `css`: same-origin stylesheet bodies observed by the browser.

Use these fields when the detection can be expressed as a pattern over collected evidence. For example, a framework marker inside a loaded JavaScript bundle belongs in `scripts`, not only in `html`.

The fork also contains hard-coded headless heuristics for cases that are not cleanly expressed as a single fingerprint field, such as scoring multiple React runtime symbols, checking private React DOM property prefixes, or combining Vite asset and modulepreload signals. Keep those in the fork unless equivalent custom fingerprints are proven with `httpx` tests and real `payload.tech` output.

## When to change which layer

### Add only metadata

Add or edit `custom-technology-metadata.json` when Stackray already receives the correct technology name from `httpx`, `nuclei`, CPE promotion, or upstream Wappalyzer, but the display details are missing or wrong.

Examples:

- missing icon
- wrong category bucket
- missing description
- implied technologies should be shown in Stackray

### Add a custom fingerprint

Add to `custom-wappalyzer-fingerprints.json` when the technology can be detected from evidence that Wappalyzer already knows how to evaluate in Stackray's scan paths.

Examples:

- a response header
- a cookie name/value
- a meta tag
- a stable HTML marker in server-rendered output
- a script URL
- a JavaScript global that `-tdh` can evaluate
- a bundle string that the `httpx` fork already collects into `scripts`

Also add metadata if upstream Wappalyzer does not already provide it.

### Change the httpx fork

Change the `httpx` fork when the needed evidence is not available to the Wappalyzer rules by default.

Examples:

- browser runtime state
- DOM properties that are not serialized into HTML
- hydrated SPA state
- same-origin JavaScript bundle fetching
- dynamic import discovery
- modulepreload resource discovery
- framework-specific internal properties
- custom runtime heuristics that should emit technology names

If the fork emits a technology name that upstream Wappalyzer does not know, register the name in both:

- `custom-wappalyzer-fingerprints.json`, so the custom catalog knows the technology exists
- `custom-technology-metadata.json`, so Stackray can display it correctly

### Propose upstream changes

Prefer upstream Wappalyzer or `wappalyzergo` changes when the detection is broadly useful, conservative, and expressible in Wappalyzer's catalog model.

Keep Stackray custom rules for:

- technologies not yet accepted upstream
- Stackray-specific heuristics
- faster local iteration
- detection names that depend on custom `httpx` runtime evidence

## Adding a new technology

Use this checklist.

1. Check upstream first.
   - Search `wappalyzergo` or the generated Stackray catalog for the technology name.
   - If upstream already detects it, avoid duplicating the fingerprint locally.

2. Identify the strongest evidence.
   - Headers/cookies/meta/HTML/script URL: use a custom Wappalyzer fingerprint.
   - DNS records or service/provider verification records: use an upstream or repo-local nuclei template.
   - Browser global/rendered DOM/runtime state/bundle internals: update the `httpx` fork.
   - Product metadata only: update the custom metadata catalog.

3. Add detection.
   - For Wappalyzer-compatible rules, edit `lib/server/scans/custom-wappalyzer-fingerprints.json`.
   - For Stackray-owned nuclei rules, add a repo-local template under `worker/nuclei-templates/` and register it in `worker/nuclei.ts`.
   - For browser/runtime/bundle evidence, edit the `httpx` fork and add tests there.

4. Add metadata.
   - Edit `lib/server/scans/custom-technology-metadata.json` if upstream metadata is missing or not good enough.
   - Use the canonical display name as `name`.
   - Use category labels that already exist in Stackray's taxonomy when possible.

5. Add tests.
   - Stackray worker argument tests should confirm `-cff` is passed for relevant scan paths.
   - Nuclei template tests should confirm repo-local `-t` path resolution, parser mapping, and any nuclei-derived technology promotion.
   - Stackray metadata tests should confirm canonicalization, categories, and overrides.
   - `httpx` tests should cover custom runtime or bundle evidence.

6. Verify locally.
   - Run the focused Stackray tests for worker and metadata changes.
   - Validate custom nuclei templates with `nuclei -t <template> -validate` and prove expected real-site matcher output when possible.
   - Run the focused `httpx` tests for fork changes.
   - For a real site, verify the final `payload.tech` contains the expected technology names.

7. Update scanner pins.
   - Push the `httpx` fork branch.
   - Let the Stackray scanner-pin workflow create a PR.
   - Confirm CI passes if you need to review the update manually.
   - The trusted scanner-pin auto-merge workflow should merge routine pin/version-only PRs after validation.

## Current TanStack example

The TanStack additions use all three layers:

- `custom-wappalyzer-fingerprints.json` registers `TanStack Router`, `TanStack Start`, and `TanStack Query` as Wappalyzer-compatible custom technologies.
- `custom-technology-metadata.json` provides their display metadata because upstream Wappalyzer does not currently provide these technologies.
- The `httpx` fork adds SPA/runtime/bundle evidence for TanStack Router, Start, and Query so `-tdh` can detect signals that the normal HTTP response often does not expose.

This shape is the preferred model for future JavaScript-heavy framework detections.

## Things to avoid

- Do not hand-edit `lib/server/scans/generated/wappalyzer-catalog.json`.
- Do not put metadata-only changes in the fingerprint file.
- Do not put detection rules in the metadata file.
- Do not add broad bundle substrings that can match unrelated libraries.
- Do not update the worker scanner pin manually unless the automation is unavailable and the exact intended ref is known.
- Do not merge broad dependency/runtime PRs as a substitute for updating scanner pins.
