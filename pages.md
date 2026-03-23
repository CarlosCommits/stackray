# Stackray Pages

## UI principles

- prioritize scannability over dense raw output
- show normalized insights first and raw evidence second
- design pages to work well on desktop and mobile
- load first data server-side and layer in live updates progressively

## Page inventory

## 1. `/`

### Purpose

Public landing and login hybrid page.

### Sections

- product hero and value proposition
- login form or login call-to-action
- key product benefits and example outputs
- primary call-to-action to enter the app

### Key actions

- sign in
- create account
- continue to `/dashboard` if already authenticated

## 2. `/dashboard`

### Purpose

Authenticated dashboard and home base for active work.

### Sections

- quick scan input
- recent scans summary
- active or recently completed scan states
- saved searches shortcuts
- usage summary cards

### Key actions

- submit scan
- open recent scan
- open saved search

## 3. `/scans/new`

### Purpose

Dedicated scan configuration form.

### Inputs

- single URL or multi-target list
- scan profile
- optional advanced toggles
- optional idempotency label/note

### Output

On submit, redirect to `/scans/[scanId]`.

## 4. `/scans/[scanId]`

### Purpose

Live and historical scan detail page.

### Sections

- scan header: status, timestamps, actor, profile
- progress bar and live event feed
- summary cards: technologies, CDN/WAF, title, server, favicon, JARM
- target results table
- WordPress section
- CPE section
- raw JSON drawer
- related scans history panel

### Behavior

- load initial scan snapshot server-side
- subscribe to SSE for status and incremental results if scan is not terminal

## 5. `/scans/[scanId]/compare/[baselineScanId]`

### Purpose

Compare two scans.

### Sections

- scan selectors
- high-level diff summary
- added technologies
- removed technologies
- metadata changes
- target-level differences

## 6. `/history`

### Purpose

Workspace-wide scan history.

This page is scan-run-centric, not target-centric.

### Filters

- date range
- status
- actor source (`ui`, `cli`, `api`)
- profile
- target substring

### Columns

- submitted at
- target count
- status
- source
- created by
- duration
- top technologies

## 7. `/search`

### Purpose

Cross-scan search over stored results.

Default mode shows the latest successful result per canonical target. An advanced snapshots mode can expose every historical match.

### Search controls

- free text
- technology filter
- CDN filter
- server filter
- WordPress plugin filter
- CPE filter
- status code filter
- date range

### Result cards/table

- target
- most recent title
- most recent technologies
- last scanned at
- latest scan link

## 8. `/targets/[targetId]`

### Purpose

Timeline page for a canonical target.

### Sections

- current known summary
- scan timeline
- change feed
- compare latest to previous

## 9. `/saved-searches`

### Purpose

Manage reusable search queries.

### Actions

- create saved search
- rename
- pin to home
- delete

## 10. `/settings/tokens`

### Purpose

Manage API and agent CLI tokens.

### Sections

- create token
- revoke token
- view scopes
- last used metadata

## 11. `/settings/workspace`

### Purpose

Workspace settings and policy page.

### Controls

- allowed scan policy
- default scan profile
- retention settings
- audit visibility

## Route-group model

- `app/(public)/...` organizes public pages like `/`
- `app/(authenticated)/...` organizes signed-in product pages like `/dashboard`, `/history`, and `/search`
- route-group folder names are implementation-only and do not appear in the visible URL

## Sidebar navigation model

Dedicated authenticated sidebar destinations:

- `/dashboard`
- `/history`
- `/search`
- `/saved-searches`
- `/settings/tokens`
- `/settings/workspace`

Non-sidebar drill-down or task pages:

- `/scans/new`
- `/scans/[scanId]`
- `/scans/[scanId]/compare/[baselineScanId]`
- `/targets/[targetId]`

## Design notes

- use server-side parallel fetches for scan overview + latest results + history
- keep large raw response payloads behind explicit expand actions
- use sticky filter bars on history and search pages
- use optimistic UI only for non-critical actions like saving filters, not for scan completion states
