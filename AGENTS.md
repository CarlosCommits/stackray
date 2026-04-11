<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Drizzle / Railway migration policy

- `scripts/startup-migrate.ts` is the canonical startup migration path and should remain in place. The app's `start` command runs it before booting the server.
- This repo now uses a **fresh checked-in `0000_*` baseline plus future incremental Drizzle migrations**. Do **not** keep rewriting the baseline for normal schema evolution.
- For normal schema changes:
  1. edit `drizzle/schema.ts`
  2. run `pnpm db:generate`
  3. commit the generated `0001_*`, `0002_*`, etc. migration files and updated `meta/*`
  4. let `startup-migrate.ts` replay pending migrations on Railway/app startup
- `scripts/startup-migrate.test.ts` should enforce that:
  - `_journal.json` matches the checked-in SQL migration files
  - snapshots line up with the migration chain
  - the first migration remains `0000_*`
  - future `0001+` incremental migrations are allowed
- Avoid manually editing generated Drizzle artifacts (`drizzle/migrations/*.sql`, `drizzle/migrations/meta/*`) during normal development. If generation produces something suspicious, regenerate or fix the schema/source of truth instead.
- A full migration-history reset is an **exceptional** operation intended only for fresh/reset databases and template cutovers. If a database has already applied an older migration lineage, do not reset the checked-in history without an explicit reconciliation plan.

# Barrel export policy

- Treat a folder's `index.ts` as its **public external entrypoint**, not as a complete map of everything in the folder.
- Only add an export to a barrel if code **outside that folder** should import it through the barrel.
- If a file is only used internally within its own folder, do **not** add it to the barrel just for discoverability.
- When a folder has an `index.ts`, prefer imports from the folder barrel for symbols that are intentionally public. Direct file imports from outside the folder should be reserved for intentionally private/internal files that are not re-exported.
