# Single-target scan implementation checklist

This checklist is the execution companion to `docs/single-target-scan-refactor-plan.md`.

It assumes:

- pre-prod environment
- destructive schema reset is acceptable
- no data migration or compatibility layer is needed
- goal is **one scan = one domain/url**

---

## Phase 0 — Lock the invariant

- [ ] Confirm the product invariant: **one scan = one domain/url**.
- [ ] Confirm we are **not** preserving the existing database.
- [ ] Confirm we are **not** keeping backward-compatible request/response shapes.
- [ ] Confirm that scans are singular but schedules may still batch many targets into many emitted scans.

---

## Phase 1 — Schema cutover

- [ ] Update `drizzle/schema.ts` so `scans` stores a singular target directly.
  - [ ] Add singular target-identifying fields to `scans`:
    - [ ] `inputTarget`
    - [ ] `normalizedTarget`
    - [ ] `canonicalTargetId`
  - [ ] Remove `targetCount` from `scans`.
- [ ] Remove `scanTargets` from the schema.
- [ ] Update `scanResults` to remove `scanTargetId`.
- [ ] Ensure `scanResults` still remains keyed by `scanId`.
- [ ] Keep `scanSchedules` plural-friendly.
- [ ] Keep `scanScheduleTargets` in the schema.
- [ ] Redesign `scanScheduleRuns` so one schedule firing can reference many scans.
- [ ] Add `scanScheduleRunScans` join table.
- [ ] Generate the new migration artifacts.
- [ ] Verify the new migration chain is valid for a destructive reset workflow.

**QA**
- [ ] Migration artifacts generate cleanly.
- [ ] Startup migration tests reflect the new schema layout.

---

## Phase 2 — Contract cutover

- [ ] Update `lib/contracts/scans.ts`.
  - [ ] Change `createScanRequestSchema` from `{ targets: string[] }` to `{ target: string }`.
  - [ ] Update `CreateScanRequest` inferred type.
  - [ ] Remove `targets[]` from `getScanResponseSchema`.
  - [ ] Replace plural target response fields with singular target fields.
  - [ ] Remove progress fields that only exist for multi-target scans:
    - [ ] `processedTargets`
    - [ ] `totalTargets`
  - [ ] Remove `targetCount` from scan list items if no longer meaningful.
- [ ] Update `lib/contracts/events.ts`.
  - [ ] Remove plural target progress semantics from scan progress events.
- [ ] Update `lib/contracts/runs.ts`.
  - [ ] Replace `targetUrls[]`, `targetCount`, and `hiddenTargetCount` with a singular target shape where possible.
- [ ] Keep `lib/contracts/schedules.ts` plural for schedule targets.
- [ ] Update schedule response contracts only where needed for grouped schedule-run summaries.

**QA**
- [ ] Old `targets[]` payloads are rejected by contract validation.
- [ ] New singular `target` payloads are accepted.

---

## Phase 3 — Scan and schedule write services

- [ ] Refactor `lib/server/scans/create-service.ts`.
  - [ ] Accept one target instead of many.
  - [ ] Normalize one target instead of an array.
  - [ ] Compute `requestFingerprint` from one normalized target.
  - [ ] Persist target identity directly on `scans`.
  - [ ] Remove all `scanTargets` inserts.
  - [ ] Remove any plural target count logic.
- [ ] Refactor `lib/server/schedules/service.ts`.
  - [ ] Keep plural replacement logic for `scanScheduleTargets`.
  - [ ] Update latest-run summary logic for grouped schedule runs.
- [ ] Revisit `lib/server/scans/normalize-targets.ts`.
  - [ ] Decide whether to keep it as a one-item normalizer helper or replace it with a singular helper.

**QA**
- [ ] Create-scan service persists one target directly on `scans`.
- [ ] Schedule service still persists multiple scheduled targets when requested.

---

## Phase 4 — Worker cutover

- [ ] Refactor `worker/scan-worker.ts`.
  - [ ] Remove loading arrays of scan targets.
  - [ ] Remove any `ClaimedScan.targets: ScanTargetRow[]` assumptions.
  - [ ] Remove target resolution across many targets.
  - [ ] Persist `scanResults` without `scanTargetId`.
  - [ ] Simplify progress semantics away from target counts.
- [ ] Refactor `worker/schedules.ts`.
  - [ ] Keep plural scheduled targets.
  - [ ] Create one scan per scheduled target.
  - [ ] Create one grouped schedule-run record per firing.
  - [ ] Link emitted scans through `scanScheduleRunScans`.

**QA**
- [ ] Worker executes against a singular target model.
- [ ] No code path tries to match payloads against multiple targets.

---

## Phase 5 — Read layer and queries

- [ ] Refactor `lib/server/scans/read-service.ts`.
  - [ ] Remove `getScanTargetsMap()` and related target-grouping logic.
  - [ ] Remove `targets[]` from scan detail responses.
  - [ ] Read target identity directly from `scans`.
  - [ ] Remove target-count-based progress logic.
- [ ] Refactor `lib/server/scans/result-selection.ts`.
  - [ ] Remove first-target / primary-target matching logic that only exists because scans are plural.
- [ ] Refactor `lib/server/scans/scan-detail-view-model.ts`.
  - [ ] Replace `scan.targets[0]`-style access with direct singular scan target access.
- [ ] Refactor `lib/queries/runs.ts`.
  - [ ] Remove multi-target assumptions from runs row shaping.
  - [ ] Replace plural target display fields where appropriate.
- [ ] Revisit target services if they still depend on scan-target joins upstream.

**QA**
- [ ] Scan detail reads cleanly with one target stored on `scans`.
- [ ] Runs data no longer implies multi-target scans unless justified by result rows.

---

## Phase 6 — API route cutover

- [ ] Update `app/api/v1/scans/route.ts`.
  - [ ] POST accepts singular target input only.
- [ ] Update `app/api/v1/scans/[scanId]/route.ts`.
  - [ ] Response exposes a singular target model.
- [ ] Update `app/api/v1/scans/[scanId]/results/route.ts` as needed for singular scan semantics.
- [ ] Review `app/api/v1/scans/[scanId]/technologies/route.ts`.
  - [ ] Ensure scan-level technology semantics are now clearly “all technology inventory for the one scan target.”
- [ ] Review `app/api/v1/scans/[scanId]/results/[resultId]/technologies/route.ts`.
  - [ ] Ensure result-level technology semantics remain per persisted result row.
- [ ] Update `app/api/v1/runs/route.ts` if runs output shape changes.
- [ ] Update `app/api/v1/targets/results/route.ts` and `app/api/v1/targets/[canonicalTargetId]/history/route.ts` if they still depend on multi-target scan semantics.

**QA**
- [ ] Route handlers validate the new singular contracts.
- [ ] No route still documents or accepts `targets[]`.

---

## Phase 7 — Page and component cutover

- [ ] Refactor `components/scans/new-scan-form.tsx`.
  - [ ] Remove `buildTargets()`.
  - [ ] Remove the optional newline-separated target list UI.
  - [ ] Submit only `target`.
  - [ ] Update copy from batch/plural language to singular language.
- [ ] Update `app/(authenticated)/scans/new/page.tsx` if prop naming/behavior needs to change.
- [ ] Update `app/(authenticated)/scans/[scanId]/page.tsx`.
  - [ ] Remove any primary-target fallback behavior.
- [ ] Update `components/scans/scan-detail-sections.tsx`.
  - [ ] Remove target-array-dependent behavior such as `scanDetail.targets.map(...)`.
- [ ] Update dashboard components to stay singular end-to-end.
- [ ] Update runs components to stop implying a scan owns multiple domains if that is no longer true.
- [ ] Review targets components for any upstream assumptions that need cleanup.

**QA**
- [ ] New scan form is single-target only.
- [ ] Scan detail no longer relies on “first target” logic.
- [ ] UI wording consistently describes scans as singular.

---

## Phase 8 — Docs, mocks, and tests

- [ ] Update docs:
  - [ ] `docs/spec.md`
  - [ ] `docs/routes.md`
  - [ ] `docs/pages.md`
  - [ ] `docs/architecture.md` if needed
  - [ ] `docs/httpx-worker-contract.md` if needed
- [ ] Update mocks and fixtures:
  - [ ] `lib/mocks/scans.ts`
- [ ] Update tests:
  - [ ] `worker/scan-worker.test.ts`
  - [ ] `lib/server/scans/read-service.test.ts`
  - [ ] `lib/server/scans/result-selection.test.ts`
  - [ ] any route/contract/page tests broken by the singular model
- [ ] Remove dead plural-target helpers and stale test fixtures.

**QA**
- [ ] Docs describe one scan = one domain/url.
- [ ] Fixtures no longer assume `targets[]` or `scanTargetId`.

---

## Phase 9 — Verification before merge

- [ ] Run typecheck.
- [ ] Run targeted tests for schema/contracts/services/workers/routes/pages.
- [ ] Run full test suite.
- [ ] Run build.
- [ ] Manually verify the following:
  - [ ] create a scan with one target
  - [ ] load scan detail page
  - [ ] load runs page
  - [ ] load targets page
  - [ ] load API docs page
  - [ ] confirm no API examples still show `targets[]`

---

## Critical dependency edges

- Schema cutover must happen **before** contracts and services fully settle.
- Contract changes must happen **before** route handlers and UI submission code can be correct.
- Worker changes depend on the new persistence model.
- Read-layer cleanup depends on the worker and schema no longer using `scanTargetId`.
- UI cleanup depends on route and read-layer shapes being stable.

---

## Completion criteria

- [ ] `scanTargets` removed
- [ ] `scanScheduleTargets` retained for plural schedule targeting
- [ ] `scanResults.scanTargetId` removed
- [ ] singular target stored directly on `scans`
- [ ] grouped schedule-run-to-scan linkage works for plural schedules
- [ ] `POST /api/v1/scans` accepts only `{ target: string }`
- [ ] scan detail no longer returns `targets[]`
- [ ] pages and docs consistently describe scans as singular
- [ ] worker and schedules no longer process scans as multi-target
- [ ] tests and build pass on the new model
