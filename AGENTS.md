<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

Next.js is pinned to `16.2.9`; APIs and file conventions may differ from training data. Before changing Next-specific behavior, read the relevant guide under `node_modules/next/dist/docs/` and heed deprecations.
<!-- END:nextjs-agent-rules -->

# Stackray repo guide

## Runtime and commands

- Use Node `24.x` and `pnpm@10.26.1`; CI enables pnpm with Corepack and installs with `pnpm install --frozen-lockfile`.
- CI quality order is `pnpm lint` -> `pnpm typecheck` -> `pnpm test` -> `pnpm test:railway-template` -> `pnpm build`.
- Focused unit tests: `pnpm vitest run path/to/file.test.ts` (`vitest.config.ts` includes `**/*.test.{ts,tsx}` and uses `jsdom`).
- E2E: `pnpm test:e2e` starts `pnpm db:migrate:startup && pnpm dev --hostname 127.0.0.1 --port ${PLAYWRIGHT_PORT:-3100}` and needs Postgres; set `STACKRAY_E2E_USE_SYSTEM_CHROME=true` to use system Chrome like CI.
- DB-backed smoke tests need Postgres and startup migrations first: `pnpm test:scan-pipeline-smoke` exercises fake scanners plus `http`/`intel`/`browser` workers; `pnpm test:railway-template` validates the Railway service template.
- `pnpm build` runs `next build` and then `scripts/copy-next-standalone-assets.ts`; `pnpm start` always runs `pnpm db:migrate:startup` before `.next/standalone/server.js`.
- `pnpm dev:local` is the default local stack: it creates `.env.local` if missing, chooses per-worktree ports, starts Postgres/MinIO, runs migrations, seeds `admin@stackray.local` / `StackrayDev123!`, then runs host Next.js plus Docker workers.
- `pnpm dev:local:down` stops this worktree's Docker services without deleting volumes; `pnpm dev:local:wipe` deletes local Postgres/MinIO volumes.

## Local environment and services

- `.env.local` takes precedence over `.env`, and setup scripts never overwrite an existing `.env.local`; check it is not pointing at Railway before worker or migration testing.
- Before launching `pnpm dev:local`, `pnpm dev`, or local hands-on QA servers, check tmux for an existing Stackray dev session. In the main `~/projects/stackray` checkout, reuse the existing session if one is running; in a separate worktree, start that worktree's own tmux session with `pnpm dev:local` so it gets isolated ports, Compose project, and volumes.
- Local app runs on the host; Postgres and MinIO run in Docker; worker containers provide `httpx`, `nuclei`, `subfinder`, nuclei templates, and browser/screenshot Linux dependencies.
- First local stack defaults: app `http://localhost:3000`, Postgres `127.0.0.1:5432`, MinIO API `127.0.0.1:9000`, MinIO console `127.0.0.1:9001` with `minioadmin` / `minioadmin`.
- Worker roles are split by `STACKRAY_WORKER_ROLE`: `http` handles `http_probe/run_scan`, `intel` handles subfinder/nuclei/ip/finalize/schedules, `browser` handles headless/browser fallback, and `all` handles every task.

## Architecture boundaries

- Stackray intentionally uses HTTP/JSON plus SSE, not `tRPC`, `oRPC`, or GraphQL. The web UI, agent API, and workers share persisted records as the source of truth.
- API/UI entrypoints live under `app/`; product route handlers call services in `lib/server/**`; shared payload schemas live in `lib/contracts/**`; worker orchestration lives in `worker/**`.
- `drizzle/schema.ts` is the database source of truth; `lib/db/schema.ts` is only the app-facing re-export.
- Product-resource API routes should accept either Better Auth session cookies or bearer API keys via `requireSessionOrBearerActor`; account/admin/API-key/user-product-state routes should stay session-only via `requireAppSession`. `lib/session/route-auth-boundaries.test.ts` enforces this split.
- Queue Graphile work through `enqueueGraphileJob`; scan creation queues `http_probe`, and worker task selection is role-based rather than one monolithic worker path.
- Scan progress is SSE from persisted `scan_events`; results must be written before being streamed.

## Drizzle, Graphile, and Railway migrations

- `scripts/startup-migrate.ts` is the canonical runtime migration path. Keep it: it loads `.env.local`/`.env`, takes a Postgres advisory lock, applies checked-in Drizzle migrations, then runs Graphile Worker migrations.
- Normal schema changes: edit `drizzle/schema.ts`, run `pnpm db:generate`, run `pnpm db:migrate:startup` against local Postgres, test with `pnpm dev:local`, and commit the generated SQL plus `drizzle/migrations/meta/*`.
- Do not rewrite the checked-in `0000_*` baseline for normal schema evolution. Current migration history already includes incremental `0001+` files; append the next migration.
- Avoid manually editing generated Drizzle artifacts (`drizzle/migrations/*.sql`, `drizzle/migrations/meta/*`) during normal work. If generated SQL looks wrong, fix the schema/source and regenerate.
- A full migration-history reset is exceptional and intended only for fresh/reset databases and template cutovers. If any database has applied an older migration lineage, do not reset checked-in history without an explicit reconciliation plan.
- `scripts/startup-migrate.test.ts` intentionally checks `_journal.json`, SQL files, snapshots, the `0000_*` baseline, and important historical migrations.

## Scanner and technology detection

- Scanner binaries are not npm deps. Pins live in `worker/scanner-pins.json` and are mirrored into `worker/Dockerfile` and `worker/Dockerfile.dev`; update with `pnpm scanners:update` or `pnpm scanners:update:patch`, not by hand.
- The worker image builds from the `CarlosCommits/httpx` fork plus pinned `nuclei`, `subfinder`, and nuclei-template refs. CI only builds the scanner image when scanner-impacting files changed.
- For technology detection, keep layers separate: detection rules in `lib/server/scans/custom-wappalyzer-fingerprints.json`, display metadata in `lib/server/scans/custom-technology-metadata.json`, generated upstream catalog in `lib/server/scans/generated/wappalyzer-catalog.json`, and repo-local nuclei templates under `worker/nuclei-templates/` registered in `worker/nuclei.ts`.
- Never hand-edit `lib/server/scans/generated/wappalyzer-catalog.json`; refresh it with `pnpm wappalyzer:update-catalog` and inspect catalog changes with `pnpm wappalyzer:diff-catalog -- [base] [head] --limit N`.
- Custom Wappalyzer fingerprints are passed to `httpx` with `-cff` in primary `-td`, screenshot `-td`, and runtime `-tdh` paths. Modern SPA evidence may require the pinned `httpx` fork, not just a JSON fingerprint.
- Register worker-used Nuclei templates in `NUCLEI_TEMPLATE_DEFINITIONS`; repo-local templates use `repoLocal: true` and run by `-t` path, while upstream templates run by `-id` unless `NUCLEI_TEMPLATES_DIR` is configured.
- TXT DNS fallback rules should stay YAML-backed in nuclei templates; do not add duplicate hardcoded TXT signature constants in TypeScript.

## Repo conventions worth preserving

- Treat folder `index.ts` files as public external entrypoints only. Do not add barrel exports for module-internal helpers.
- For external scan artifacts, favicons, Wappalyzer icons, screenshots, and prototype previews, do not blindly replace raw `<img>` with `next/image` unless the source is internal, proxied/cached, or explicitly configured.
- Use `flatMap` for simple map-and-filter transformations where each input returns either `[]` or `[value]`; use one `for...of` loop when partitioning one array into multiple outputs.
- Use `toSorted()` for immutable sorting instead of `[...items].sort(...)`.
- Use `Set` or `Map` for repeated membership checks or lookups inside loops. Keep array order semantics explicit when changing deduplication code.
- Avoid array indexes as React keys unless the index represents a fixed spatial position. Prefer stable domain identifiers or stable value keys.
- Avoid numeric `&&` rendering in JSX. Use explicit boolean conditions so `0` cannot accidentally render as text or disappear as a valid value.
- Use deterministic date/time formatting for server-rendered text; volatile timestamps belong client-side or behind explicit locale/time-zone formatting.
- Event listeners opened in effects should use named callbacks and remove each listener in cleanup before closing the underlying resource.
- Do not export Next.js `metadata` from a client component. If metadata matters for a client-only page, split the route into a server page/wrapper plus a client component.
- For scan artifacts, favicons, Wappalyzer icons, screenshots, and prototype previews that can come from arbitrary external domains, do **not** blindly replace raw `<img>` tags with `next/image`. Use `next/image` only when the source is internal, proxied/cached through our domain, or safely covered by explicit image configuration and sizing.
- For dead code cleanup, prefer removing `export` from module-internal symbols before deleting code. Keep contract schemas, view-model shape types, and behavior-oriented worker/session helpers unless a focused API/entrypoint review proves they are not intentional surface area.
- Only parallelize awaits when independence, ordering, transaction behavior, rate limits, and side effects are explicitly verified.
- When Tailwind width and height utilities use the same value, prefer `size-*`.
