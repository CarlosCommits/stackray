# Stackray Pages

## UI principles

- prioritize scannability over dense raw output
- show normalized insights first and raw evidence second
- design pages to work well on desktop and mobile
- load first data server-side and layer in live updates progressively
- keep scan completion state tied to persisted records, not optimistic UI

## Page inventory

## 1. `/`

### Purpose

Public landing and sign-in surface.

The page renders the product hero and `LoginStage`. Authenticated users are redirected to `/dashboard`, or to `/change-password` when a temporary password must be replaced. If first-run bootstrap is open, unauthenticated users are redirected to `/setup`.

### Sections

- product hero
- GitHub link
- local-development setup link when dev actor preview is enabled
- email/password sign-in form

### Key actions

- sign in with email/password
- enter demo mode when demo mode is enabled
- continue to `/dashboard` after signing in

## 2. `/setup`

### Purpose

First-run administrator bootstrap.

### Behavior

- renders the first-admin setup form while bootstrap is open
- redirects demo deployments to `/dashboard`
- redirects completed authenticated users to `/dashboard`
- redirects unauthenticated users back to `/` after bootstrap has closed
- allows a local development preview when `STACKRAY_ENABLE_DEV_ACTOR=true`

## 3. `/sign-in`

### Purpose

Compatibility redirect.

### Behavior

Redirects to `/`; the root page owns the active sign-in UI.

## 4. `/forgot-password`

### Purpose

Request a password reset email when email delivery is configured.

### Key actions

- request password reset email
- show the admin-managed temporary password fallback when email is disabled

## 5. `/reset-password`

### Purpose

Complete a Better Auth password reset using the reset token in the query string.

## 6. `/change-password`

### Purpose

Force a user to replace a temporary password before entering the product.

### Behavior

- redirects unauthenticated users to `/`
- redirects users without `requiresPasswordChange` to `/dashboard`

## 7. `/settings/account`

### Purpose

Authenticated account security settings.

### Key actions

- change the current user's password
- optionally sign out other active sessions after changing the password

## 8. `/dashboard`

### Purpose

Authenticated home base for active work.

### Sections

- quick scan command bar
- overview metrics
- recent scan sequence
- active scan polling for analyzing scans

### Key actions

- submit scan
- open recent scan
- load more recent scans

## 9. `/scans/new`

### Purpose

Dedicated scan configuration form.

### Inputs

- target URL or domain
- initial target from the `target` query parameter
- scan options supported by the scan contract

### Output

On submit, redirect to `/scans/[scanId]`.

## 10. `/scans/[scanId]`

### Purpose

Live and historical scan detail page.

### Sections

- scan header and overview band
- live client for SSE-driven updates
- technologies
- delivery, redirects, and scan information
- DNS infrastructure and network intelligence
- TLS certificate and fingerprints
- domain information and robots.txt
- subdomains
- screenshot and content signals
- target history
- raw evidence, including nuclei details

### Behavior

- require an authenticated app session
- load scan record, detail payload, authoritative result, target history, and subdomains server-side
- subscribe to persisted scan events if the scan is still changing
- return not found for scans the actor cannot access

## 10. `/scans/redesign`

### Purpose

Authenticated scan-detail prototype page with static sample data.

### Notes

This route is not part of primary navigation. Treat it as an internal design/prototype surface unless it is removed or promoted.

## 11. `/runs`

### Purpose

Global scan runs.

This page is scan-run-centric, not target-centric.

### Filters

- text search
- normalized status
- actor source (`ui`, `cli`, `api`, `system`)

### Columns

- submitted at
- targets
- status
- source
- created by
- duration
- phase progress
- top technologies

## 12. `/targets`

### Purpose

Target inventory over stored scan results.

Shows the latest result per canonical target. Expanding a target reveals recent historical runs for that canonical target.

### Search controls

- free text
- technology filter
- CDN filter
- server filter
- WordPress plugin filter
- WordPress theme filter
- CPE filter
- status code filter
- date range

### Result cards/table

- target
- latest title and favicon
- latest technologies
- screenshot preview when available
- last scanned at
- latest scan link
- target history

## 13. `/technology-compare`

### Purpose

Compare targets that share selected technologies and export a shareable visual.

### Controls

- technology multi-select
- suggested technology combinations
- site filter
- export target selection
- export style
- brand visibility toggle
- copy or download image

### Data source

Uses `/api/v1/targets/technology-comparison` and `/api/v1/targets/technology-options`.

## 14. `/schedules`

### Purpose

Manage recurring scan schedules.

### Actions

- create daily, weekly, or monthly schedules
- enter one or more targets
- choose local time and timezone
- edit schedule definitions
- pause or resume schedules
- delete schedules

### Notes

Schedule dispatch is handled by Graphile Worker through the `schedule_due_scans` task. Demo mode disables schedule creation and hides account controls.

## 15. `/settings/api-keys`

### Purpose

Manage API keys for scripts, CI jobs, scheduled workers, and other API clients.

### Current state

- hidden in demo mode
- shows a disabled state when the user's API key access is off
- supports create, one-time API key reveal, list, and revoke
- includes a link to the API quickstart guide at `/settings/api-docs`

## 16. `/settings/api-docs`

### Purpose

Authenticated API quickstart and reference documentation.

### Sections

- authentication modes
- base URL
- scan workflow examples
- runs and target lookup
- schedules
- API key management notes
- error handling reference

### Entry points

- linked from `/settings/api-keys`
- not a primary sidebar destination

## 17. `/settings/users`

### Purpose

Admin-only user management surface.

### Actions

- create user
- assign role (`admin`, `user`, `viewer`)
- manage API key access for non-admin users
- issue temporary password
- trigger password reset email when configured
- delete user

### Behavior

- hidden in demo mode
- redirects non-admin authenticated users to `/dashboard`

## Route-group model

- `app/(public)/...` organizes `/`, `/sign-in`, and password flows
- `app/(authenticated)/...` organizes signed-in product pages
- `app/setup/page.tsx` is outside both route groups because first-run bootstrap can be reached before a session exists
- route-group folder names are implementation-only and do not appear in the visible URL

## Sidebar navigation model

Dedicated authenticated sidebar destinations:

- `/dashboard`
- `/targets`
- `/runs`
- `/technology-compare`
- `/schedules`
- `/settings/api-keys` when API key access is enabled
- `/settings/users` for admins only

Non-sidebar drill-down or task pages:

- `/scans/new`
- `/scans/[scanId]`
- `/scans/redesign`
- `/settings/api-docs`

## Design notes

- use server-side fetches for initial page data
- keep large raw response payloads behind explicit expand actions
- use sticky filter bars on runs and targets pages
- poll or subscribe only while active scans need updates
- use optimistic UI only for non-critical actions like local scan-list insertion, not for scan completion states
