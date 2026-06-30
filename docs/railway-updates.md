# Updating Stackray on Railway

Stackray deployments on Railway should update by building the latest connected GitHub commit for each Stackray service.

Use Railway's Deploy Latest Commit action. A plain redeploy can reuse an existing deployment's code and will not necessarily move the service to the latest Stackray release.

## Services to Update

For the standard Stackray Railway template, update these services:

- `Stackray-website`
- `worker-http`
- `worker-intel`
- `worker-browser`

Postgres and object storage do not need to be redeployed for app releases.

## Steps

1. Open the Railway project that hosts Stackray.
2. Open the `Stackray-website` service.
3. Open the service command palette.
4. Choose Deploy Latest Commit.
5. Repeat for `worker-http`, `worker-intel`, and `worker-browser`.
6. Wait for the new deployments to become active.
7. Refresh Stackray and confirm the header version matches the latest GitHub Release.

Startup migrations run before the `Stackray-website` service starts, so schema migrations are applied as part of the updated deployment.
