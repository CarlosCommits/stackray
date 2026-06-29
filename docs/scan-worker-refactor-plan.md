# `worker/scan-worker.ts` refactor plan

## Objective

Refactor `worker/scan-worker.ts` into smaller, testable modules without changing scan behavior, persisted records, Graphile task names, phase ordering, or scanner command semantics.

The current file is a high-risk maintenance hotspot because it combines:

- httpx process execution and argument building
- httpx result parsing and persistence
- headless screenshot/runtime enrichment
- browser fallback orchestration
- nuclei target selection, execution, persistence, and technology rebuilding
- TXT DNS fallback parsing and resolution
- subfinder orchestration and persistence
- scan attempt lifecycle updates
- phase run state transitions and event emission
- Graphile job key construction, queueing, recovery, and worker loop dispatch

The refactor should preserve the current public worker entrypoints while moving cohesive internals into focused modules.

## Non-goals

- Do not change Drizzle schema or migration history.
- Do not rename persisted phase values or Graphile task identifiers.
- Do not change `STACKRAY_WORKER_ROLE` behavior.
- Do not change scanner pins, nuclei template registration semantics, or httpx CLI behavior.
- Do not rewrite worker tests wholesale before the first extractions.
- Do not introduce a framework or queue abstraction that hides Graphile Worker details from places that need explicit job-key semantics.

## Current Hotspots

| Area | Current location | Problem |
|---|---|---|
| httpx process runner and arguments | `worker/scan-worker.ts` around `runHttpxCli`, `buildHttpxArguments`, headless/browser argument builders | Pure CLI helpers are mixed with DB lifecycle code. |
| TXT fallback parser/resolver | `worker/scan-worker.ts` around TXT template parsing and `collectStackrayResolvedTxtMatches` | YAML parsing, rule semantics, DNS resolution, and match shaping are coupled. |
| Nuclei target selection and match merging | `worker/scan-worker.ts` around `selectNucleiTargets`, `buildNucleiExecutionPhases`, match dedupe/merge | Pure selection logic is buried inside the worker entrypoint file. |
| Phase state machine | `worker/scan-worker.ts` around `upsertPhaseRun`, `markPhase*`, `enqueuePhaseJob`, finalization pokes | Phase state transitions and Graphile queueing are easy to drift. |
| Headless/browser enrichment | `worker/scan-worker.ts` around `enrichResultWithHeadless` and `enrichResultWithBrowserFallback` | Long functions combine CLI execution, screenshots, metadata promotion, persistence, and event emission. |
| Scan attempt lifecycle | `worker/scan-worker.ts` around `runClaimedScan`, `claimQueuedScanById`, completion/failure helpers | Attempt state, fallback retry decisions, and result persistence are tightly coupled. |
| Tests | `worker/scan-worker.test.ts` | Tests import many internals from one file, making extractions noisy unless exports move deliberately. |

## Target Module Boundaries

Keep `worker/scan-worker.ts` as the orchestration entrypoint that exports the existing task functions:

- `runScanById`
- `runHttpProbeById`
- `runHeadlessPhaseById`
- `runBrowserFallbackPhaseById`
- `runSubfinderPhaseById`
- `runNucleiDnsPhaseById`
- `runNucleiHttpPhaseById`
- `runIpIntelPhaseById`
- `finalizeScanById`
- `runWorkerLoop`
- recovery helpers that are intentionally part of worker startup

Move implementation details into modules with narrow ownership:

| New module | Owns | Should not own |
|---|---|---|
| `worker/httpx.ts` | `HttpxJson`, process types, `runHttpxCli`, base httpx argument construction, request profiles, timeout/cancellation plumbing | DB writes, scan phase updates |
| `worker/headless-enrichment.ts` | headless args, headless evidence extraction, metadata promotion decisions, screenshot eligibility helpers | Graphile queueing, phase transitions |
| `worker/browser-fallback.ts` | browser fallback args, provider detection, fallback decision building, fallback slot serialization | scan finalization or nuclei queueing |
| `worker/txt-fallback.ts` | TXT template parsing, TXT service rule modeling, root-subject scope checks, TXT match construction | nuclei run persistence |
| `worker/nuclei-targets.ts` | target selection, execution phase construction, match dedupe/merge, nuclei detection row builders | CLI spawning and DB writes |
| `worker/nuclei-persistence.ts` | nuclei run state, match insert/delete, technology detection rebuild | target selection rules |
| `worker/phase-runs.ts` | phase metadata comparison, phase run upsert, `markPhase*`, phase event payload building | scanner-specific behavior, downstream phase ordering |
| `worker/queue.ts` | task names, `getPhaseJobKey`, `getHttpProbeScanJobKey`, the raw `enqueuePhaseJob` wrapper, recovery predicates for Graphile jobs | phase business decisions, enqueue-after-X helpers |
| `worker/attempts.ts` | claiming scans, fallback attempts, attempt completion/failure/cancellation, attempt summary helpers | scanner CLI argument generation |
| `worker/httpx-results.ts` | mapping httpx JSON payloads to `scanResults` and detection rows, no-json placeholder construction | phase queueing |
| `worker/subfinder-phase.ts` | subfinder run persistence, subdomain row mapping, subdomain progress events | httpx or nuclei behavior |

This list is intentionally more granular than the first pull request should be. The extraction order below keeps each step reviewable.

Early PRs should start with fewer modules and split only when the extracted file starts carrying unrelated responsibilities:

- Start with `worker/httpx.ts` owning both httpx process/argument helpers and httpx JSON result helpers. That includes `HttpxJson`, `runHttpxCli`, `buildHttpxArguments`, `buildDetectionRows`, `buildSearchDocument`, `extractFaviconFields`, and `parseResponseTimeMs`. Split `worker/httpx-results.ts` later only if persistence mapping makes `httpx.ts` too broad.
- Start with one nuclei-focused module owning target selection, execution phase construction, match dedupe/merge, and nuclei persistence helpers. Split `worker/nuclei-persistence.ts` later only after the shared `ParsedNucleiMatch` and dedupe contracts are stable.

The table above describes the desired ownership boundaries, not a requirement to create every file in the first pass.

The enqueue-after-X helpers encode phase ordering and should stay visible in orchestration code, not in `worker/queue.ts`. That includes helpers currently shaped like:

- `enqueueNucleiDnsAfterHeadless`
- `enqueueBrowserFallbackAfterHeadless`
- `enqueueIpIntelAfterBrowserEnrichment`
- `enqueueNucleiHttpAfterDns`

These can remain in `worker/scan-worker.ts` during the first extractions. If they move later, move them to an orchestration-focused module such as `worker/phase-orchestration.ts`, not to the raw queue wrapper.

Do not extract duplicated primitive type guards such as `asString`, `asStringArray`, `isObject`, or `asBoolean` as part of this refactor. Similar helpers exist in worker-adjacent modules, but a shared helpers module would be a separate cleanup and should not be coupled to the scan-worker split.

## Refactor Sequence

### Phase 0: Lock Current Behavior

Before moving code, run and record the focused baseline:

```bash
pnpm vitest run worker/scan-worker.test.ts worker/nuclei.test.ts worker/ip-enrichment.test.ts worker/subfinder.test.ts
pnpm typecheck
```

Add or strengthen tests only where an extraction would otherwise rely on implicit behavior. The first useful additions are:

- TXT fallback ignores or explicitly rejects unsupported subdomain TXT rules.
- Graphile job keys stay stable for `http_probe` and enrichment phases.
- `buildNucleiExecutionPhases` returns the same phase ordering for original/final/domain targets.

### Phase 1: Extract Pure Helpers First

Start with code that has no DB writes and minimal side effects:

1. Move httpx process types and `runHttpxCli` to `worker/httpx.ts`.
2. Move httpx argument/profile helpers to `worker/httpx.ts`.
3. Move httpx JSON-specific helpers to `worker/httpx.ts`, including result parsing, favicon extraction, search-document construction, and detection-row construction.
4. Move nuclei target selection, execution phase construction, CPE/detection-row builders, match merge helpers, and nuclei persistence helpers to one nuclei module.
5. Move TXT fallback parser/rule/match helpers to `worker/txt-fallback.ts`.

Keep exports temporarily compatible with `worker/scan-worker.test.ts` by re-exporting moved helpers from `worker/scan-worker.ts` during the transition. For example, after moving httpx helpers:

```ts
export { buildHttpxArguments, runHttpxCli } from "./httpx.ts";
```

This keeps the existing test file green while each module is extracted. Switch tests to import from focused modules in separate commits, then remove compatibility re-exports in Phase 5.

Verification after each move:

```bash
pnpm vitest run worker/scan-worker.test.ts
pnpm typecheck
```

### Phase 2: Extract Phase and Queue Infrastructure

Move the phase state machine after pure helpers are stable:

1. Create `worker/queue.ts` for `getPhaseJobKey`, `getHttpProbeScanJobKey`, `enqueuePhaseJob`, and typed task constants.
2. Create `worker/phase-runs.ts` for phase metadata comparison, `upsertPhaseRun`, `markPhaseRunning`, `markPhaseCompleted`, `markPhaseSkipped`, and `markPhaseFailed`.
3. Keep event insertion behavior identical. If possible, accept dependencies as parameters only where that makes tests simpler without obscuring DB usage.
4. Add an alignment test that compares schema phase values, Graphile task names, worker role task lists, and Railway role expectations.

This phase is sensitive because phase completion currently pokes `finalize`. Keep the finalize poke in the caller, specifically in the orchestration flow inside each `run*PhaseById` function or the enqueue-after-X helpers. Do not hide a queue write inside `markPhaseCompleted` or a generic phase-run helper. The point of `phase-runs.ts` is to record phase state and emit phase events; the point of orchestration code is to decide what downstream work should be queued.

Verification:

```bash
pnpm vitest run worker/scan-worker.test.ts
pnpm vitest run worker/tasks.test.ts worker/worker-config.test.ts
pnpm typecheck
```

If task/config tests do not exist yet, add a narrow test near the existing worker config code.

### Phase 3: Extract Scanner Phase Implementations

Once helpers and phase infrastructure are separate, move phase bodies one at a time:

1. `worker/headless-enrichment.ts`
2. `worker/browser-fallback.ts`
3. `worker/subfinder-phase.ts`
4. Optional split of nuclei persistence from the initial nuclei module, if it is now clearly too broad.
5. Optional split of `worker/httpx-results.ts` from `worker/httpx.ts`, if result persistence mapping is now clearly too broad.

Keep `worker/scan-worker.ts` responsible for the high-level phase control flow:

- load claimed scan/result
- mark phase running
- call phase implementation
- mark completed/failed/skipped
- enqueue dependent phases

Avoid moving all orchestration at once. The goal is to make each scanner phase testable without requiring the whole scan loop.

Verification after each extraction:

```bash
pnpm vitest run worker/scan-worker.test.ts worker/nuclei.test.ts
pnpm typecheck
```

### Phase 4: Extract Attempt Lifecycle

Move scan claiming and attempt transitions after scanner phase code is isolated:

1. Create `worker/attempts.ts` for `claimQueuedScanById`, `getClaimedScanForAttempt`, fallback attempt creation, attempt summary, retry target decision support, and attempt terminal updates.
2. Create `worker/http-probe-phase.ts` and move `runClaimedScan` there after the extracted attempt helpers are stable.
3. Keep `scan-worker.ts` as the caller/export surface for `runScanById` and `runHttpProbeById`, delegating the HTTP probe attempt loop to `worker/http-probe-phase.ts`.

This phase should preserve the exact event payload fields emitted for `scan.status` and `scan.phase`.

Verification:

```bash
pnpm vitest run worker/scan-worker.test.ts
pnpm test:scan-pipeline-smoke
pnpm typecheck
```

`pnpm test:scan-pipeline-smoke` needs local Postgres and worker scanner dependencies; if unavailable, document that explicitly in the PR.

### Phase 5: Reduce Compatibility Exports

After all code is moved and tests import from focused modules:

1. Remove exports from `worker/scan-worker.ts` that are no longer public entrypoints.
2. Keep only externally called worker task functions and startup helpers exported from `scan-worker.ts`.
3. Ensure folder `index.ts` files are not added as internal barrels; import focused modules directly.
4. Update docs that mention worker internals if paths changed.

Verification:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:railway-template
pnpm build
```

## Behavior Preservation Checklist

Use this checklist for each PR in the sequence.

- Existing Graphile task identifiers are unchanged.
- Existing job keys are unchanged unless a migration/recovery plan is included.
- Existing phase values in `scan_phase_runs.phase` are unchanged.
- Results are persisted before scan events imply availability.
- `finalize` still waits for all enrichment phases to reach terminal states.
- Cancellation handling remains checked before long-running CLI work and before finalization.
- Screenshot object key generation remains unchanged.
- Nuclei DNS runs still enqueue HTTP runs afterward.
- Browser fallback still gates downstream nuclei/IP phases the same way.
- TXT fallback still uses YAML-backed nuclei templates as the source of truth.
- Worker role task mappings still match Railway template validation.

## Review Strategy

Prefer several small PRs over one large mechanical move.

Good PR boundaries:

1. Pure helper extraction only.
2. TXT fallback scope/fixture test plus extraction.
3. Nuclei target selection extraction.
4. Phase run and queue helper extraction.
5. Headless/browser phase extraction.
6. Attempt lifecycle extraction.
7. Export cleanup and docs updates.

Each PR should include a short before/after export list for `worker/scan-worker.ts` and the focused tests that prove the moved code still behaves the same.

## Expected End State

`worker/scan-worker.ts` should read like a task dispatcher and phase coordinator, not a scanner implementation library. A reader should be able to answer:

- which task runs for each Graphile job
- how scan attempts flow through phases
- which phase enqueues which downstream work
- how cancellation and finalization are handled

The detailed mechanics of httpx, nuclei, TXT fallback, subfinder, screenshots, browser fallback, and persistence mapping should live in their own modules with focused tests.
