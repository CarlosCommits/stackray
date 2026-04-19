# Single-target scan refactor plan

## Goal

Refactor the product from a multi-target scan model to a strict invariant:

- **one scan = one domain/url**

This plan is intentionally destructive.

## Fixed assumptions

- The project is **pre-prod**.
- Existing database data does **not** need to survive.
- We can spin up a new database.
- We do **not** need fallbacks, dual-write, backfills, or compatibility shims.
- Scans become singular, but schedules may still group multiple target domains and fan out into many scans.

---

## Why this refactor is warranted

The current schema and backend model are clearly multi-target:

- `createScanRequestSchema` accepts `targets: string[]`
- `createScan()` normalizes multiple targets and inserts multiple `scanTargets`
- `scanResults` hangs off `scanTargetId`
- schedule creation and worker execution both assume plural targets

But the product semantics are much closer to singular:

- `/scans/new` is presented as a primary target flow
- `/dashboard` cards display one target per scan
- `/scans/[scanId]` picks a primary target/result for display
- `/targets` already treats each row as one canonical target
- the schema is making scan-level vs result-level API concepts harder to explain than the product actually is

This mismatch is the main reason to simplify.

---

## Current model in code

## Core schema

- `drizzle/schema.ts`
  - `scans`
    - includes `targetCount`
  - `scanTargets`
    - one-or-many targets per scan
    - fields: `scanId`, `canonicalTargetId`, `inputTarget`, `normalizedTarget`, `sortOrder`
  - `scanResults`
    - each result points to a target with `scanTargetId`
  - `scanSchedules`
    - includes `targetCount`
  - `scanScheduleTargets`
    - one-or-many scheduled targets per schedule

## Contracts

- `lib/contracts/scans.ts`
  - `createScanRequestSchema` accepts `targets[]`
  - `getScanResponseSchema` returns `targets[]`
  - progress uses `processedTargets` / `totalTargets`
  - list items expose `targetCount`
- `lib/contracts/events.ts`
  - progress events use `processedTargets` / `totalTargets`
- `lib/contracts/runs.ts`
  - runs rows expose `targetCount`, `targetUrls`, `hiddenTargetCount`

## Services and workers

- `lib/server/scans/create-service.ts`
  - normalizes plural targets
  - computes `requestFingerprint` from a target list
  - inserts many `scanTargets`
- `lib/server/scans/read-service.ts`
  - builds target maps per scan
  - returns `targets[]`
  - computes progress from distinct `scanTargetId`
- `lib/server/schedules/service.ts`
  - replaces plural `scanScheduleTargets`
- `worker/schedules.ts`
  - creates scheduled scans from `inputTargets`
- `worker/scan-worker.ts`
  - loads `targets: ScanTargetRow[]`
  - passes all targets into scan execution
  - resolves incoming payloads against multiple scan targets
  - persists `scanResults.scanTargetId`

## Pages and routes

- `components/scans/new-scan-form.tsx`
  - currently supports a primary target plus optional newline-separated target list
  - submits `targets[]`
- `app/api/v1/scans/route.ts`
  - POST accepts plural target payloads
- `app/(authenticated)/scans/[scanId]/page.tsx`
  - scan detail currently treats the first target as the primary target for display
- `components/dashboard/recent-scan-card.tsx`
  - dashboard shows one target string per scan card
- `components/runs/*`
  - runs UI currently reflects multi-target scans via `targetUrls` and counts
- `components/targets/*`
  - targets UI is already single-target per row

## Docs and tests with plural semantics

- ``
- ``
- `docs/pages.md`
- `worker/scan-worker.test.ts`
- `lib/server/scans/read-service.test.ts`
- `lib/mocks/scans.ts`

---

## Target model after the refactor

After the refactor, a scan should directly own exactly one target.

Conceptually:

- `scan`
  - singular target/domain/url
  - scan options
  - status / timing
- `scanResult`
  - one-or-many observed result rows produced while scanning that one target
  - still valid to keep result-level granularity if retries, redirect profiles, or other execution details produce multiple persisted result rows

Important distinction:

- this refactor removes **multi-target scans**
- it does **not** necessarily require one `scan` to have only one `scanResult` row

That means:

- scan-level technologies = everything found while scanning that one target/domain
- result-level technologies = the flat inventory for one exact persisted result row for that target/domain

---

## Recommended schema changes

## 1. Collapse target identity onto `scans`

Add required singular target fields directly on `scans`, likely using the existing naming conventions:

- `inputTarget`
- `normalizedTarget`
- `canonicalTargetId`

Keep the names aligned with the rest of the codebase unless there is a strong reason to rename them.

## 2. Remove `scanTargets`

Delete the join table entirely.

Reason:

- under the new invariant it becomes structural overhead with no remaining product meaning

## 3. Change `scanResults`

Remove `scanTargetId`.

Replace target association with direct scan ownership only:

- `scanResults.scanId` remains
- any target-specific lookup should come from the parent scan

If any result row still needs an explicit target snapshot field for audit/debug reasons, store it directly on `scanResults`, not through a join table.

## 4. Keep schedules plural, but make schedule fires fan out into many singular scans

`scanSchedules` and `scanScheduleTargets` should remain plural.

Required changes:

- keep `scanScheduleTargets` as the grouping layer for scheduled targets
- keep `targetCount` on schedules if it remains useful for the schedules UI
- change schedule dispatch so one schedule firing creates one scan per target
- redesign `scanScheduleRuns` so one scheduled occurrence can represent many emitted scans
- add an explicit schedule-run-to-scan join model (`scanScheduleRunScans`) to preserve that grouping

---

## Contract changes

## Create scan

Replace:

```ts
{ targets: string[] }
```

with something singular:

```ts
{ target: string }
```

Update:

- `createScanRequestSchema`
- inferred `CreateScanRequest` type
- API docs examples
- error messages

## Scan detail

Replace plural target response shapes with singular target fields.

Update:

- `getScanResponseSchema`
- any UI/server types built from it

Remove:

- `targets[]`
- `processedTargets`
- `totalTargets`
- `targetCount` where they no longer describe real product behavior

## Runs contracts

Decide whether runs should:

- expose a singular `target` string
- or keep `targetUrls[]` only if multiple result rows for one domain still need it

Given the product direction, the preferred outcome is likely singular target output for runs as well.

---

## Service and worker refactor scope

## `lib/server/scans/create-service.ts`

Refactor to:

- accept one target
- normalize one target
- compute `requestFingerprint` from one normalized target string, not an array
- insert target identity directly on `scans`
- stop inserting `scanTargets`

## `lib/server/scans/read-service.ts`

Refactor to:

- stop building `scanTargets` maps
- stop returning `targets[]`
- stop computing progress via distinct target IDs
- read scan target identity directly from `scans`
- keep result-level logic focused on scan/results, not scan/targets/results

## `worker/scan-worker.ts`

Refactor to:

- stop loading arrays of targets for claimed scans
- stop resolving payloads against many targets
- operate on one scan target identity
- persist `scanResults` without `scanTargetId`
- simplify progress semantics to result/execution progress rather than target progress

## `worker/schedules.ts`

Refactor to:

- keep reading plural `scanScheduleTargets`
- create one singular scan per scheduled target
- create one grouped schedule-run record for the dispatch occurrence
- link emitted scans to that schedule-run group

## `lib/server/schedules/service.ts`

Refactor to:

- keep plural schedule target replacement logic
- update schedule-run summary logic so one schedule run can summarize many emitted scans

---

## Page and component refactor scope

## `/scans/new`

`components/scans/new-scan-form.tsx` should be simplified aggressively:

- remove `buildTargets()`
- remove the optional newline-separated target list
- submit only `target`
- update copy from “one target or a small batch” to singular wording

## `/dashboard`

Likely small cleanup only:

- keep single target card display
- ensure the data source is singular all the way through

## `/scans/[scanId]`

Simplify away “primary target” logic where it only exists because the schema is plural.

Examples to revisit:

- `selectPrimaryScanResult(...)`
- any `scan.targets[0]` or first-target fallback logic
- `QuickActionsCard` seeding from `scanDetail.targets.map(...)`

Target outcome:

- scan detail should directly know its one target
- result selection should be about result rows only, not target rows

## `/runs`

Remove multi-target display semantics if they no longer match the model:

- no `+N more`
- no `hiddenTargetCount`
- likely replace `targetUrls[]` with singular target/url fields

## `/targets`

This page is already much closer to the desired mental model.

Main work will be ensuring its backing services no longer depend on multi-target scans upstream.

---

## API route refactor scope

Routes that must be revisited:

- `app/api/v1/scans/route.ts`
- `app/api/v1/scans/[scanId]/route.ts`
- `app/api/v1/scans/[scanId]/results/route.ts`
- `app/api/v1/scans/[scanId]/technologies/route.ts`
- `app/api/v1/scans/[scanId]/results/[resultId]/technologies/route.ts`
- `app/api/v1/runs/route.ts`
- `app/api/v1/targets/results/route.ts`
- `app/api/v1/targets/[canonicalTargetId]/history/route.ts`
- schedule routes if they expose plural targets today

The goal is not to redesign every endpoint. The goal is to remove target-array assumptions where they only exist because scans were modeled as multi-target.

---

## Docs to update

At minimum:

- ``
- ``
- `docs/pages.md`
- `docs/architecture.md` if it mentions scans/targets multiplicity
- `` if it reflects multi-target worker assumptions

Docs should explicitly say:

- one scan represents one domain/url
- create-scan is singular
- schedules may group many targets and fan out into many scans
- this refactor assumes destructive pre-prod reset

---

## Test strategy

## Schema and contract tests

Verify:

- old plural `targets[]` contract is rejected
- new singular `target` contract is accepted
- scan detail responses no longer expose `targets[]`

## Service tests

Verify:

- create scan persists exactly one target on `scans`
- request fingerprint logic works with singular input
- read service still returns correct scan, run, and target views

## Worker tests

Verify:

- worker executes against one target
- no target-resolution-over-many-targets logic remains
- result persistence works without `scanTargetId`

## Page/component tests

Verify:

- new scan form submits one target only
- runs UI no longer implies multi-target scans
- scan detail does not rely on first-target fallback logic

## Docs/API docs tests

Verify:

- examples and wording reflect the singular scan model

---

## Recommended implementation sequence

## Phase 1 — define the invariant

- commit to one scan = one domain/url
- choose the exact singular field names
- update the plan/docs first so the rest of the refactor has a stable target

## Phase 2 — schema cutover

- move singular target identity onto `scans`
- remove `scanTargets`
- change `scanResults` to no longer depend on `scanTargetId`
- keep `scanScheduleTargets`
- redesign `scanScheduleRuns` to support one schedule firing -> many scans
- add `scanScheduleRunScans`

Because the DB is disposable, do this as a destructive schema reset rather than a compatibility migration path.

## Phase 3 — create/schedule service cutover

- refactor `createScan()`
- refactor schedule persistence and schedule-triggered scan creation
- remove all plural target normalization loops from those paths

## Phase 4 — worker cutover

- refactor claimed scan shape
- remove plural target lookup and payload resolution
- simplify result persistence and progress logic

## Phase 5 — read/API cutover

- update scan detail/list/results/technology routes and read services
- remove plural target response fields and progress counters
- simplify result selection logic in scan detail

## Phase 6 — page/component cutover

- simplify new scan form
- update runs/scan detail/dashboard wording and expectations

## Phase 7 — docs/tests cleanup

- update docs
- update all mocks and fixtures
- remove dead plural-target helpers

---

## Out of scope

- preserving current database data
- backward compatibility for old request bodies
- multi-target fallbacks
- introducing a new batch-scan abstraction in the same refactor

---

## Acceptance criteria

This refactor is complete when all of the following are true:

- a scan stores exactly one target/domain/url
- `scanTargets` is gone
- `scanScheduleTargets` remains the grouping layer for schedule targets
- `scanScheduleRuns` can represent one dispatch that emitted many scans
- `scanResults` no longer require `scanTargetId`
- `POST /api/v1/scans` accepts singular target input only
- scan detail no longer returns `targets[]`
- pages and docs consistently describe scans as singular
- worker and schedules no longer process scans as multi-target
- tests pass on the new singular model

---

## Recommended file groups to inspect while implementing

## Schema / persistence

- `drizzle/schema.ts`
- `lib/db/schema.ts`

## Scan services

- `lib/server/scans/create-service.ts`
- `lib/server/scans/read-service.ts`
- `lib/server/scans/result-selection.ts`
- `lib/server/scans/normalize-targets.ts`

## Schedule services / workers

- `lib/server/schedules/service.ts`
- `worker/schedules.ts`
- `worker/scan-worker.ts`

## Contracts / routes

- `lib/contracts/scans.ts`
- `lib/contracts/events.ts`
- `lib/contracts/runs.ts`
- `app/api/v1/scans/route.ts`
- `app/api/v1/scans/[scanId]/**`
- `app/api/v1/runs/route.ts`
- `app/api/v1/targets/**`

## UI

- `components/scans/new-scan-form.tsx`
- `app/(authenticated)/scans/new/page.tsx`
- `app/(authenticated)/scans/[scanId]/page.tsx`
- `components/dashboard/*`
- `components/runs/*`
- `components/targets/*`

## Docs / tests / mocks

- ``
- ``
- `docs/pages.md`
- `lib/mocks/scans.ts`
- `worker/scan-worker.test.ts`
- `lib/server/scans/read-service.test.ts`
