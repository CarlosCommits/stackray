# Scan Detail Component UI Plan

## Goal

This document translates the higher-level scan detail UX plan into a component-by-component implementation plan for `/scans/[id]`.

It focuses on four concrete goals:

1. Increase content density without making the page cramped
2. Raise the baseline readable type size across the scan page
3. Replace the current dim off-white typography with a brighter near-white hierarchy
4. Move styling decisions into global CSS tokens and scan-specific utility classes instead of one-off component overrides

---

## Current Problems To Fix

### Visual density issues

- the page has too many medium-sized cards with too little payload inside them
- important information is split across too many separate modules
- the right column carries too much high-value content in narrow containers
- nested cards make the page feel fragmented instead of analyst-oriented

### Typography issues

- `text-xs` is overused across scan components
- labels, values, and evidence often collapse into nearly the same tiny size
- hashes, IPs, domains, and extracted evidence are often too small for sustained scanning

### Color/contrast issues

- dark mode uses a muddy off-white for primary text
- secondary text is too faint for a data-heavy workflow
- card contrast is too low, so panel boundaries feel soft and underpowered

---

## Global CSS Strategy

Global CSS should carry the visual system. Component-level classes should only tune local density or layout behavior.

### Files

- `app/globals.css`
- optionally `components/ui/card.tsx` for better default title/content sizing

### Token changes

Update dark-mode tokens to a brighter, less brown palette.

#### Typography / text tokens

- `--foreground` → near-white
- `--card-foreground` → near-white
- `--muted-foreground` → brighter cool gray
- `--text-dim` → medium gray-blue, not dusty brown

Suggested direction:

- `--foreground: #f2f4f7`
- `--card-foreground: #eef2f6`
- `--muted-foreground: #aeb8c4`
- `--text-dim: #98a3b3`

#### Surface tokens

Move the current earthy brown surfaces toward a cleaner neutral-dark analytical palette.

Suggested direction:

- `--surface-dark: #161a20`
- `--surface-mid: #1d232c`
- `--surface-light: #252d38`
- `--gray-charcoal: #0f1318`
- `--gray-border: #34404f`

The amber accent can stay.

### Scan-specific utility classes

Add scan-focused utility classes in `globals.css` so scan components stop repeating raw token classes.

Suggested utilities:

- `.scan-page`
- `.scan-section`
- `.scan-panel`
- `.scan-panel-compact`
- `.scan-panel-header`
- `.scan-section-title`
- `.scan-label`
- `.scan-value`
- `.scan-meta`
- `.scan-kpi`
- `.scan-kpi-value`
- `.scan-evidence-code`

These should standardize:

- panel background and border
- panel padding
- title size
- label size
- body text size
- metadata color
- monospace evidence readability

### Typography rules to encode globally

- default scan body text = `text-sm`
- primary evidence rows = `text-sm` or `text-[15px]`
- panel titles = `text-lg`
- section headings = `text-xl`
- KPI values = `text-2xl` or `text-3xl`
- `text-xs` reserved only for tertiary metadata and badge internals

---

## shadcn Components To Use

### Already installed and should be used directly

- `Tabs`
- `Table`
- `Empty`
- `Tooltip`
- `Collapsible`
- `Card`
- `Badge`
- `Separator`

### Components to add now

- `Accordion`
- `ScrollArea`
- `Resizable`
- `HoverCard`

### Why these matter

- `Accordion` reduces vertical sprawl in findings and technical evidence
- `ScrollArea` keeps long findings/debug panels usable without giant page growth
- `Resizable` supports a future analyst split-view mode and can also help debug/raw evidence views
- `HoverCard` gives quick previews for domains, technologies, and evidence facts without forcing more permanent chrome

---

## Top-Level Page Layout

### Current problem

`app/(authenticated)/scans/[scanId]/page.tsx` uses a `lg:grid-cols-3` layout with a heavy right rail. That makes important findings feel cramped.

### Proposed structure

Use a section-first vertical composition, not a card pile split across two uneven columns.

Recommended order:

1. `ScanHero`
2. `ScanOverviewStrip`
3. `ScanFindingsWorkspace`
4. `TechnicalEvidenceSection`
5. `VisualContentContext`
6. `TargetHistory`
7. `RawEvidenceTabs`

### Layout rules

- content should be full-width by default
- only secondary/support content should become a side rail
- large evidence and findings should never live in a narrow third-column by default
- reduce outer padding from the shell for this page where practical

---

## Component Build Plan

## 1. `ScanHero`

### Role

Scan identity and control strip.

### Keep

- scan title / target
- status
- timing / profile / actor metadata
- actions

### Change

- tighten spacing so it reads as a compact header, not a giant intro block
- raise metadata size from `text-xs` to `text-sm`
- make the status state more visually obvious
- use brighter foreground text for primary target/title lines

### Output target

This should feel like a compact analyst page header.

---

## 2. `ScanOverviewStrip` (new)

### Role

Replace the current `ExecutiveSummary` with a denser, more useful summary strip.

### Content

- HTTP status
- redirect count
- landing URL
- host / CDN
- primary IP / ASN
- top technologies

### Component stack

- `Card`
- `Badge`
- `Separator`
- `Tooltip`

### Styling rules

- labels at `text-sm`
- values at `text-xl` / `text-2xl`
- no tiny uppercase labels unless truly tertiary
- less decorative padding, more content fill

### Replaces/evolves

- `components/scans/executive-summary.tsx`

---

## 3. `ScanFindingsWorkspace` (new)

### Role

This becomes the main body of the page.

### Structure

Use `Tabs` at the top level:

- `security`
- `technology`
- `metadata`
- `debug`

If we want fewer top-level tabs, keep `Security Findings` and `Technology Findings` as full-width stacked panels and reserve tabs for raw/debug.

### Why

Findings are the highest-value analyst content and should not be buried in the right rail.

---

## 4. `SecurityFindingsPanel` (new or evolved from `NucleiEvidencePanel`)

### Role

Primary render surface for nuclei findings.

### Grouping

Use `Accordion` groups for:

- Domain Metadata
- DNS Services
- TXT Records
- Nameserver Records
- SSL DNS Names
- SSL Issuer
- Robots.txt
- Other findings

### Card structure per finding

- template title
- severity badge
- matched target / matched-at
- subject and subject type
- extracted evidence area

### Styling rules

- finding title: `text-base`
- matched target: `text-sm`
- evidence rows: `text-sm`
- extracted values must not remain tiny badge soup forever

### Medium-term rendering goal

Allow finding-kind-specific layouts instead of one generic finding card.

---

## 5. `DomainMetadataFindingCard` (new specialized renderer)

### Role

Render RDAP/domain metadata findings in a structured way.

### Current limitation

The current UI only gets `extractedResults: string[]`, so field names are lost. That means phase 1 cannot perfectly label every extracted value.

### Phase 1 fallback

Still render the content using a more structured layout:

- subject domain
- template label
- extracted groups separated visually by type (dates vs domains vs URLs vs nameservers)

### Phase 2 target

Once extractor key/value pairs are preserved, render:

- Registrar Name
- Registrar IANA ID
- Registrar URL
- Registration Date
- Last Changed Date
- Expiration Date
- Nameservers
- DNSSEC / secure DNS
- Registrant fields

### Component stack

- `Card`
- `Separator`
- `Table` or definition-list style layout
- `ScrollArea` if values get long

---

## 6. `TechnologyFindingsPanel` (new)

### Role

Separate technology presentation from general nuclei findings.

### Content

- primary stack
- supporting stack
- inferred technologies
- source attribution (HTTPX / Nuclei / inferred)

### Replaces/evolves

- `components/scans/tech-stack-module.tsx`

### Why

Technology inventory is not the same mental model as security findings.

---

## 7. `TechnicalEvidenceSection` (new)

### Role

Merge HTTPX-derived infrastructure and evidence into one coherent section.

### Consolidates

- `delivery-module.tsx`
- `infrastructure-module.tsx`
- `evidence-panel.tsx`
- parts of `content-signals.tsx`

### Internal subsections

- Delivery / redirects
- DNS / IP / ASN
- TLS / certificate / JARM / favicon
- content fingerprint signals

### Component stack

- `Card`
- `Accordion`
- `Table`
- `Tooltip`

### Rule

Do not nest cards more than necessary. Prefer one section container with strong internal separators.

---

## 8. `VisualContentContext` (new)

### Role

Show what the page looked like and what content was observed.

### Consolidates

- `homepage-screenshot.tsx`
- parts of `content-signals.tsx`

### Content

- screenshot
- page title
- preview/body summary
- extracted domains/FQDNs
- visual/context metadata

### Component stack

- `Card`
- `Separator`
- `Badge`
- `HoverCard` for quick previews if useful

---

## 9. `TargetHistory`

### Near-term

Keep it, but increase text size and reduce dead space.

### Longer-term

If the list grows, convert to `Table` for better scanning.

Suggested columns:

- date
- title
- status
- top technologies
- action

---

## 10. `RawEvidenceTabs` (new)

### Role

Replace the two detached raw viewers with one deliberate debug section.

### Tabs

- HTTPX
- Nuclei
- optional future normalized data tab

### Component stack

- `Tabs`
- `ScrollArea`
- `Collapsible`
- copy/export controls

### Replaces/evolves

- `raw-payload-viewer.tsx`
- `nuclei-raw-payload-viewer.tsx`

---

## Typography Standards

### Required hierarchy

- page title: `text-3xl` / `text-4xl`
- section title: `text-xl`
- panel title: `text-lg`
- body: `text-sm` or `text-[15px]`
- evidence code/mono: `text-sm`
- KPI values: `text-2xl` / `text-3xl`
- tertiary metadata only: `text-xs`

### Explicit anti-patterns to remove

- `text-xs uppercase tracking-wide` on most labels
- `text-xs font-mono` for core evidence
- panels where labels and values are the same tiny size

---

## Spacing Standards

### Page level

- reduce shell/page dead space
- use full-width sections for findings and evidence
- avoid a narrow evidence rail for high-value content

### Panel level

- important panels should use `p-5` or `p-6`
- compact utility panels may use `p-4`
- avoid repeated nested `p-3` cards inside `p-4` cards unless there is a strong grouping reason

### Rhythm

- use `gap-*`, not `space-y-*` in new component work where possible
- favor fewer, stronger sections over many small stacked cards

---

## Responsive Behavior

### Desktop

- section-first full-width layout
- findings and evidence should dominate width

### Tablet

- preserve section order
- reduce card columns before reducing type size

### Mobile

- stack all summary cards vertically or in 2-up grids only if readable
- avoid micro-badges and dense inline metadata rows
- raw/debug panels should rely on tabs + scroll areas, not wide overflowing layouts

---

## Suggested shadcn Install Order

1. `accordion`
2. `scroll-area`
3. `resizable`
4. `hover-card`

---

## Suggested Implementation Order

### Phase 1 — visual system

- update `globals.css` tokens
- add scan-specific utility classes
- improve card title/content defaults if needed

### Phase 2 — page layout

- restructure `page.tsx`
- introduce overview strip and findings workspace

### Phase 3 — findings and evidence

- rebuild nuclei findings UI
- consolidate technical evidence
- merge screenshot and content context

### Phase 4 — debug and polish

- unify raw evidence into tabs
- add hover previews where useful
- refine responsive behavior

---

## Verification Checklist

### Visual QA

- main data owns horizontal width
- body text is readable at normal zoom on laptop
- primary text reads as near-white, not muddy tan
- findings are not buried in a side column
- card content feels full, not hollow

### Component QA

- no critical evidence rendered at `text-xs`
- badges are secondary, not the main content system
- long evidence lists stay usable via `ScrollArea`
- accordions improve scanability instead of hiding too much

### Future-proofing

- page structure can absorb more nuclei finding kinds without adding another rail of cards
- RDAP/domain metadata can evolve into a structured renderer without redoing the entire page layout

---

## Summary

The redesign should make `/scans/[id]` feel like an analyst workspace:

- brighter text
- larger baseline type
- fewer but fuller sections
- findings-first structure
- technical evidence grouped coherently
- raw/debug evidence intentionally separated

The key implementation rule is: **solve contrast, type scale, and panel density globally first, then use component-level composition to express the information architecture cleanly.**
