<p align="center">
  <img src="https://raw.githubusercontent.com/CarlosCommits/stackray/main/public/stackray-readme-banner.png" alt="Stackray banner: Inspect the stack behind any site">
</p>

# Stackray

Inspect the stack behind any site.

Stackray is a self-hosted site intelligence app for scanning domains and URLs, detecting the technologies behind them, and keeping a searchable record of what changed over time. It combines HTTP probing, browser rendering, DNS enrichment, subdomain discovery, IP intelligence, screenshots, Nuclei-backed checks, and technology detection in one queue-backed workspace.

<p align="center">
  <img src="https://raw.githubusercontent.com/CarlosCommits/stackray/main/public/stackray-dashboard.jpg" alt="Stackray dashboard showing recent scans, scan metrics, and detected technologies">
</p>

## One-Click Deploy

This Railway template provisions the full Stackray stack in one flow:

- the Next.js web app and HTTP/JSON API
- dedicated scanner workers
- Postgres for app data, scan history, auth records, and Graphile Worker jobs
- S3-compatible object storage for screenshots and scan artifacts

You do not need to manually wire the scanner roles, database, or storage bucket. Deploy the template, grab the public URL from the `Stackray-website` service, and create the first admin account.

## What You Can Do

### Detect

- Detect frameworks, CMSs, ecommerce platforms, analytics, CDNs, WAFs, hosting providers, and other web technologies.
- Capture screenshots, favicons, page titles, response metadata, redirects, TLS details, DNS records, and server fingerprints.
- Enrich targets with passive subdomain discovery, IP/ASN context, DNS service evidence, and OSINT-style public signals.
- Run Nuclei-backed checks for templated DNS, HTTP, and exposure findings.

### Workflow

- Compare technology stacks across multiple sites.
- Schedule recurring scans.
- Review scan history from the web UI and consume progress/results through the HTTP/JSON API and SSE event stream.

### Collaboration

- Invite teammates to your deployed instance and create user accounts for them.
- Create API keys for integrations, automation, or AI agents that need to queue scans and interact with Stackray data.

## Services

Stackray uses separate Railway services so the web app, database, object storage, and scanner workloads can scale and restart independently:

- `Stackray-website`: Next.js app, API routes, auth, startup migrations, and release/update notices.
- `worker-http`: HTTP probing and technology detection.
- `worker-intel`: subdomain discovery, DNS enrichment, Nuclei checks, IP intelligence, scan finalization, and scheduled scan dispatch.
- `worker-browser`: browser rendering, screenshots, and runtime technology detection.
- `Postgres`: application database and Graphile Worker job store.
- `stackray-screenshots`: S3-compatible object storage for screenshots and scan artifacts.

The scanner services build from Stackray's scanner-capable worker image. That image includes the pinned `httpx`, `nuclei`, `subfinder`, Nuclei templates, Chromium, Xvfb, and browser runtime dependencies needed to run scans on Railway.

## First Run

After deployment:

1. In Railway, click the `Stackray-website` service. This is the Next.js service that runs the Stackray app.
2. Open the service `Settings` tab.
3. Find `Networking`, then `Public Networking`.
4. Click `Generate Domain` if Railway has not generated one yet.
5. Open that generated `Stackray-website` service domain.
6. Create the first admin account.
7. Start scanning from the dashboard.
8. Invite teammates or create API keys from settings when you are ready to automate scans.

If you add a custom domain, add it to `STACKRAY_ALLOWED_HOSTS` so Stackray trusts Railway's forwarded host headers for auth callbacks, public URLs, and update notices.

## Updates

Stackray checks GitHub releases for newer versions. Admin users will see an in-app update notice when a new release is available. To update a Railway deployment, redeploy the `Stackray-website`, `worker-http`, `worker-intel`, and `worker-browser` services so all services run the same version.

## Responsible Use

Stackray is built for authorized asset inventory, security research, and site intelligence. Use it responsibly and follow applicable laws, terms of service, and rate limits. Do not use Stackray for abusive traffic, unauthorized vulnerability testing, or service disruption. You are responsible for how you deploy and use Stackray.

## License

Stackray is available under the [MIT License](https://github.com/CarlosCommits/stackray/blob/main/LICENSE).
