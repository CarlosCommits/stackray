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

The website migration also registers the instance's public origin in Postgres. `worker-intel`, or the general worker in an all-role deployment, reads that value for alert links; existing deployments do not need a new `BETTER_AUTH_URL` or `RAILWAY_PUBLIC_DOMAIN` worker variable. Service update order does not matter. If a new worker starts before the website migration, it continues handling scans and defers alert deliveries without consuming their normal retry budget. Once the website updates, the next deferred job sends each alert. If you add a custom website domain, add it to `STACKRAY_ALLOWED_HOSTS` and redeploy the website. Opening **Settings → Alerts** through that allowed domain refreshes the stored origin.

## Alert configuration for existing deployments

Change history and webhook alerts work without additional environment variables. Without an encryption key, Stackray stores webhook endpoint URLs, authorization headers, and signing secrets as plaintext in Postgres. To enable application-layer encryption for those credentials:

1. Generate a 64-character hexadecimal key, for example with `openssl rand -hex 32`.
2. Add it as `STACKRAY_ENCRYPTION_KEY` to `Stackray-website`.
3. Reference the exact same value from `worker-intel`, or from the single general worker in an all-role deployment; do not generate a second value.
4. Redeploy both services.
5. Open `Settings` -> `Alerts` and confirm the encryption recommendation is gone.

New notification credentials are encrypted immediately. Existing plaintext webhook and Resend credentials are encrypted the next time they are used. Keep the key stable and backed up: losing it makes encrypted credentials unreadable. Admins connect Resend from **Settings → Alerts**; Stackray stores the send-capable OAuth grant in Postgres, so no Resend environment variables are required on the website or workers.
