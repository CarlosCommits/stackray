# Stackray Pages

## UI principles

- prioritize scannability over dense raw output
- show normalized insights first and raw evidence second
- design pages to work well on desktop and mobile
- load first data server-side and layer in live updates progressively

## Page inventory

## 1. `/`

### Purpose

Public landing page with sign-in call-to-action.

### Sections

- product hero and value proposition
- key product benefits and example outputs
- primary call-to-action to sign in

### Key actions

- open `/sign-in`
- continue to `/dashboard` after signing in

## 2. `/sign-in`

### Purpose

Primary Better Auth sign-in page.

### Key actions

- sign in with email/password
- navigate to `/forgot-password`

## 3. `/forgot-password`

### Purpose

Request a password reset email when Resend is configured.

### Key actions

- request password reset email
- fall back to admin-managed temp-password flow when email is disabled

## 4. `/reset-password`

### Purpose

Complete a Better Auth password reset using the reset token.

## 5. `/change-password`

### Purpose

Force a user to replace a temporary password before entering the product.

## 6. `/dashboard`

### Purpose

Authenticated dashboard and home base for active work.

### Sections

- quick scan input
- recent scans summary
- active or recently completed scan states
- usage summary cards

### Key actions

- submit scan
- open recent scan

## 7. `/scans/new`

### Purpose

Dedicated scan configuration form.

### Inputs

- single URL or domain
- optional advanced toggles
- optional idempotency label/note

### Output

On submit, redirect to `/scans/[scanId]`.

## 8. `/scans/[scanId]`

### Purpose

Live and historical scan detail page.

### Sections

- scan header: status, timestamps, actor
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

## 9. `/runs`

### Purpose

Global scan runs.

This page is scan-run-centric, not target-centric.

### Filters

- date range
- status
- actor source (`ui`, `cli`, `api`)
- target substring

### Columns

- submitted at
- target
- status
- source
- created by
- duration
- top technologies

## 10. `/targets`

### Purpose

Target inventory over stored scan results.

Shows the latest successful result per canonical target. Expanding a target reveals recent historical runs for that canonical target.

### Search controls

- free text
- technology filter
- CDN filter
- server filter
- status code filter
- date range

### Result cards/table

- target
- most recent title
- most recent technologies
- last scanned at
- latest scan link

## 11. `/settings/api-keys`

### Purpose

Manage API keys for scripts, CI jobs, scheduled workers, and other API clients.

### Current state

- the page is wired to real API key CRUD APIs
- it supports create, one-time API key reveal, list, and revoke
- it is hidden for users whose API key access has been disabled by an admin
- includes a link to the API quickstart guide at `/settings/api-docs`

## 12. `/settings/api-docs`

### Purpose

Authenticated API quickstart and reference documentation.

### Sections

- authentication modes (bearer API key vs session)
- base URL
- workflow guides: submit scan, watch progress, fetch results, list runs, query targets
- API key management (session auth)
- error handling reference

### Entry points

- linked from `/settings/api-keys` for users who want to integrate via API
- not a primary sidebar destination — discoverable from the API keys page

## 13. `/settings/users`

### Purpose

Admin-only user management surface.

### Actions

- create user
- assign role (`admin`, `user`, `viewer`)
- issue temp password
- trigger password reset email when configured
- delete user

## Route-group model

- `app/(public)/...` organizes public pages like `/`, `/sign-in`, and password flows
- `app/(authenticated)/...` organizes signed-in product pages like `/dashboard`, `/runs`, and `/targets`
- route-group folder names are implementation-only and do not appear in the visible URL

## Sidebar navigation model

Dedicated authenticated sidebar destinations:

- `/dashboard`
- `/runs`
- `/targets`
- `/settings/api-keys` (when API key access is enabled)
- `/settings/users` (admins only)

Non-sidebar drill-down or task pages:

- `/scans/new`
- `/scans/[scanId]`

## Design notes

- use server-side parallel fetches for scan overview + latest results + runs
- keep large raw response payloads behind explicit expand actions
- use sticky filter bars on runs and search pages
- use optimistic UI only for non-critical actions like saving filters, not for scan completion states
