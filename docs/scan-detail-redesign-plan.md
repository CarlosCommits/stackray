# `/scans/[scanId]` redesign refactor plan

## Objective

Refactor the current scan detail page to match the direction of the redesign mockup at `app/(authenticated)/scans/redesign/page.tsx` **without losing any important evidence from the current page or the worker payloads**.

This is **not** a CSS-only redesign. The redesign consolidates data that currently lives in separate sections and is sourced from different layers:

- scan-level metadata from `getScanDetail()` / `getScanRecord()`
- a single authoritative result from `getAuthoritativeScanResult()`
- httpx-derived infrastructure, redirect, TLS, content, and fingerprint data
- Stackray-normalized nuclei findings and nuclei-derived technology matches
- technology enrichment and display ordering from `technology-enrichment` and `technology-display`

The redesign must preserve:

- original-domain vs final-domain semantics for nuclei findings
- raw-evidence access
- server-first rendering with live refresh layered on top
- the distinction between `pending`, `empty`, `failed`, `not_run`, and `not_applicable`

---

## Scope

### In scope

- redesigning `app/(authenticated)/scans/[scanId]/page.tsx`
- replacing the current section composition with a redesign-aligned information architecture
- introducing a dedicated page view-model layer if needed
- consolidating related httpx + nuclei data into clearer sections
- defining all new component boundaries needed for a clean rebuild
- preserving or improving current raw-evidence/debug access
- handling active scans and SSE refresh correctly

### Out of scope

- changing worker persistence schema as part of the redesign
- adding new worker probes/templates beyond what already exists
- implementing multi-result comparison in the scan detail route
- making the redesign page client-only
- removing raw evidence or advanced evidence from the product

### Rendering decision

The live page should remain **server-first**.

- `app/(authenticated)/scans/[scanId]/page.tsx` already loads the initial page in parallel using `Promise.all(...)`
- `ScanDetailLiveClient` already refreshes the page from SSE events
- the mockup at `app/(authenticated)/scans/redesign/page.tsx` is a **visual prototype**, not an architectural target

The redesign should keep the existing server/data boundaries and only move interactivity into client components when there is a real local-state need.

---

## Files and systems reviewed

### Current page and related UI

- `app/(authenticated)/scans/[scanId]/page.tsx`
- `components/scans/scan-detail-live-client.tsx`
- `components/scans/scan-hero.tsx`
- `components/scans/scan-attempt-indicator.tsx`
- `components/scans/scan-overview-strip.tsx`
- `components/scans/scan-findings-workspace.tsx`
- `components/scans/technical-evidence-section.tsx`
- `components/scans/visual-content-context.tsx`
- `components/scans/target-history.tsx`
- `components/scans/raw-evidence-tabs.tsx`

### Redesign mockup

- `app/(authenticated)/scans/redesign/page.tsx`

### Data shaping and contracts

- `lib/contracts/scans.ts`
- `lib/server/scans/read-service.ts`
- `lib/server/scans/result-selection.ts`
- `lib/server/scans/technology-display.ts`
- `lib/server/scans/technology-enrichment.ts`
- `lib/server/scans/redirect-chain.ts`

### Worker implementation

- `worker/scan-worker.ts`
- `worker/nuclei.ts`
- `worker/nuclei.test.ts`
- `worker/scan-worker.test.ts`

### Product docs

- `docs/pages.md`
- `docs/httpx-worker-contract.md`
- `docs/homepage-screenshot-plan.md`

### Package / verification commands

- `package.json`

---

## Current page inventory

The current page is one server route with one selected primary result driving the detail experience.

### Route composition today

`app/(authenticated)/scans/[scanId]/page.tsx` currently renders these sections when a result exists:

1. `ScanDetailLiveClient`
2. `ScanHero`
3. `ScanOverviewStrip`
4. `ScanFindingsWorkspace`
5. `TechnicalEvidenceSection`
6. `VisualContentContext`
7. `TargetHistory`
8. `RawEvidenceTabs`

If no persisted result exists yet, it renders a warming-up card.

### Important current behaviors

- the route loads `getScanRecord`, `getScanDetail`, `getAuthoritativeScanResult`, and `getTargetHistoryForScan` in parallel
- one authoritative result drives the detail page directly rather than selecting from a paged `getScanResults()` response
- technologies shown in the UI are **not** raw httpx technologies alone; they are enriched and reordered
- active scans refresh through SSE and `router.refresh()`
- raw evidence is explicitly available today and must survive the redesign

### Important current transformation layers

- `read-service.ts` maps DB rows to page-facing shape and resolves the authoritative result for the active/latest attempt
- `technology-enrichment.ts` derives/promotes technologies
- `technology-display.ts` groups technologies for presentation
- `redirect-chain.ts` normalizes mixed redirect payload shapes
- `scan-findings-workspace.tsx` currently performs significant nuclei grouping/parsing logic in the UI layer

---

## Redesign mockup inventory

`app/(authenticated)/scans/redesign/page.tsx` is a single client component with inline sample data and inline helper components.

### What the mockup includes

- header card
- KPI row
- page title card
- technologies card with primary / WordPress / additional groups
- collapsible sections for:
  - technical details
  - DNS & infrastructure
  - TLS certificate
  - fingerprints
  - favicon
  - domain info
  - robots.txt
- dashboard-style sidebar with:
  - quick actions
  - homepage screenshot
  - redirect chain
  - previous scans
  - scan info
  - body domains

### Important mockup caveats

- it consolidates data from multiple current sections
- it does not fully express current worker/state edge cases
- some helper controls are currently unused in the mockup (`ViewToggle`, `LayoutToggle`, `scrollToSection`)
- `findings` sample data exists but is not rendered, which means the mockup is incomplete as a source of truth for nuclei findings presentation

---

## Canonical page contract to design against

The redesign should be built against a page view-model with **three layers**.

### 1. Scan-level state

Source: `getScanRecord()` + `getScanDetail()`

Fields:

- `scanId`
- overall scan `status`
- `profile`
- `source`
- `submittedAt`
- `completedAt`
- `target`
- `currentAttempt`
- `attemptHistory`
- `progress`
- `isActive`

Use cases:

- header
- status chips
- attempt/fallback explanation
- live refresh behavior
- scan info sidebar/footer metadata

### 2. Primary-result detail model

Source: `getAuthoritativeScanResult()` + `read-service.ts`

Fields:

- request / URL fields
- title / status / server / content metadata
- redirects / final URL
- DNS / ASN / CDN / TLS / favicon / hashes / screenshot
- technologies / WordPress / CPE
- nuclei block
- body domains / body FQDNs / body preview
- raw httpx

Use cases:

- every redesign section except scan-level history/attempt metadata

### 3. Section-level display view-models

These should be derived from the primary-result model, not recomputed ad hoc in every component.

Required section view-models:

- `overviewSection`
- `technologySection`
- `deliveryRedirectsSection`
- `dnsInfrastructureSection`
- `tlsFingerprintsSection`
- `domainIntelligenceSection`
- `contentSignalsSection`
- `screenshotSection`
- `historySection`
- `rawEvidenceSection`

---

## Worker coverage that the redesign must honor

## httpx profile and flags in use

`worker/scan-worker.ts` builds the main httpx invocation with:

- `-silent`
- `-json`
- `-stream`
- `-td`
- `-title`
- `-sc`
- `-cl`
- `-ct`
- `-rt`
- `-location`
- `-server`
- `-wp`
- `-cpe`
- `-favicon`
- `-jarm`
- `-cdn`
- `-ip`
- `-cname`
- `-asn`
- `-tls-grab`
- `-hash md5,mmh3,sha256`
- `-extract-fqdn`
- `-include-chain`

`-extract-fqdn` still captures passive CSP and body-domain evidence for the primary probe. `-csp-probe` is intentionally disabled because it actively probes CSP-referenced domains and creates unrelated result rows.

Conditional flags:

- `-fr` when redirects are enabled
- `-sr` when raw response inclusion is enabled
- repeated `-H` browser-like headers for the `browser_headers` fallback profile

### Screenshot follow-up pass

Homepage screenshot capture is a second httpx invocation with:

- `-silent`
- `-json`
- `-td`
- `-title`
- `-screenshot`
- `-fr`
- `-esb`
- `-ehb`
- `-no-screenshot-full-page`
- `-st <timeout>`
- `-srd <temp-dir>`

Runtime/browser technology enrichment is a separate selected-result invocation with `-tdh` and no screenshot capture so slow runtime matching cannot block image capture.

This is important because the redesign mockup includes screenshot UI and the product already documents screenshot metadata and delivery behavior.

## httpx data families available today

The redesign must assume these families can be present:

### Request / response identity

- `input`
- `url`
- `finalUrl`
- `path`
- `method`
- `statusCode`
- `location`

### Presentation summary

- `title`
- `server`
- `contentType`
- `contentLength`
- `responseTimeMs`

### Infrastructure and routing

- `hostIp`
- `a`
- `aaaa`
- `cname`
- `resolvers`
- `asn`
- `cdn`
- redirect chain and chain status codes

### TLS / fingerprints

- `tls` certificate payload
- `sni`
- `jarmHash`
- favicon hashes / URL / path
- response hashes

### Content / body-derived signals

- `bodyPreview`
- `bodyDomains`
- `bodyFqdns`
- CSP-derived domains

### App / stack detection

- `technologies`
- WordPress plugins/themes
- `cpe`

### Artifacts / debug

- screenshot metadata
- `rawHttpx`
- optional stored raw response path

## Nuclei templates in use

`worker/nuclei.ts` defines an 11-template allowlist.

### Domain-targeted templates

- `dns-saas-service-detection` → `dns_service`
- `txt-service-detect` → `dns_service`
- `mx-service-detector` → `dns_service`
- `txt-fingerprint` → `txt_record`
- `replit-dns-verification` → `technology`
- `rdap-whois` → `domain_metadata`

### URL-targeted templates

- `ssl-dns-names` → `ssl_dns_names`
- `ssl-issuer` → `ssl_issuer`
- `fingerprinthub-web-fingerprints` → `technology`
- `tech-detect` → `technology`
- `robots-txt` → `robots_txt`

## Nuclei flags in use

`buildNucleiArguments(...)` always builds from:

- `-u <target>`
- `-jsonl`
- `-silent`
- `-nc`
- `-or`
- `-ot`

Conditional behavior:

- `-dr` by default when redirects are disabled
- repeated `-itags <tag>` for isolated runs like `txt-service`
- repeated `-t <path>` for repo-local or directory-based template execution
- `-id <csv>` when using template IDs directly
- repeated `-H <header>` for request headers

## Nuclei target semantics and phased execution

This is the highest-risk modeling area in the redesign.

`selectNucleiTargets(...)` and `buildNucleiExecutionPhases(...)` in `worker/scan-worker.ts` produce:

- `originalDomainTarget` from the original scan target
- `finalDomainTarget` from the resolved final host
- `targetUrl` from `result.finalUrl ?? result.url`

Execution phases:

1. domain templates against original domain
2. RDAP-only domain phase against original domain
3. TXT-service-only domain phase against original domain
4. same three phases for final domain when different
5. one URL-targeted phase against the final URL

### Consequence for redesign

The UI must not flatten these into a single unlabeled “domain” record.

The redesign needs explicit support for:

- findings about the originally scanned domain
- findings about the redirected/final domain
- findings about the final URL
- UI labels or badges that preserve that provenance

### Current persistence sharp edge

The repo docs already call out that nuclei persists as a single run row per result. If one later phase fails, earlier successful phase matches are not currently preserved as partial success at the run level.

The redesign therefore needs distinct states for:

- `not_run`
- `pending`
- `running`
- `completed`
- `failed`
- `skipped`
- completed run with no findings

---

## Raw JSON and shape-validation sources

The redesign work should continue to validate against these evidence sources:

### In-app / persisted

- `scan_results.raw_json` for raw httpx payloads
- `scan_result_nuclei_matches.raw_json` for raw nuclei lines
- scan detail raw evidence tab for live app inspection

### Repo fixtures / tests

- `lib/mocks/scans.ts`
- `worker/nuclei.test.ts`
- `worker/scan-worker.test.ts`
- `lib/server/scans/read-service.test.ts`
- `components/scans/scan-findings-workspace.test.tsx`

### Optional live validation

Railway / DB inspection is optional but useful if the redesign uncovers uncertainty around real production sparsity, nullability, or cross-domain redirect behavior.

---

## Current section to redesign mapping

| Current source | Redesign destination | Notes |
|---|---|---|
| `ScanHero` | Header / scan info | keep attempt history and fallback explanation |
| `ScanOverviewStrip` | Header KPIs + overview card | preserve title/final URL context |
| `ScanFindingsWorkspace` technology tab | Technologies section | keep enriched ordering and WP grouping |
| `ScanFindingsWorkspace` security tab | Domain intelligence + DNS/infrastructure + robots/TLS subareas | split by finding kind, not by old tab |
| `TechnicalEvidenceSection` delivery subsection | Delivery & redirects | keep final URL, location, method, redirect chain |
| `TechnicalEvidenceSection` infrastructure subsection | DNS & infrastructure | merge carefully with nuclei dns/domain metadata |
| `TechnicalEvidenceSection` TLS/fingerprint subsection | TLS & fingerprints | keep favicon + hashes + JARM |
| `VisualContentContext` screenshot | Screenshot panel | use existing screenshot route/metadata |
| `VisualContentContext` content signals | Content signals / body domains / hashes | likely split between content and fingerprints |
| `TargetHistory` | Previous scans sidebar/section | keep target-centric history |
| `RawEvidenceTabs` | Raw evidence drawer/tab/panel | must remain explicit |

---

## Proposed redesign information architecture

The redesign should use the mockup’s hierarchy but fill in all missing product semantics.

## 1. Header / scan frame

Contents:

- target label
- scan status
- submitted/completed timestamps
- scan ID shortcut
- scan profile
- source
- attempt badge / fallback history
- live refresh indicator when active

Sources:

- scan-level state
- attempt history

## 2. Overview strip

Contents:

- HTTP status
- redirect count
- server / CDN summary
- host IP / ASN summary
- final URL
- page title

Sources:

- httpx result only

Rules:

- do not put nuclei findings here
- this section is for “what did the main probe resolve to?”

## 3. Technologies

Contents:

- primary stack
- WordPress plugins/themes
- additional detected technologies
- optional provenance chips or subtle source indicators

Sources:

- httpx `tech`
- nuclei technology templates
- CPE-driven enrichment
- WordPress plugin/theme data

Rules:

- use the existing enrichment + display-order logic
- do not double-count technologies across sources
- preserve the distinction between WordPress ecosystem items and general technologies

## 4. Delivery & redirects

Contents:

- input URL / resolved URL / final URL
- method
- status / location
- redirect chain
- response time
- content type
- content length

Sources:

- httpx result only

Rules:

- this is where navigation/transport behavior belongs
- keep full redirect chain inspectable, not just a count
- handle scans with no redirects and scans with cross-domain redirects cleanly

## 5. DNS & infrastructure

This is the most important consolidation section in the redesign.

### Include from httpx

- host IP
- A / AAAA / CNAME / resolvers
- CDN enabled/name/type
- ASN number/org/country/range
- server banner
- protocol capability flags (`http2`, `pipeline`, `websocket`, `vhost`)

### Include from nuclei

- `dns_service` findings from:
  - `dns-saas-service-detection`
  - `txt-service-detect`
  - `mx-service-detector`
- `txt_record` findings from `txt-fingerprint`
- domain metadata snippets that naturally belong with infrastructure overview, such as nameservers

### Do not include here

- TLS issuer / SAN / cert validity
- robots.txt
- full registrar/contact metadata cards
- raw redirect chain

### Required sub-grouping

- network delivery
- DNS records
- provider / hosting signals
- domain-service detection
- nameservers / TXT summary

### Critical provenance rule

If a nuclei finding belongs to the original domain vs final domain, the UI must show that explicitly.

Recommended pattern:

- section-level cards with badges like `original domain`, `final domain`, `final url`

## 6. TLS & fingerprints

Contents:

- TLS issuer
- subject/SAN
- serial
- validity window
- TLS version
- cipher
- SNI
- JARM
- favicon hashes and favicon URL/path
- body/header hashes
- SSL-related nuclei findings (`ssl-dns-names`, `ssl-issuer`)

Sources:

- httpx TLS / JARM / favicon / hashes
- nuclei SSL templates

Rules:

- this should be one cohesive identity/fingerprinting area
- keep certificate facts separate from DNS/provider facts

## 7. Domain intelligence

Contents:

- registrar
- registrar IANA ID
- registrar URL
- registrar email / phone
- registration date / updated date / expiration date
- DNSSEC
- domain status values
- nameservers if a separate card reads better here than in infrastructure
- subject-scoped groupings for original/final domain

Sources:

- nuclei `domain_metadata` findings from `rdap-whois`

Rules:

- this section should absorb the mockup’s current “Domain Info” card
- if nameservers are shown in both this section and infrastructure, use summary/detail rather than duplicating full lists verbatim

## 8. Content signals

Contents:

- body preview
- content length
- body domains
- body FQDNs
- CSP-derived domains if exposed by current normalized shape
- robots.txt availability / details

Sources:

- httpx body/csp-derived fields
- nuclei `robots_txt`

Rules:

- keep this separate from delivery and DNS
- body-derived domains are content observations, not DNS answers

## 9. Homepage screenshot

Contents:

- screenshot preview
- screenshot status / placeholder / unavailable state

Sources:

- screenshot metadata and screenshot route

Rules:

- use the authenticated screenshot route
- do not inline or duplicate screenshot storage logic in the page

## 10. Previous scans

Contents:

- target-specific prior scan list
- link to older runs
- status and high-level summary chips

Sources:

- `getTargetHistoryForScan()`

## 11. Raw evidence

Contents:

- raw httpx JSON
- normalized nuclei block
- optionally expandable raw nuclei match evidence if future UX warrants it

Rules:

- raw evidence must remain explicit and reachable
- do not hide this behind an impossible-to-discover affordance

---

## Required provenance and state rules

## Provenance labels

Every redesign section that mixes sources must preserve at least one of:

- source label: `httpx`, `nuclei`, `derived`
- target-context label: `original domain`, `final domain`, `final url`
- subtle grouped headings that make the origin unambiguous

This matters most for:

- DNS & infrastructure
- Domain intelligence
- TLS & fingerprints
- Technologies

## State model

Each section needs explicit rendering rules for:

- `pending` — data is expected but worker/page state is not complete yet
- `empty` — data source completed and yielded nothing meaningful
- `failed` — source ran but failed
- `not_run` / `skipped` — scanner state says this source did not execute
- `stale` — server snapshot exists but active scan is still progressing

Examples:

- page has httpx result but nuclei is still pending
- scan exists but no primary result yet
- nuclei failed after httpx succeeded
- screenshot not yet captured even though the page is otherwise complete

---

## Proposed component architecture from scratch

If the page were rebuilt cleanly, use this component tree.

## Route and data layer

### `app/(authenticated)/scans/[scanId]/page.tsx`

Responsibilities:

- auth/session check
- fetch scan record/detail/results/history in parallel
- select primary result
- build top-level view model
- render server sections
- mount live client updater

### New: `lib/server/scans/scan-detail-view-model.ts`

Responsibilities:

- centralize section-level mapping
- move section grouping logic out of leaf UI where possible
- preserve source and target provenance
- return a stable shape for the redesigned page

Suggested exports:

- `buildScanDetailPageViewModel(...)`
- `buildOverviewSection(...)`
- `buildTechnologySection(...)`
- `buildDeliveryRedirectsSection(...)`
- `buildDnsInfrastructureSection(...)`
- `buildTlsFingerprintsSection(...)`
- `buildDomainIntelligenceSection(...)`
- `buildContentSignalsSection(...)`
- `buildRawEvidenceSection(...)`

## Client live-refresh layer

### Keep: `components/scans/scan-detail-live-client.tsx`

Responsibilities:

- subscribe to `/api/v1/scans/[scanId]/events`
- refresh the route on relevant events

Do not expand this into a client-owned data-fetching page.

## Proposed presentational components

### Frame and header

- `ScanDetailHeader`
- `ScanDetailQuickActions`
- `ScanDetailStatusMeta`
- `ScanAttemptSummary`

### Summary and stack

- `ScanOverviewMetrics`
- `ScanTechnologySection`
- `TechnologyGroupCard`
- `TechnologySourceBadge` (optional)

### Evidence sections

- `ScanDeliveryRedirectsSection`
- `RedirectChainCard`
- `ScanDnsInfrastructureSection`
- `DnsRecordsCard`
- `InfrastructureSignalsCard`
- `NucleiDomainServicesCard`
- `ScanTlsFingerprintsSection`
- `TlsCertificateCard`
- `FingerprintArtifactsCard`
- `ScanDomainIntelligenceSection`
- `DomainMetadataCard`
- `ScanContentSignalsSection`
- `BodyDomainsCard`
- `RobotsTxtCard`
- `ScreenshotPreviewCard`

### Supporting shared pieces

- `EvidenceSection`
- `EvidenceKeyValueGrid`
- `TargetContextBadge`
- `SourceBadge`
- `SectionEmptyState`
- `SectionPendingState`
- `SectionErrorState`

### Existing components that may be kept/adapted

- `ScanHero`
- `ScanOverviewStrip`
- `TargetHistory`
- `RawEvidenceTabs`

### Existing components likely to be replaced or heavily reworked

- `ScanFindingsWorkspace`
- `TechnicalEvidenceSection`
- `VisualContentContext`

Reason: the redesign is no longer tab-first; it is section-first and consolidation-first.

---

## Refactor strategy

## Phase 1 — lock the contract

- document the final section map and view-model shape
- add fixture coverage for redirect and nuclei target-context cases
- decide which old components can be adapted vs replaced

## Phase 2 — extract section view-models

- move section grouping logic into a dedicated view-model builder
- reduce ad hoc nuclei parsing inside presentational components
- keep the page visually unchanged while extracting logic first

## Phase 3 — rebuild the layout to match the redesign

- implement new frame/header/grid/sidebar layout
- drop in mapped section components one by one
- preserve raw evidence and history throughout

## Phase 4 — wire edge states

- no-primary-result-yet
- nuclei pending/running/failed/skipped
- screenshot missing/pending
- cross-domain redirect scenarios

## Phase 5 — cleanup

- remove superseded section components
- reduce duplicate grouping utilities
- update docs/tests to match the new structure

---

## Verification plan

Use the actual repo scripts from `package.json`.

### Required commands

- `npm run test`
- `npm run typecheck`
- `npm run build`

### Required fixture/test scenarios

- no primary result yet
- same-domain redirect
- cross-domain redirect
- nuclei original-domain findings only
- nuclei final-domain findings only
- original-domain and final-domain findings both present
- httpx complete while nuclei is pending
- nuclei failed after httpx success
- empty optional fields (no TLS details, no screenshot, no WP, no CPE)
- duplicate technology evidence across httpx + nuclei + CPE-derived enrichment

### Suggested stable selectors for UI verification

- `data-testid="scan-detail-header"`
- `data-testid="overview-status"`
- `data-testid="redirect-chain-card"`
- `data-testid="dns-infrastructure-section"`
- `data-testid="nuclei-original-domain-badge"`
- `data-testid="nuclei-final-domain-badge"`
- `data-testid="tls-fingerprints-section"`
- `data-testid="domain-intelligence-section"`
- `data-testid="content-signals-section"`
- `data-testid="raw-evidence-button"`

### Acceptance criteria

- the redesigned page preserves all major data families currently surfaced by the live page
- consolidated sections do not lose source or target provenance
- cross-domain redirect scans show original-domain and final-domain nuclei findings distinctly
- redirect chain remains inspectable, not summary-only
- raw evidence remains accessible
- server render works without waiting for client hydration
- active scans continue to refresh correctly through SSE
- tests, typecheck, and build all pass

---

## Recommended implementation notes

### Keep these boundaries

- DB and worker schemas remain unchanged for this redesign
- `read-service` stays the main data source for the page
- worker flags/templates stay implementation details unless they affect meaning on the page

### Improve these boundaries

- move section grouping out of leaf components and into a view-model layer
- keep presentational components mostly dumb
- avoid recomputing technology grouping or nuclei parsing in multiple places

### Do not do this

- do not rebuild the page as one giant client component
- do not flatten original/final domain findings into one mixed list
- do not hide raw evidence behind a dead-end interaction
- do not treat the mockup as exhaustive data coverage

---

## Open questions for implementation kickoff

These are not blockers to the plan, but they should be answered before coding starts.

1. Should domain nameservers live primarily in `DNS & infrastructure`, `Domain intelligence`, or appear as summary/detail across both?
2. Should robots.txt remain its own card or move fully into `Content signals`?
3. Should the redesigned page keep a right sidebar on large screens or collapse into a single-column stacked layout with anchored sections?
4. Should technology provenance be visibly labeled in the UI, or should dedupe happen silently with provenance retained only in view-model/debug layers?

---

## Bottom line

The redesign should be implemented as a **contract-first refactor**:

1. preserve scan-level state and server-first rendering
2. keep one primary result driving the page
3. introduce section-level view-model mapping
4. consolidate httpx + nuclei evidence with explicit provenance
5. match the mockup’s cleaner hierarchy without losing the current page’s technical depth

If we follow that sequence, the redesigned page can look substantially simpler while still being more correct than the mockup alone.
