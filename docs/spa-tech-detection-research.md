# SPA technology detection research

## Goal

Stackray already runs a primary `httpx -td` scan and a selected-result screenshot pass with `httpx -screenshot -td`. This improves technology detection for some JavaScript-heavy sites because `httpx` re-runs Wappalyzer detection against the headless browser body after the screenshot is captured.

The remaining problem is that many SPA/framework signals do not exist in the original HTTP response body or even in the serialized rendered HTML. React, Vite, analytics SDKs, payment libraries, and other client-side tools are often best detected from browser runtime state:

- JavaScript globals and property paths, such as `React.version` or `__vite_is_modern_browser`
- DOM element properties, such as React root container properties
- dynamically inserted DOM nodes after hydration
- browser-observed resource, XHR, and fetch URLs
- cookies set during the browser session
- script URLs and bundled script contents

The target outcome is to improve technology detection for SPAs and JavaScript-heavy websites without building a brittle one-off map in Stackray.

## Current Stackray flow

Current worker flow:

1. Run baseline `httpx` with `-td` and other probes.
2. Select the authoritative result row.
3. Run screenshot/headless `httpx` for that selected result.
4. Run screenshot/headless `httpx` with `-td`, capture screenshot, collect any `payload.tech`, and merge new technology rows into `scan_result_detections`.
5. Run nuclei enrichment and preserve persisted detection rows when recomputing `searchDocument`.

This is useful, but still limited by what `httpx` and `wappalyzergo` evaluate from the headless page.

## Repository findings

### `enthec/webappanalyzer`

Repository: `https://github.com/enthec/webappanalyzer`

Relevant findings:

- It is a continuation of the public Wappalyzer technology dataset after the original Wappalyzer repository went private.
- It primarily provides a Wappalyzer-compatible catalog/spec, not a complete scanner binary or browser runner.
- Technology definitions live under `src/technologies/*.json`.
- The catalog includes metadata such as `description`, `website`, `icon`, `cpe`, and `cats`.
- The catalog supports many signal types:
  - `headers`
  - `cookies`
  - `dom`
  - `js`
  - `scriptSrc`
  - `scripts`
  - `meta`
  - `html`
  - `xhr`
  - `dns`
  - `certIssuer`

Examples from the current data:

- `React`
  - `js`: `React.version`, `ReactOnRails`, `__REACT_ON_RAILS_EVENT_HANDLERS_RAN_ONCE__`, `__isReactFizzContext`
  - `dom`: root/container selectors and properties
  - `scriptSrc`: older visible `react*.js` patterns
- `Vite`
  - `js`: `__vite_is_modern_browser`
  - `dom`: Vite legacy script markers
- `Stripe`
  - `scriptSrc`: `js.stripe.com`
  - `js`: `Stripe.version`, Stripe public key paths
  - cookies and DOM patterns
- `Express`
  - `headers`: `X-Powered-By: Express`
  - cookies: `connect.sid`

### Modern React/Vite detection gap

The current Wappalyzer-compatible rules do not reliably detect modern production React/Vite bundles.

For React, the current rule set mostly depends on:

- `window.React.version`
- React-on-Rails globals
- legacy DOM properties such as `_reactRootContainer`
- `data-react` HTML attributes
- script URLs that visibly contain `react*.js`

Modern bundlers commonly inline React into an application chunk such as `/assets/index-<hash>.js`. In that shape, the script URL does not contain `react`, `window.React` is usually not exposed, and React 18 roots may not expose the older `_reactRootContainer` property. The bundle itself can still contain strong React evidence such as React license comments, React production module names, and version assignments, but the current `React` fingerprint does not include `scripts` rules for those markers.

For Vite, the current rule set mostly depends on:

- `window.__vite_is_modern_browser`
- legacy script IDs such as `vite-legacy-polyfill` and `vite-legacy-entry`

Modern production Vite builds often do not expose those markers. Useful evidence can exist in the original HTML, such as `type="module"` entry scripts, hashed `/assets/index-*.js` and `/assets/index-*.css` assets, or `data-vite-*` attributes, but those signals are not currently part of the normalized Vite fingerprint.

This means two different improvements are possible:

1. Wappalyzer catalog improvements: add conservative React `scripts` patterns for bundled React production markers and conservative Vite `html`/`dom` patterns for production build artifacts.
2. Scanner/runtime improvements: make the scanner fetch or observe same-origin JavaScript bundle bodies and evaluate `scripts` rules against those bodies. Without this scanner behavior, adding React `scripts` rules alone would not help the normal static `FingerprintWithInfo(headers, body)` path.

Important licensing note:

- `enthec/webappanalyzer` is GPL-3.0. Vendoring the catalog directly into Stackray needs an explicit license decision.

### `projectdiscovery/wappalyzergo`

Repository: `https://github.com/projectdiscovery/wappalyzergo`

Relevant findings:

- `wappalyzergo` embeds a normalized Wappalyzer-style fingerprint database.
- Its updater pulls fingerprints from:
  - `https://raw.githubusercontent.com/enthec/webappanalyzer/main/src/technologies/%s.json`
  - `https://raw.githubusercontent.com/HTTPArchive/wappalyzer/main/src/technologies/%s.json`
- Its current embedded schema includes:
  - `js`
  - `dom`
  - `scriptSrc`
  - `scripts`
  - `headers`
  - `cookies`
  - `html`
  - `meta`
  - `css`
- It compiles those rules into `CompiledFingerprint`.
- `CompiledFingerprint` exposes:
  - `GetJSRules()`
  - `GetDOMRules()`
- The normal detection entrypoint is `FingerprintWithInfo(headers, body)`.
- `FingerprintWithInfo(headers, body)` can evaluate:
  - headers
  - response cookies
  - raw/provided HTML body
  - meta tags
  - script `src` values
  - HTML regexes
- It does not execute JavaScript.
- It does not evaluate JS property paths against a running browser in the normal path.
- The source has a TODO in `fingerprint_body.go`:
  - JS property checks require a running VM/browser.
  - Headless is the likely path.

Observed scale in the current embedded data during inspection:

- total apps: `7524`
- apps with `js` rules: `3277`
- apps with `dom` rules: `1449`
- apps with `scriptSrc` rules: `3828`
- apps with `scripts` rules: `733`
- apps with `headers` rules: `652`
- apps with `html` rules: `340`

Conclusion:

`wappalyzergo` already has the JS-heavy rules and regex evaluator. The missing piece is browser artifact collection and browser-side evaluation.

### Upstream contribution likelihood

A PR directly editing `wappalyzergo`'s generated fingerprint data is less likely to be the right long-term path because the repository intentionally normalizes fingerprint data from upstream catalogs. Its README says it uses data from `enthec/webappanalyzer` and `HTTPArchive/wappalyzer`, and `cmd/update-fingerprints` regenerates `fingerprints_data.json` from those sources.

The more upstream-friendly paths are:

1. Submit React/Vite rule improvements to the upstream fingerprint catalog first, then let `wappalyzergo` pick them up through its update process.
2. Submit scanner/API improvements to `wappalyzergo` itself, such as a browser-artifacts API or support for evaluating externally collected script bodies, because that is library behavior rather than generated catalog data.
3. Submit `httpx` changes that collect headless/browser artifacts and pass them through `wappalyzergo` matching APIs.

For our immediate goal, the practical Stackray path is still the `httpx -tdh` fork: it already has the browser page, observed requests, and same-origin resource bodies. For upstream, a split PR strategy is more realistic than a single large patch:

- catalog PR: improve React/Vite fingerprints in the source catalog;
- library PR: expose cleaner browser-artifact matching in `wappalyzergo`;
- scanner PR: teach `httpx` to collect and submit those artifacts.

### `projectdiscovery/httpx`

Repository: `https://github.com/projectdiscovery/httpx`

Relevant findings:

- `httpx -td` uses `wappalyzergo.FingerprintWithInfo(resp.Headers, resp.Data)` against the normal HTTP response.
- `httpx -screenshot` launches a headless browser through Rod/Chrome.
- `ScreenshotWithBody(...)` returns:
  - screenshot bytes
  - `headlessBody`
  - `linkRequest` / browser-observed network requests
- With screenshot enabled, `httpx` currently runs:

```go
moreMatches := r.wappalyzer.FingerprintWithInfo(resp.Headers, []byte(headlessBody))
```

That means `httpx -screenshot -td` already gets a limited second pass from rendered HTML.

What it still does not do:

- It does not evaluate `wappalyzergo` `js` rules inside the browser.
- It does not evaluate DOM property rules inside the browser.
- It does not appear to feed `linkRequest` URLs into Wappalyzer `xhr`-style rules.
- It does not inspect browser-set cookies from the headless session.
- It does not fetch and scan JavaScript bundle contents for `scripts` rules beyond inline/source values already present in HTML.

Conclusion:

The headless browser exists in `httpx`, and the JS-heavy rule data exists in `wappalyzergo`, but the adapter connecting the two is incomplete.

## Plan 1: fork `httpx` and add headless runtime detection

This is the fastest spike.

### Concept

Patch `httpx` in its screenshot flow. While the Rod page is still open, use `wappalyzergo`'s compiled rules to evaluate browser runtime state.

Initial scope:

1. Keep existing `FingerprintWithInfo(resp.Headers, headlessBody)` behavior.
2. Add JS property evaluation:
   - Iterate `r.wappalyzer.GetCompiledFingerprints().Apps`.
   - For each app, read `fingerprint.GetJSRules()`.
   - Collect property paths such as `React.version`, `Stripe.version`, and `__vite_is_modern_browser`.
   - Evaluate those paths in the browser context.
   - Run each observed value through the corresponding `ParsedPattern.Evaluate(...)`.
   - Add matching apps to `technologies` and `technologyDetails`.
3. Add DOM evaluation after the JS proof works:
   - Use `fingerprint.GetDOMRules()`.
   - Run `document.querySelectorAll(selector)`.
   - Evaluate `exists`, `text`, `attributes`, and eventually `properties`.
4. Optionally map browser network requests into `xhr`-style matching if/when `wappalyzergo` exposes or supports those rules.

### Why this can work without modifying `wappalyzergo` first

`wappalyzergo` already exposes enough to do a proof of concept:

- `GetCompiledFingerprints()`
- `GetJSRules()`
- `GetDOMRules()`
- `ParsedPattern.Evaluate(...)`
- `AppInfoFromFingerprint(...)`

The fork can use those public functions to evaluate runtime values and produce the same type of technology metadata that `httpx` already emits.

### Expected benefits

- Fastest way to prove whether runtime JS checks materially improve SPA detection.
- Minimal Stackray changes during the spike.
- Uses `httpx`'s existing browser lifecycle, timeout, headers, proxy, and screenshot behavior.
- Keeps detection results in the same `tech` field Stackray already consumes.

### Risks

- Maintaining a long-term `httpx` fork is operationally heavier than using upstream.
- The implementation may become awkward if `wappalyzergo` does not expose enough structured matcher APIs.
- Runtime evaluation of thousands of JS paths could be slow if done naively.
- DOM selector evaluation can be expensive and needs caps/timeouts.
- Some `webappanalyzer` rule types are not represented in `wappalyzergo` today, such as `xhr`.

### Spike test targets

Run forked `httpx` against:

- `https://jkellysites.com/`
- `https://codex-pets.net/`
- `https://udgeez.com/`
- a representative React/Vite SPA target

Compare:

```powershell
httpx -u <url> -json -td -screenshot -esb -ehb
forked-httpx -u <url> -json -td -screenshot -esb -ehb
```

Success criteria:

- Detect at least one previously missed SPA/client-side technology.
- Preserve existing detections.
- Avoid obvious false positives.
- Keep screenshot behavior working.

## Plan 2: cleaner `wappalyzergo` fork/modification

This is the more maintainable design if the spike proves valuable.

### Concept

Add a browser-artifact API to `wappalyzergo` so callers like `httpx` can pass structured runtime evidence instead of reimplementing matching logic in each caller.

Possible API shape:

```go
type BrowserArtifacts struct {
  Headers map[string][]string
  Body []byte
  ScriptSrcs []string
  JSValues map[string]string
  DOMMatches []DOMMatch
  XHRHosts []string
  Cookies map[string]string
}

func (s *Wappalyze) FingerprintBrowserArtifacts(artifacts BrowserArtifacts) map[string]AppInfo
```

`httpx` would then be responsible for browser collection only:

- navigate
- wait
- collect runtime values
- collect DOM selector evidence
- collect network request hosts
- collect cookies
- pass all artifacts to `wappalyzergo`

`wappalyzergo` would own:

- applying Wappalyzer-compatible matching semantics
- confidence aggregation
- version extraction
- implied technologies
- metadata lookup

### Expected benefits

- Cleaner ownership boundary.
- Easier to upstream.
- Other tools using `wappalyzergo` can benefit.
- `httpx` stays mostly a collector/browser runner.
- Matching semantics stay centralized with the Wappalyzer catalog.

### Required work

- Add exported data structures for browser artifacts.
- Add a public matching API that accepts those artifacts.
- Extend DOM rule support to preserve/evaluate all relevant `webappanalyzer` DOM rule shapes, including `properties`.
- Consider adding `xhr` to the normalized schema and compiled matcher.
- Add tests for React, Vite, Stripe, Express, and generic JS/DOM rules.
- Patch `httpx` to collect artifacts from Rod and call the new API.

### Risks

- More work up front.
- Requires maintaining or upstreaming changes across two repos.
- Some `webappanalyzer` rules may expose edge cases in Go matching semantics.
- Licensing/source provenance still needs to be understood if more data is pulled from `enthec/webappanalyzer`.

## Current recommendation

Proceed with Plan 1 as a proof of concept:

1. Patch a temp `httpx` clone.
2. Add JS property evaluation only.
3. Build a forked `httpx` binary.
4. Compare output against current `httpx` on known SPA targets.
5. If detection improves, decide whether to:
   - maintain a narrow `httpx` fork temporarily, or
   - move the clean API into a `wappalyzergo` fork and then patch `httpx` against that.

If Plan 1 does not improve results, do not invest in the deeper `wappalyzergo` fork yet. Move to script bundle analysis or another evidence source instead.

## Plan 1 spike results

Date: 2026-05-05

Temporary fork path:

```text
C:\Users\CarlosCanas\AppData\Local\Temp\httpx-inspect
```

Built test binary:

```text
C:\Users\CarlosCanas\AppData\Local\Temp\httpx-inspect\httpx-spa
```

The spike patched `httpx` screenshot flow so that, while the Rod page is still open, it:

1. Iterates `r.wappalyzer.GetCompiledFingerprints().Apps`.
2. Collects each app's `GetJSRules()` property paths.
3. Evaluates those property paths in the browser context.
4. Runs observed values through `ParsedPattern.Evaluate(...)`.
5. Merges matching apps into the existing `technologies` output.

The spike did not modify `wappalyzergo`.

Test command shape:

```powershell
httpx -u <url> -silent -json -td -screenshot -esb -ehb -no-screenshot-full-page -st 20
httpx-spa -u <url> -silent -json -td -screenshot -esb -ehb -no-screenshot-full-page -st 20
```

Both stock and forked binaries were run inside the local `stackray-dev-worker` image so Chromium dependencies matched the worker environment.

### Results

| Site | Stock `httpx` tech | Forked `httpx-spa` tech | Added by JS runtime spike |
| --- | --- | --- | --- |
| `https://jkellysites.com/` | HSTS, Stripe, Vercel | Framer Motion, HSTS, React Router:6, Stripe, Stripe:clover, Vercel | Framer Motion, React Router:6, Stripe:clover |
| `https://codex-pets.net/` | Cloudflare, Cloudflare Browser Insights, HTTP/3 | Cloudflare, Cloudflare Browser Insights, HTTP/3 | none |
| `https://udgeez.com/` | Cloudflare, Google Cloud, Google Cloud CDN, HSTS, HTTP/3 | Cloudflare, Cloudflare Turnstile, Google Cloud, Google Cloud CDN, HSTS, HTTP/3 | Cloudflare Turnstile |
| Representative React/Vite SPA target | Express, Google Cloud, Google Cloud CDN, Google Cloud Load Balancing, Google Cloud Trace, HSTS, HTTP/3, Node.js | Express, Framer Motion, Google Cloud, Google Cloud CDN, Google Cloud Load Balancing, Google Cloud Trace, HSTS, HTTP/3, Node.js | Framer Motion |

### Interpretation

The JS-runtime-only spike works, but it is not enough for modern React/Vite detection.

Positive signal:

- It recovered `Framer Motion` on two React/Vite sites.
- It recovered `React Router:6` on `jkellysites.com`.
- It refined Stripe to `Stripe:clover`.
- It recovered `Cloudflare Turnstile` on `udgeez.com`.

Important limitation:

- It did not recover `React` on the tested Vite SPAs.
- It did not recover `Vite`.
- Modern bundled React applications usually do not expose `window.React`.
- Vite production builds usually do not expose `window.__vite_is_modern_browser`.

Next technical implication:

- JS global/property evaluation is valuable, but it is only one detector.
- React/Vite likely need one or more additional evidence paths:
  - DOM property evaluation, including React's modern randomized internal properties such as `__reactContainer$...` and `__reactFiber$...`
  - script bundle inspection for stable framework strings
  - parsed modulepreload/script URL analysis
  - source map or package metadata inspection where exposed

The next spike should add DOM/runtime property detection or capped JavaScript bundle inspection before deciding whether to maintain an `httpx` fork long-term.

## Plan 1 header retest

Date: 2026-05-05

The spike was rerun with the same browser-like headers Stackray uses for its primary scan fallback profile, plus a longer screenshot idle wait:

```powershell
-sid 5
-H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
-H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
-H "Accept-Language: en-US,en;q=0.9"
-H "Sec-Fetch-Dest: document"
-H "Sec-Fetch-Mode: navigate"
-H "Sec-Fetch-Site: none"
-H "Sec-Fetch-User: ?1"
-H "Sec-Ch-Ua: \"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\""
-H "Sec-Ch-Ua-Mobile: ?0"
-H "Sec-Ch-Ua-Platform: \"Windows\""
```

Header retest results:

| Site | Stock `httpx` tech with headers | Forked `httpx-spa` tech with headers | Added by fork |
| --- | --- | --- | --- |
| `https://jkellysites.com/` | HSTS, Stripe, Vercel | Framer Motion, HSTS, React Router:6, Stripe, Stripe:clover, Vercel | Framer Motion, React Router:6, Stripe:clover |
| `https://codex-pets.net/` | Cloudflare, Cloudflare Browser Insights, HTTP/3 | Cloudflare, Cloudflare Browser Insights, HTTP/3 | none |
| `https://udgeez.com/` | Cloudflare, Google Cloud, Google Cloud CDN, HSTS, HTTP/3 | Cloudflare, Cloudflare Turnstile, Google Cloud, Google Cloud CDN, HSTS, HTTP/3 | Cloudflare Turnstile |
| Representative React/Vite SPA target | Express, Google Cloud, Google Cloud CDN, Google Cloud Load Balancing, Google Cloud Trace, HSTS, HTTP/3, Node.js | Express, Framer Motion, Google Cloud, Google Cloud CDN, Google Cloud Load Balancing, Google Cloud Trace, HSTS, HTTP/3, Node.js | Framer Motion |

The header/idle retest did not materially change detection output compared with the first spike. It did cause some runs to wait longer and observe more network requests, especially on `codex-pets.net`, but it still did not recover `React` or `Vite`.

## Plan 1 expanded adapter retest

Date: 2026-05-05

The `httpx` fork was expanded beyond JS global/property checks. The second spike evaluates more of the browser-only Wappalyzer evidence that `wappalyzergo` already compiles:

- JS property paths from `fingerprint.JS`
- DOM selectors, text, attributes, and properties from `fingerprint.DOM`
- browser-readable cookies from the headless page
- observed browser network request URLs against `scriptSrc` rules
- implied technologies from matching catalog entries

This still does not modify `wappalyzergo`; it is an `httpx` adapter spike that uses `wappalyzergo`'s exposed compiled fingerprints and pattern evaluator.

### False-positive fix

The first expanded version produced obvious false positives such as `Preact`, `Svelte`, `SvelteKit`, `React`, and `Vite` on sites where those detections were not justified.

Root cause:

- Wappalyzer uses empty patterns in some DOM attribute/property rules to mean "this attribute/property exists".
- The first adapter treated missing attributes/properties as the empty string.
- That made missing evidence match empty-pattern rules.

Fix:

- Only evaluate attribute/property patterns when the attribute/property key actually exists.
- Remove broad CSS selector matching from the spike because the exact `wappalyzergo` CSS semantics are not clear enough to safely map to `document.querySelector(...)` existence.

### Fixed expanded adapter results

Command shape:

```powershell
httpx -u <url> -silent -json -td -screenshot -esb -ehb -no-screenshot-full-page -st 20 -sid 5 <browser-like headers>
httpx-spa -u <url> -silent -json -td -screenshot -esb -ehb -no-screenshot-full-page -st 20 -sid 5 <browser-like headers>
```

| Site | Stock `httpx` tech | Expanded fork tech | Added by expanded fork |
| --- | --- | --- | --- |
| `https://jkellysites.com/` | HSTS, Stripe, Vercel | Framer Motion, Google Font API, HSTS, Lucide, Open Graph, React, React Router:6, Stripe, Stripe:clover, Vercel | Framer Motion, Google Font API, Lucide, Open Graph, React, React Router:6, Stripe:clover |
| `https://codex-pets.net/` | Cloudflare, Cloudflare Browser Insights, HTTP/3 | Cloudflare, Cloudflare Browser Insights, HTTP/3, Open Graph | Open Graph |
| `https://udgeez.com/` | Cloudflare, Google Cloud, Google Cloud CDN, HSTS, HTTP/3 | Cloudflare, Cloudflare Turnstile, Google Cloud, Google Cloud CDN, HSTS, HTTP/3, Lucide | Cloudflare Turnstile, Lucide |
| Representative React/Vite SPA target | Express, Google Cloud, Google Cloud CDN, Google Cloud Load Balancing, Google Cloud Trace, HSTS, HTTP/3, Node.js | Express, Framer Motion, Google Cloud, Google Cloud CDN, Google Cloud Load Balancing, Google Cloud Trace, Google Font API, HSTS, HTTP/3, Lucide, Node.js | Framer Motion, Google Font API, Lucide |

### Interpretation

The expanded adapter is useful, but it still does not solve robust React/Vite detection for modern production SPAs.

Positive signal:

- It preserved existing stock detections.
- It recovered plausible browser-only or browser-observed technologies.
- It recovered `React` on `jkellysites.com` because `React Router:6` was detected and the catalog implies `React`.
- It added useful client-side library detections such as `Framer Motion`, `Lucide`, and `Cloudflare Turnstile`.

Remaining limitation:

- It still did not recover `React` on several tested modern SPA targets.
- It still did not recover `Vite`.
- The Wappalyzer rules available through `wappalyzergo` do not reliably identify modern React/Vite production bundles unless a framework-specific runtime signal survives bundling or another detected library implies the framework.

Recommendation after this spike:

1. Do not ship a long-term `httpx` fork yet solely for this result.
2. Keep the spike as evidence that a browser-artifact adapter is valuable for secondary client-side technologies.
3. For reliable React/Vite detection, add a separate controlled bundle-evidence spike:
   - collect same-origin module/script URLs from the headless page;
   - fetch only capped JavaScript assets with size and count limits;
   - inspect for high-confidence framework markers;
   - store those detections with explicit evidence and conservative confidence.

This means the cleanest production path is probably hybrid:

- keep `httpx -screenshot -td` for Wappalyzer-compatible headless-body detection;
- optionally upstream or maintain a small browser-artifact adapter later;
- build a narrowly-scoped Stackray detector for modern SPA bundle/runtime evidence where Wappalyzer rules are insufficient.

## Completed `httpx` fork spike

Date: 2026-05-05

Visible fork path:

```text
C:\Users\CarlosCanas\OneDrive - ESA\Desktop\Projects\httpx-stackray-spa
```

The fork now exercises the browser-artifact capabilities exposed by the current `wappalyzergo` dependency without adding custom React internal-property heuristics.

Implemented in the fork:

- JS property-path evaluation from `fingerprint.JS`
- DOM selector, text, attribute, and property evaluation from `fingerprint.Dom`
- browser-readable cookie evaluation from `fingerprint.Cookies`
- browser-observed request URL matching against `fingerprint.ScriptSrc`
- same-origin loaded JavaScript response-body matching against `fingerprint.Script`
- same-origin loaded CSS response-body matching against `fingerprint.CSS`
- version extraction from runtime matches where the Wappalyzer pattern provides it
- implied technology expansion from matching catalog entries

Not implemented:

- true `xhr` rule evaluation, because this `wappalyzergo` version does not normalize or expose an `xhr` fingerprint field
- custom React internal-property heuristics such as `__reactFiber$...` or `__reactContainer$...`

Important safety adjustment:

- The first bundle-text implementation scanned every loaded script body, including third-party vendor bundles.
- That polluted the target stack with vendor internals such as `BitPay`, `Webpack`, and `Module Federation` from external scripts.
- The completed spike only applies `scripts` and `css` body matching to same-origin resources.
- Third-party service detection still works through `scriptSrc` URL matching, which is closer to normal Wappalyzer behavior.

### Final completed-spike results

Command shape:

```powershell
httpx -u <url> -silent -json -td -screenshot -esb -ehb -no-screenshot-full-page -st 20 -sid 5 <browser-like headers>
httpx-spa -u <url> -silent -json -td -screenshot -esb -ehb -no-screenshot-full-page -st 20 -sid 5 <browser-like headers>
```

| Site | Stock `httpx` tech | Completed fork tech | Added by completed fork |
| --- | --- | --- | --- |
| `https://jkellysites.com/` | HSTS, Stripe, Vercel | Framer Motion, Google Font API, HSTS, Lucide, Open Graph, Radix UI, React, React Router:6, shadcn/ui, Stripe, Stripe:clover, Tailwind CSS, Vercel | Framer Motion, Google Font API, Lucide, Open Graph, Radix UI, React, React Router:6, shadcn/ui, Stripe:clover, Tailwind CSS |
| `https://codex-pets.net/` | Cloudflare, Cloudflare Browser Insights, HTTP/3 | Cloudflare, Cloudflare Browser Insights, HTTP/3, Open Graph | Open Graph |
| `https://udgeez.com/` | Cloudflare, Google Cloud, Google Cloud CDN, HSTS, HTTP/3 | Cloudflare, Cloudflare Turnstile, Google Cloud, Google Cloud CDN, HSTS, HTTP/3, Lucide, Radix UI, shadcn/ui, Tailwind CSS | Cloudflare Turnstile, Lucide, Radix UI, shadcn/ui, Tailwind CSS |
| Representative React/Vite SPA target | Express, Google Cloud, Google Cloud CDN, Google Cloud Load Balancing, Google Cloud Trace, HSTS, HTTP/3, Node.js | Express, Framer Motion, Google Cloud, Google Cloud CDN, Google Cloud Load Balancing, Google Cloud Trace, Google Font API, HSTS, HTTP/3, Lucide, Node.js, Radix UI, shadcn/ui, Tailwind CSS | Framer Motion, Google Font API, Lucide, Radix UI, shadcn/ui, Tailwind CSS |

### Final interpretation

This completed spike is a stronger result than the JS-only spike. It shows that `wappalyzergo` already contains useful SPA/client-side rules that `httpx` does not currently exploit from the live browser page.

The highest-value additions came from combining:

- runtime JS property checks
- DOM checks
- same-origin bundle text checks
- observed request URL checks

The limitation still stands:

- Wappalyzer-compatible rules alone do not guarantee framework detection for every modern SPA.
- `codex-pets.net` still does not expose enough Wappalyzer-compatible React/Vite evidence even after the full non-custom adapter.

Production recommendation:

1. Treat this as a successful proof that a browser-artifact adapter is worth pursuing.
2. Prefer upstreaming or forking `wappalyzergo` with a clean browser-artifacts API rather than keeping all matcher semantics inside an `httpx` fork.
3. If we need Stackray-specific reliability for modern React/Vite, add that as a separate high-confidence detector rather than mixing custom framework heuristics into the Wappalyzer adapter.

## Follow-up: complete browser evidence pass

Date: 2026-05-08

The `httpx` fork was extended again so `-tdh` uses more of the browser evidence already available from the live Rod page:

- browser-observed response headers are captured from CDP `Network.responseReceived` events and evaluated against Wappalyzer header rules for same-origin responses;
- cookies are collected through CDP `Network.getCookies`, not only `document.cookie`, so HttpOnly cookies can participate in Wappalyzer cookie rules;
- rendered headless HTML is evaluated inside the `-tdh` runtime matcher itself, so HTML, meta, and script-src rules do not depend on a separate `-td` body pass.

This makes `-tdh` more self-contained and closer to a real browser-artifact adapter over `wappalyzergo`'s current rule schema.

Still unresolved:

- Confidence aggregation is still not equivalent to `wappalyzergo`'s internal `UniqueFingerprints` behavior. The current runtime matcher treats any valid runtime rule as a match and keeps the most specific version string it sees. We should revisit this later if we want `-tdh` semantics to match Wappalyzer confidence scoring more exactly.
