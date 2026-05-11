# Contributing

## Local development

Stackray's local development setup is split by lifecycle:

- run the Next.js app on the host with `pnpm dev` for fast refresh
- run Postgres in Docker for local app data and Graphile Worker jobs
- run MinIO in Docker for local screenshot storage
- run the worker in Docker so `httpx`, `nuclei`, templates, and Linux screenshot dependencies match production

This avoids pushing worker code to Railway for testing and avoids mutating the Railway database during schema work.

## First-time setup

Install Docker Desktop with the WSL 2 backend, then run:

```powershell
pnpm dev:init
```

`dev:init` does four things:

1. creates `.env.local` from `.env.local.example` if `.env.local` does not already exist
2. starts local Postgres, MinIO, and the bucket init container
3. applies Drizzle and Graphile Worker migrations to local Postgres
4. creates a local admin user

Default local login:

- email: `admin@stackray.local`
- password: `StackrayDev123!`

The setup script will not overwrite an existing `.env.local`. If `.env.local` already exists and points at Railway, edit it manually or move it aside before running local-dev commands.

## Daily development

Run the full local stack from one terminal:

```powershell
pnpm dev:local
```

`dev:local` starts local infrastructure, runs migrations, starts the Docker worker, starts the host Next.js dev server, and prefixes logs from the app and worker:

```text
[next] ...
[worker] ...
```

The app runs at `http://localhost:3000`.

`dev:local` expects port 3000 to be free. If another Next.js dev server is already running, stop it first and run `pnpm dev:local` again.

Press `Ctrl+C` to stop the Next.js dev server and the worker container. Postgres and MinIO stay running so local data persists and the next startup is faster.

To stop the backing services too:

```powershell
pnpm dev:local:down
```

To stop everything and wipe local Postgres/MinIO data:

```powershell
pnpm dev:local:reset
```

## Script reference

| Script | What it does | When to use it |
| --- | --- | --- |
| `pnpm dev` | Starts the Next.js dev server on the host. | Normal UI/API development. |
| `pnpm dev:init` | Creates `.env.local` if missing, starts local infra, runs startup migrations, and seeds the default admin. | First local setup, or after `dev:infra:reset`. |
| `pnpm dev:local` | Starts local infra, applies migrations, seeds the default admin, then runs Next.js and the Docker worker with prefixed logs. | Default daily local development. |
| `pnpm dev:local:down` | Stops local Docker services but keeps data volumes. | End the day and stop Postgres/MinIO too. |
| `pnpm dev:local:reset` | Stops services and deletes local Docker data volumes. | Reset the local database and MinIO bucket from scratch. |
| `pnpm dev:infra` | Starts Postgres and MinIO, waits for them to be ready, then runs the one-shot bucket initializer. | Start local backing services without starting the worker. |
| `pnpm worker:docker` | Builds if needed and runs the local worker container. | Debug the worker separately from Next.js. |
| `pnpm dev:infra:logs` | Follows Docker logs for Postgres, MinIO, and worker. | Debug local services. |
| `pnpm worker:docker:down` | Stops only the worker container. | Pause scan processing while keeping Postgres and MinIO running. |
| `pnpm dev:infra:down` | Stops the local Docker services but keeps data volumes. | End the day without deleting local data. |
| `pnpm dev:infra:reset` | Stops services and deletes local Docker data volumes. | Reset the local database and MinIO bucket from scratch. |
| `pnpm db:migrate:startup` | Applies checked-in Drizzle migrations and Graphile Worker migrations to the current `DATABASE_URL`. | Run manually after migration changes. Be careful which env file is active. |
| `pnpm seed:admin --email ... --password ...` | Creates or updates an admin user in the current `DATABASE_URL`. | Add a different local admin account. |

## Container layout

The Docker setup uses separate containers because each service has a different lifecycle:

- `postgres`: long-running database and Graphile Worker job store
- `minio`: long-running S3-compatible object store
- `minio-init`: short-lived helper that creates the `stackray-dev` bucket, then exits
- `worker`: long-running Graphile Worker process with `httpx` and `nuclei` installed

The app is intentionally not containerized for local development. Keeping it on the host gives the best Next.js dev-server experience and uses the same source files as the worker through the mounted repo.

## Scanner dependency updates

`httpx` and `nuclei` are not Node dependencies and do not appear in `package.json`. They are pinned as worker-image inputs in `worker/scanner-pins.json` and mirrored into `worker/Dockerfile` plus `worker/Dockerfile.dev`:

- `httpx` is built from the pinned `CarlosCommits/httpx` commit
- `nuclei` is installed from the pinned release tag
- nuclei templates are cloned at the pinned `projectdiscovery/nuclei-templates` commit and then overlaid with `worker/nuclei-templates`

Run `pnpm scanners:update` to refresh the pins without changing the Stackray version. Run `pnpm scanners:update:patch` to refresh the pins and bump the Stackray patch version. The scheduled `Update scanner pins` GitHub Action does the patch bump automatically, validates the result, and opens a PR.

For now, scanner update PRs must be merged manually because GitHub auto-merge is unavailable for the current private repository settings. When the repository becomes public, or the account/repo supports auto-merge for private repositories, re-enable the commented auto-merge step in `.github/workflows/update-scanner-pins.yml`.

Use `pnpm release` from a clean, up-to-date `main` checkout for a manual Stackray patch release. The release command bumps the app version, commits and pushes the release commit, waits for the `CI` workflow to pass on that exact commit, then creates the matching annotated tag and GitHub Release. Pass `major`, `minor`, `patch`, or an explicit version when needed, for example `pnpm release minor` or `pnpm release 1.2.3`.

The in-app update banner compares the deployed Stackray version to the latest GitHub Release, falling back to semver tags, from `CarlosCommits/stackray` by default. The update dialog surfaces the GitHub Release notes when available. Set `STACKRAY_RELEASE_REPOSITORY=owner/repo` if a deployment should check a different repository. `STACKRAY_GITHUB_TOKEN` is optional for public repositories and required if a private release source should be checked from a deployment.

## Local services

- app: `http://localhost:3000`
- Postgres: `postgresql://postgres:postgres@127.0.0.1:5432/stackray`
- MinIO API: `http://127.0.0.1:9000`
- MinIO console: `http://127.0.0.1:9001`
- MinIO credentials: `minioadmin` / `minioadmin`

## Environment files

`.env.local` takes precedence over `.env` for local development. The checked-in `.env.local.example` points everything at the local Docker services:

- `DATABASE_URL` points at local Postgres
- `AWS_ENDPOINT_URL` points at local MinIO
- `AWS_S3_FORCE_PATH_STYLE=true` enables MinIO-compatible S3 addressing
- `STACKRAY_ENABLE_DEV_ACTOR=true` enables local development actor behavior

Do not use the Railway `.env` values for worker development unless the Railway worker is stopped and you intentionally want to mutate the Railway database and bucket.

## Schema changes

For normal schema changes:

1. edit `drizzle/schema.ts`
2. run `pnpm db:generate`
3. run `pnpm db:migrate:startup` against local Postgres
4. test with `pnpm dev:local`
5. commit the generated migration files and updated Drizzle metadata

Do not rewrite the checked-in `0000_*` baseline for normal schema evolution.
