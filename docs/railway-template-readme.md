# Deploy and Host Stackray

Stackray is a self-hosted web reconnaissance dashboard for running HTTP, DNS, browser, nuclei, subdomain, and IP intelligence enrichment from one queue-backed application.

## About Hosting

This template deploys:

- `web`: the Next.js dashboard and API, running startup migrations before serving traffic.
- `worker-http`: the Graphile worker role that claims scans and runs HTTP probing.
- `worker-intel`: the worker role for subfinder, nuclei DNS/HTTP, IP intelligence, finalize, and scheduled scan dispatch.
- `worker-browser`: the worker role for normal headless enrichment, screenshots, and rare real Chrome recovery.
- `Postgres`: the application database and Graphile Worker job store.
- `stackray-screenshots`: object storage for captured screenshots.

The services build from Stackray's scanner-capable Docker image so `httpx`, `nuclei`, `subfinder`, pinned nuclei templates, and browser dependencies are available at runtime. Each worker starts `worker/index.ts` with `node` directly and pins its `STACKRAY_WORKER_ROLE` so deployers do not need to wire worker roles by hand.

## Why Deploy

Use Stackray when you want a private reconnaissance workspace with queued scans, screenshots, technology detection, DNS enrichment, nuclei findings, and scan history in one app.

## Common Use Cases

- Run repeatable reconnaissance scans for owned domains.
- Review screenshots and detected technologies across targets.
- Keep HTTP, DNS, browser, and intelligence work split across dedicated workers.

## Dependencies for Stackray

### Deployment Dependencies

- PostgreSQL for app data and the Graphile Worker queue.
- Railway Object Storage for screenshots.
- Scanner-capable Stackray image with `httpx`, `nuclei`, `subfinder`, nuclei templates, Chromium, Xvfb, and browser runtime dependencies.

After deployment, open the `web` service domain and create the first admin account. If you add a custom domain, add it to `STACKRAY_ALLOWED_HOSTS` so Stackray trusts forwarded host headers for auth and public URLs.
