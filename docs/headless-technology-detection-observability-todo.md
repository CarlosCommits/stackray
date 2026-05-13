# Headless technology detection observability

## Purpose

This note captures the current thinking around Stackray's custom `httpx` technology detection, especially the headless `-tdh` path, custom Wappalyzer fingerprints, and what to measure before changing scanner limits or removing fork-specific framework heuristics.

The short version: do not remove the React, Vite, or TanStack logic from the `httpx` fork yet. First add observability so we can see whether the headless detection limits are actually binding in real scans.

## Mental model

Stackray has two technology-detection paths:

1. The primary scan runs `httpx -td`.
   - This uses normal HTTP response evidence.
   - It receives Stackray's custom fingerprint file through `-cff`.
   - It does not run the browser/runtime collection used by headless detection.

2. The selected-result enrichment pass runs `httpx -tdh`.
   - This launches the headless browser path.
   - It also receives Stackray's custom fingerprint file through `-cff`.
   - It collects rendered and browser-observed evidence from the scanned site.
   - It runs after the primary scan against the authoritative result, not against every discovered result.

The `-tdh` mode has two kinds of detection:

- Generic fingerprint-driven detection: custom and embedded Wappalyzer-style rules are evaluated against browser-collected evidence.
- Hard-coded fork heuristics: Go code in the fork detects patterns that are awkward or risky to express as a single JSON fingerprint rule.

## What custom fingerprints can use in `-tdh`

The headless path can evaluate these custom fingerprint fields against the scanned website:

- `html`: rendered page HTML from the browser.
- `js`: browser-evaluated JavaScript globals and property paths.
- `dom`: rendered DOM selectors, text, attributes, and selected properties.
- `cookies`: browser cookies after page load.
- `headers`: same-origin response headers observed by the browser.
- `scriptSrc`: script URLs observed by the browser.
- `scripts`: same-origin JavaScript response bodies observed or fetched by the browser path.
- `css`: same-origin stylesheet response bodies observed by the browser path.

The fingerprint file is the list of probes. The scanned website supplies the values. For example, a `js` fingerprint such as `__TSR_ROUTER__` tells `httpx` to evaluate that property on the scanned page's `window` object.

## Response bodies

An HTTP response body is the content returned after the response headers. For example:

```http
HTTP/1.1 200 OK
Content-Type: application/javascript

window.__TSR_ROUTER__ = ...
```

In the `-tdh` path, script response bodies are the contents of loaded same-origin JavaScript files such as `/assets/app-abc123.js`. These bodies are what `scripts` fingerprint rules inspect.

## Current resource limits

The current fork limits same-origin resource body collection. These limits apply to captured JS/CSS response bodies, not to JavaScript global checks or DOM selector checks.

- Browser-captured resource bodies: up to 20 resources.
- Per resource body: up to 2 MB.
- Total resource body bytes: up to 8 MB.
- Script fallback fetches: up to 10 additional same-origin script candidates, also with 2 MB per resource and 8 MB total.

The JS and DOM rule probes are different:

- `js` probes are derived from the fingerprint catalog and evaluated on the scanned page in chunks of 250 property paths.
- `dom` probes are derived from the fingerprint catalog and evaluated on the scanned page in chunks of 100 selector specs.

So the likely missed-detection risk is not "only 20 JS globals or DOM selectors." The real risk is missing markers that only appear in JS/CSS resource bodies beyond the captured/fetched limits.

## Risk of missing detections

For normal Vite, React, and TanStack initial-page detections, the current limits are probably acceptable. The main application/runtime chunks are usually among the first scripts loaded on initial navigation.

The chance of missed detection increases for:

- chunk-heavy applications that load more than 20 same-origin script resources during initial page load
- large uncompressed bundles above 2 MB
- evidence that only appears in lazy route chunks not loaded during initial navigation
- scripts served from a different origin or CDN, since body collection is same-origin only
- framework markers that appear only after user interaction or late dynamic imports

Do not raise limits blindly. Raising resource caps can increase scan time, memory use, and browser/CDP overhead without proving that detection coverage improves.

## Performance expectation

The framework-specific checks themselves are probably not the dominant cost.

Likely larger costs:

- launching or driving headless Chrome
- waiting for page/network readiness
- loading page resources
- screenshot capture, when enabled
- collecting same-origin script/CSS bodies
- evaluating generic JS/DOM fingerprint probes across the catalog

The TanStack checks are mostly simple substring checks over already-collected page and script bodies. React and Vite add more logic, but they are still likely cheaper than browser startup and resource loading.

## Recommended observability

Add a `tech_detection_metrics` object to `httpx` JSON output when `-tdh` is enabled. Avoid stderr parsing. JSON output is already consumed by the Stackray worker.

Suggested shape:

```json
{
  "url": "https://example.com",
  "tech": ["React", "Vite", "TanStack Router"],
  "tech_detection_metrics": {
    "script_candidates": 43,
    "script_bodies_captured": 20,
    "script_fallback_fetched": 8,
    "script_skipped_resource_limit": 15,
    "script_skipped_size_limit": 1,
    "script_skipped_total_bytes_limit": 3,
    "script_bytes_captured": 7340032,
    "css_bodies_captured": 4,
    "css_bytes_captured": 318000,
    "runtime_js_paths_checked": 320,
    "runtime_dom_selectors_checked": 74,
    "headless_detection_duration_ms": 642
  }
}
```

Useful counters:

- number of same-origin script candidates
- number of script bodies captured from browser network responses
- number of fallback script fetches attempted
- number of fallback script fetches that succeeded
- number skipped by max resource count
- number skipped by per-resource size
- number skipped by total byte limit
- total captured script bytes
- number of CSS bodies captured
- total captured CSS bytes
- number of JS property paths checked
- number of DOM selector specs checked
- time spent in browser readiness wait
- time spent collecting resource bodies
- time spent evaluating fingerprint rules
- time spent in hard-coded framework heuristics

## Where to surface metrics in Stackray

First surface metrics in worker logs by adding them to the existing `headless_enrichment_completed` event payload.

Current worker behavior:

- `runHttpxCli` parses JSON lines from `httpx` stdout.
- `enrichResultWithHeadless` already reads `payload.tech`.
- The worker already emits structured JSON events with `logWorkerEvent`.

Recommended worker flow:

1. `httpx -tdh` emits `tech_detection_metrics` in its JSON result.
2. `enrichResultWithHeadless` stores the most recent metrics object from the JSON payload.
3. `headless_enrichment_completed` includes that metrics object.
4. Later, if the data proves useful, persist it into scan events or show it in an internal diagnostics view.

Avoid relying on `httpx` stderr for these measurements. Stackray captures stderr primarily for failures and retry messages, and parsing stderr would be brittle.

## Recommended next steps

1. Keep the current React, Vite, and TanStack fork heuristics for now.
2. Add `tech_detection_metrics` to the `httpx` fork's `-tdh` JSON output.
3. Update Stackray's worker to log those metrics on `headless_enrichment_completed`.
4. Run representative scans and inspect whether resource count, per-file size, or total byte limits are frequently hit.
5. Only then consider raising script resource limits.
6. Only remove TanStack-specific fork heuristics after parity tests prove that custom JSON fingerprints produce the same `payload.tech` results.

If metrics show frequent cap pressure, a conservative first tuning pass would be:

- increase script body resource count from 20 to 50
- increase total script body bytes from 8 MB to 16-24 MB
- keep the 2 MB per-resource cap initially

Do not tune CSS and script limits together unless the metrics show both are binding.
