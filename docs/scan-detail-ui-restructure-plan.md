# Scan Detail UI Restructure Plan

## Scope

This plan covers the `/scans/[id]` page and the current scan detail information architecture for both:

- HTTPX-derived result data
- Nuclei-derived findings and evidence

The goal is to make the page easier to scan, easier to debug, and much better at presenting structured security findings without forcing users to read raw payloads.

---

## Inputs Used For This Plan

This plan is based on both the codebase and a live product review.

### Code paths reviewed

- `app/(authenticated)/scans/[scanId]/page.tsx`
- `components/scans/scan-hero.tsx`
- `components/scans/executive-summary.tsx`
- `components/scans/delivery-module.tsx`
- `components/scans/tech-stack-module.tsx`
- `components/scans/infrastructure-module.tsx`
- `components/scans/evidence-panel.tsx`
- `components/scans/content-signals.tsx`
- `components/scans/nuclei-evidence-panel.tsx`
- `components/scans/raw-payload-viewer.tsx`
- `components/scans/nuclei-raw-payload-viewer.tsx`
- `components/scans/target-history.tsx`
- `lib/server/scans/read-service.ts`
- `lib/contracts/scans.ts`

### Live page review

Reviewed the live page at:

- `https://nextjs-app-production-0298.up.railway.app/scans/659d74c6-7a22-40bc-bce8-f511d1a4934e`

Observations were taken from full-page and sectional screenshots during an authenticated browser session.

---

## Current Page Structure

Today the page renders in this order:

1. `ScanHero`
2. `ExecutiveSummary`
3. Two-column main area
   - Left column
     - `DeliveryModule`
     - `TechStackModule`
     - `InfrastructureModule`
   - Right column
     - `HomepageScreenshot`
     - `EvidencePanel`
     - `ContentSignals`
     - `NucleiEvidencePanel`
4. `TargetHistory`
5. `RawPayloadViewer`
6. `NucleiRawPayloadViewer`

This is implemented directly in `app/(authenticated)/scans/[scanId]/page.tsx`.

---

## Current UX Problems

### 1. The page is organized by implementation modules, not by user questions

The current layout mirrors component ownership rather than operator workflow.

Users usually want to answer questions in this order:

1. What happened?
2. Where did I land?
3. What technologies are here?
4. What infrastructure am I seeing?
5. What security-relevant findings matter?
6. What raw/debug evidence supports this?

The page currently answers these questions out of order and across too many cards.

### 2. The right column is overloaded and semantically mixed

The right rail currently contains:

- screenshot
- TLS/fingerprint evidence
- content signals
- nuclei findings

These are not the same kind of information. Screenshot is visual context, TLS/fingerprint is infrastructure evidence, content signals are extracted page metadata, and nuclei findings are security findings. Grouping them only by “right column” makes the column feel crowded and arbitrary.

### 3. Nuclei findings are visible but not meaningfully structured

`NucleiEvidencePanel` groups by `findingKind`, which is good as a first step, but the actual extracted values are still rendered as a flat badge list:

- no field labels
- no semantic grouping
- no distinction between dates, nameservers, registrar info, statuses, or contact details

This is especially weak for `domain_metadata` / RDAP output. The page can show the data, but not in a way that feels like a purpose-built finding view.

### 4. HTTPX-derived evidence is fragmented across too many cards

The scan detail page spreads related infrastructure/evidence concepts across:

- `InfrastructureModule`
- `EvidencePanel`
- `ContentSignals`
- `DeliveryModule`

The user has to mentally merge redirect behavior, IP/DNS, ASN, TLS, favicon hashes, and content traits.

### 5. Raw/debug payloads are pushed to the very bottom with low contextual connection

The raw viewers are useful, but they currently feel detached from the structured cards above them. They are clearly debug surfaces, but they are not positioned as “supporting evidence for what you just saw.”

### 6. The current page does not clearly separate “summary” from “evidence”

The hero and executive summary give some high-level scan information, but most of the rest of the page is still immediate raw detail. There is not enough progressive disclosure between:

- overview
- findings
- technical evidence
- raw payloads

### 7. Technology display is duplicated conceptually

Technology information currently shows up in both:

- `ExecutiveSummary`
- `TechStackModule`

This creates repetition without adding enough interpretation.

---

## Design Goals

The redesign should optimize for:

1. **Fast operator scanning** — obvious answers near the top
2. **Finding-first workflow** — security-relevant items should not be buried in a side column
3. **Evidence traceability** — every summary should have a clear path to supporting data
4. **Structured rendering** — especially for nuclei and RDAP-derived metadata
5. **Progressive disclosure** — overview first, raw/debug second
6. **Clear source attribution** — HTTPX vs Nuclei vs inferred values
7. **Graceful growth** — more templates and evidence types should not explode the layout

---

## Proposed Information Architecture

Replace the current “left content / right utility column” structure with a more intentional sequence.

### Section 1 — Scan Header

Keep `ScanHero`, but tighten its purpose:

- target
- scan state
- profile/source
- submitted/completed timestamps
- attempt/fallback indicators

No major structural change required here.

### Section 2 — Overview Strip

Keep the high-value summary stats near the top, but reduce duplication.

Suggested cards:

- HTTP status
- redirect count / landing target
- hosting/server/CDN
- primary IP/ASN
- top technologies

This can evolve from `ExecutiveSummary`, but it should focus on “what matters at a glance.”

### Section 3 — Findings Workspace

This should become the central section of the page.

Replace the current side-rail placement of nuclei with a full-width findings area containing two stacked blocks:

#### 3A. Security Findings

Promote nuclei findings to a primary full-width module.

Suggested grouping:

- Domain Metadata
- DNS Services
- TXT Records
- Nameserver Records
- SSL DNS Names
- SSL Issuer
- Robots.txt
- Technology Matches

Within each finding card:

- template label
- subject (`domain`, `domain (original)`, `domain (final)`, `url`)
- severity if present
- matched target / matched-at
- extracted values

For RDAP specifically, do not stop at unlabeled badges forever. The long-term target should be a structured renderer.

#### 3B. Technology Findings

Keep technology presentation separate from general nuclei/security findings.

This should merge:

- `TechStackModule`
- nuclei-derived technology signals
- WordPress/CPE support

Recommended presentation:

- **Primary stack**
- **Secondary stack / supporting tech**
- **WordPress ecosystem**
- **CPE evidence**

Each item should support optional source attribution:

- HTTPX
- Nuclei
- inferred

### Section 4 — Delivery & Infrastructure

Combine the currently fragmented HTTPX/network evidence into one full-width technical section with sub-panels.

Suggested sub-panels:

- Request / delivery / redirects
- DNS / IP / ASN
- TLS / certificate / JARM
- favicon / hash / content characteristics

This can still be componentized internally, but visually it should feel like one coherent “technical evidence” region.

### Section 5 — Visual / Page Content Context

Move screenshot and page content summary into a single contextual section.

Suggested contents:

- screenshot
- page title
- content length
- body preview
- extracted body domains/FQDNs

This improves the relationship between visual appearance and extracted page signals.

### Section 6 — History

Keep `TargetHistory`, but visually treat it as a secondary section after the current scan’s findings/evidence.

### Section 7 — Debug Payloads

Unify the two raw viewers into a single debug section with tabs or segmented controls:

- HTTPX raw payload
- Nuclei raw payload

This should live behind a clearly labeled “Debug / Raw Evidence” boundary.

---

## Recommended Layout Shape

### Proposed top-level structure

```text
ScanHero
Overview Strip

Findings Workspace
  - Security Findings
  - Technology Findings

Delivery & Infrastructure

Visual / Content Context

Target History

Debug / Raw Evidence
  - HTTPX
  - Nuclei
```

This is a better fit than the current 2/3 + 1/3 card pile because it organizes by user intent instead of by internal data producer.

---

## Component Refactor Plan

### Keep mostly as-is

- `scan-hero.tsx`
- `scan-attempt-indicator.tsx`
- `target-history.tsx`

### Evolve / shrink

- `executive-summary.tsx`
  - keep as overview strip
  - reduce duplicate tech detail

- `delivery-module.tsx`
  - keep redirect/request visualization responsibility
  - likely move into a broader technical evidence region

- `infrastructure-module.tsx`
  - keep DNS/ASN/capabilities rendering
  - visually group with TLS/fingerprint evidence

- `evidence-panel.tsx`
  - likely rename to something more specific such as `tls-and-fingerprint-panel`
  - merge into technical evidence section

- `content-signals.tsx`
  - move nearer screenshot/page context

- `tech-stack-module.tsx`
  - make this the dedicated technology workspace
  - optionally add source attribution tags

- `nuclei-evidence-panel.tsx`
  - promote to a primary full-width findings panel
  - add structured rendering strategy hooks for some finding kinds

- `raw-payload-viewer.tsx` and `nuclei-raw-payload-viewer.tsx`
  - merge into a single debug/raw evidence module with sub-tabs

### New components likely needed

- `scan-overview-strip.tsx`
- `scan-findings-workspace.tsx`
- `security-findings-panel.tsx`
- `technology-findings-panel.tsx`
- `technical-evidence-section.tsx`
- `visual-content-context.tsx`
- `raw-evidence-tabs.tsx`

---

## Data/Contract Implications

### Short-term

The page can be reorganized with the current contract shape.

Existing useful fields already available:

- `result.finalUrl`
- `result.redirectChain`
- `result.dns`
- `result.asn`
- `result.tls`
- `result.favicon`
- `result.bodyPreview`
- `result.bodyDomains`
- `result.bodyFqdns`
- `result.nuclei.run`
- `result.nuclei.findings`
- `result.nuclei.technologies`

### Medium-term

If we want a materially better Nuclei/RDAP UI, the current nuclei extracted-results shape is the main bottleneck.

Right now we only preserve:

- `extractedResults: string[]`

That means field names are lost at render time.

For example, the UI cannot reliably distinguish between:

- expiration date
- registrar name
- registrar IANA ID
- registrar URL
- nameservers
- registrant email

without guessing from string shape.

### Recommended medium-term contract improvement

Extend the nuclei match model so selected finding types can preserve structured extraction metadata.

For example, for `domain_metadata`:

- `extractedFields?: Array<{ key: string; value: string }>`

or:

- `structured?: Record<string, string | string[] | boolean>`

This does not need to happen in the first UI layout pass, but the page redesign should leave space for it.

---

## RDAP-Specific UI Recommendation

The page should eventually render `domain_metadata` findings with a dedicated layout.

### Current state

- `Domain Metadata` group exists
- values render as generic badges

### Better target state

For each RDAP card show:

- subject domain
- status
- registration date
- last changed date
- expiration date
- registrar name
- registrar IANA ID
- registrar URL
- registrant org / contact if available
- nameservers
- DNSSEC / secure DNS status

### Important note

This structured RDAP view requires extractor keys to survive the pipeline. Without that, the page can still improve layout, but not full semantic rendering.

---

## Recommended Implementation Phases

### Phase 1 — Layout Reorganization Only

Goal: improve the page without schema changes.

Tasks:

- move nuclei findings out of the right rail and into a full-width findings section
- merge screenshot/content signals into one contextual section
- merge TLS/fingerprint with infrastructure into one technical evidence section
- consolidate raw payload viewers into one debug section
- reduce duplicate technology summary between top cards and stack section

Files likely touched:

- `app/(authenticated)/scans/[scanId]/page.tsx`
- `components/scans/*.tsx`

### Phase 2 — Findings UX Improvement

Goal: make nuclei findings easier to read with current data.

Tasks:

- improve grouping and ordering inside nuclei findings
- add better labels for finding kinds
- add better badge prioritization for dates/urls/domains
- add source/subject context more prominently

### Phase 3 — Structured Finding Models

Goal: render RDAP and other structured findings semantically.

Tasks:

- preserve extractor key/value pairs in the nuclei pipeline
- add dedicated renderers for:
  - RDAP / domain metadata
  - SSL issuer
  - DNS records
  - TXT service detections

Files likely touched:

- `worker/nuclei.ts`
- nuclei persistence/read mapping
- `lib/contracts/scans.ts`
- `lib/server/scans/read-service.ts`
- `components/scans/nuclei-evidence-panel.tsx`

### Phase 4 — Debug / Analyst Workflow Polish

Goal: better operator trust and traceability.

Tasks:

- unify raw payload viewers
- add copy/download controls
- link structured findings to raw evidence anchors
- optionally add a per-source evidence legend

---

## Concrete Recommendations

### Recommendation 1

Make the current page **full-width section-first**, not **column-first**.

### Recommendation 2

Treat **Nuclei findings as a first-class area**, not a side module.

### Recommendation 3

Treat **technology presentation separately from security findings**.

### Recommendation 4

Consolidate **HTTP delivery + infrastructure + TLS evidence** into one technical region.

### Recommendation 5

Plan for **structured RDAP rendering**, even if phase 1 only improves layout.

### Recommendation 6

Collapse raw payloads behind a single **Debug / Raw Evidence** surface.

---

## Suggested First Build Order

If I were implementing this, I would do it in this order:

1. Restructure `page.tsx` section ordering
2. Promote `NucleiEvidencePanel` into a full-width findings section
3. Merge screenshot + content signals into one context section
4. Merge infra + TLS/fingerprint into one technical evidence section
5. Unify raw viewers
6. Improve nuclei finding rendering
7. Add structured RDAP rendering only after extractor field preservation exists

---

## Summary

The current `/scans/[id]` page is functional, but it is organized too much around implementation modules and not enough around operator workflow.

The strongest redesign direction is:

- **overview first**
- **findings second**
- **technical evidence third**
- **context/history next**
- **raw payloads last**

That will make both HTTPX and Nuclei outputs easier to consume, and it sets the page up cleanly for the upcoming RDAP/domain-metadata improvements.
