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

The app URL is printed at startup. `dev:local` prefers the default ports, but if another worktree already has a local stack running it chooses the next open host ports for Next.js, Postgres, and MinIO. Each worktree also gets a distinct Docker Compose project and separate data volumes.

Press `Ctrl+C` to stop the Next.js dev server and the worker container. Postgres and MinIO stay running so local data persists and the next startup is faster.

To stop the backing services too:

```powershell
pnpm dev:local:down
```

Run this from the same worktree you used for `pnpm dev:local`; it targets that worktree's Docker Compose project.

To stop everything and wipe local Postgres/MinIO data:

```powershell
pnpm dev:local:reset
```

## Script reference

| Script | What it does | When to use it |
| --- | --- | --- |
| `pnpm dev` | Starts the Next.js dev server on the host. | Normal UI/API development. |
| `pnpm dev:init` | Creates `.env.local` if missing, starts local infra, runs startup migrations, and seeds the default admin. | First local setup, or after `dev:infra:reset`. |
| `pnpm dev:local` | Starts per-worktree local infra on available host ports, applies migrations, seeds the default admin, then runs Next.js and the Docker worker with prefixed logs. | Default daily local development, including parallel worktrees. |
| `pnpm dev:local:down` | Stops this worktree's local Docker services but keeps data volumes. | End the day and stop Postgres/MinIO too. |
| `pnpm dev:local:reset` | Stops this worktree's services and deletes its local Docker data volumes. | Reset the local database and MinIO bucket from scratch. |
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
- `worker`: long-running Graphile Worker process with `httpx`, `nuclei`, and `subfinder` installed

The app is intentionally not containerized for local development. Keeping it on the host gives the best Next.js dev-server experience and uses the same source files as the worker through the mounted repo.

## Scanner dependency updates

`httpx`, `nuclei`, and `subfinder` are not Node dependencies and do not appear in `package.json`. They are pinned as worker-image inputs in `worker/scanner-pins.json` and mirrored into `worker/Dockerfile` plus `worker/Dockerfile.dev`:

- `httpx` is built from the pinned `CarlosCommits/httpx` commit
- `nuclei` is installed from the pinned release tag
- `subfinder` is installed from the pinned release tag
- nuclei templates are cloned at the pinned `projectdiscovery/nuclei-templates` commit and then overlaid with `worker/nuclei-templates`

Run `pnpm scanners:update` to refresh the pins without changing the Stackray version. The scheduled `Update scanner pins` GitHub Action refreshes scanner pins without bumping the Stackray version.

Scanner update PRs are validated by the standard `CI` workflow. After `Quality`, `Scanner Docker build`, and `E2E smoke` pass, `.github/workflows/trusted-scanner-pin-auto-merge.yml` may merge the trusted `automation/update-scanner-pins` PR directly. That workflow exists because repository-level GitHub auto-merge, branch protection, and rulesets are unavailable for the current private repository plan; it compensates with branch, author, file, semantic diff, check, and head-SHA gates.

Release PRs are managed by release-please. Use Conventional Commit PR titles for squash merges, such as `fix: correct Railway update copy`, `feat: add CSV export`, or `feat!: change scan result API shape`. After releasable commits merge to `main`, `.github/workflows/release-please.yml` opens or updates the pending release PR. Merge that release PR when you are ready to publish; release-please then creates the annotated tag and GitHub Release with generated notes.

The in-app update banner compares the deployed Stackray version to the latest GitHub Release from `CarlosCommits/stackray` by default. Raw semver tags are ignored so self-hosted deployments only see structured releases with release notes. The update dialog surfaces the GitHub Release notes when available. Set `STACKRAY_RELEASE_REPOSITORY=owner/repo` if a deployment should check a different repository. `STACKRAY_GITHUB_TOKEN` is optional for public repositories and required if a private release source should be checked from a deployment. See `docs/releases.md` and `docs/railway-updates.md` for the full release and self-hosted update flow.

## Local services

`pnpm dev:local` prints the actual service URLs after it picks available ports. The first stack normally uses:

- app: `http://localhost:3000`
- Postgres: `postgresql://postgres:postgres@127.0.0.1:5432/stackray`
- MinIO API: `http://127.0.0.1:9000`
- MinIO console: `http://127.0.0.1:9001`
- MinIO credentials: `minioadmin` / `minioadmin`

You can force specific ports when needed:

```powershell
$env:STACKRAY_DEV_APP_PORT=3010
$env:STACKRAY_DEV_POSTGRES_PORT=5540
$env:STACKRAY_DEV_MINIO_PORT=9010
$env:STACKRAY_DEV_MINIO_CONSOLE_PORT=9011
pnpm dev:local
```

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
