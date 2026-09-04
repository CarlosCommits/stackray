<p align="center">
  <img src="https://raw.githubusercontent.com/CarlosCommits/stackray/main/public/stackray-readme-banner.png" alt="Stackray banner: Inspect the stack behind any site">
</p>

# Deploy and Host Stackray on Railway

Stackray is a self-hosted site intelligence app for scanning domains and URLs, detecting the technologies behind them, and keeping a searchable record of what changed over time. It combines HTTP probing, browser rendering, DNS enrichment, subdomain discovery, IP intelligence, screenshots, Nuclei-backed checks, and technology detection in one queue-backed workspace.

<p align="center">
  <img src="https://raw.githubusercontent.com/CarlosCommits/stackray/main/public/stackray-dashboard.jpg" alt="Stackray dashboard showing recent scans, scan metrics, and detected technologies">
</p>

## About Hosting Stackray

This Railway template provisions the full Stackray stack in one flow: the Next.js web app and HTTP/JSON API, dedicated scanner workers, Postgres for app data and Graphile Worker jobs, and S3-compatible object storage for screenshots and scan artifacts. You do not need to manually wire the scanner roles, database, or storage bucket. Deploy the template, generate a public domain for the `Stackray-website` service, create the first admin account, and start scanning from the dashboard.

## Common Use Cases

- Detect frameworks, CMSs, ecommerce platforms, analytics, CDNs, WAFs, hosting providers, and other web technologies.
- Capture screenshots, favicons, page titles, response metadata, redirects, TLS details, DNS records, and server fingerprints.
- Compare technology stacks across multiple sites, schedule recurring scans, and review scan history from the web UI or HTTP/JSON API.
- Invite teammates to a deployed instance and create API keys for integrations, automation, or AI agents.

## Dependencies for Stackray Hosting

- Postgres for application data, scan history, auth records, and Graphile Worker jobs.
- S3-compatible object storage for screenshots and scan artifacts.
- Scanner worker services with `httpx`, `nuclei`, `subfinder`, Nuclei templates, Chromium, Xvfb, and browser runtime dependencies.

### Deployment Dependencies

- [Stackray GitHub repository](https://github.com/CarlosCommits/stackray)
- [Stackray update guide](https://github.com/CarlosCommits/stackray/blob/main/docs/railway-updates.md)
- [ProjectDiscovery Nuclei](https://github.com/projectdiscovery/nuclei)
- [ProjectDiscovery httpx](https://github.com/projectdiscovery/httpx)
- [ProjectDiscovery subfinder](https://github.com/projectdiscovery/subfinder)

### Implementation Details

Stackray uses separate Railway services so the web app, database, object storage, and scanner workloads can scale and restart independently:

- `Stackray-website`: Next.js app, API routes, auth, startup migrations, and release/update notices.
- `worker-http`: HTTP probing and technology detection.
- `worker-intel`: subdomain discovery, DNS enrichment, Nuclei checks, IP intelligence, scan finalization, and scheduled scan dispatch.
- `worker-browser`: browser rendering, screenshots, and runtime technology detection.
- `Postgres`: application database and Graphile Worker job store.
- `stackray-screenshots`: S3-compatible object storage for screenshots and scan artifacts.

After deployment, open the `Stackray-website` service in Railway. Go to `Settings` -> `Networking` -> `Public Networking` and click `Generate Domain` if Railway has not generated one yet. Open that generated URL, create the first admin account, and start scanning from the dashboard.

If you add a custom domain, add it to `STACKRAY_ALLOWED_HOSTS` so Stackray trusts Railway's forwarded host headers for auth callbacks, public URLs, and update notices.

The website pre-deploy migration automatically registers the website's public origin from `BETTER_AUTH_URL`, or from Railway's `RAILWAY_PUBLIC_DOMAIN` when no explicit auth URL is configured. Alert-capable workers read that shared value from Postgres when building email and webhook links, so `BETTER_AUTH_URL` and `RAILWAY_PUBLIC_DOMAIN` do not need to be copied to `worker-intel` or an all-role worker. Workers may update before the website. They continue scanning and defer alert deliveries until the website migration registers the origin. Opening **Settings → Alerts** through an allowed custom domain refreshes the registered origin as well.

Stackray checks GitHub releases for newer versions. Admin users will see an in-app update notice when a new release is available. To update a Railway deployment, redeploy the `Stackray-website`, `worker-http`, `worker-intel`, and `worker-browser` services so all services run the same version.

### Change alerts and encryption

Scan-to-scan change history works automatically and requires no provider configuration. Admins can optionally configure email and signed webhook notifications under `Settings` -> `Alerts`.

The template should generate one 64-character hexadecimal `STACKRAY_ENCRYPTION_KEY` on `Stackray-website` with `${{secret(64, "abcdef0123456789")}}`. `worker-intel` must reference it with `${{Stackray-website.STACKRAY_ENCRYPTION_KEY}}`; do not generate another key. In an all-role deployment, provide that same value to the general worker instead. The website uses it when an admin saves or tests a webhook channel, and the alert-delivery worker uses it when delivering queued alerts. It encrypts webhook URLs, authorization values, and signing secrets before they are stored in Postgres. It does not encrypt scan results or the entire database.

Alerts remain available if the variable is absent, but webhook and Resend credentials are stored as plaintext in Postgres and the Alerts page displays an encryption recommendation. Once a key is added, new credentials are encrypted immediately and existing plaintext credentials are encrypted on their next use. Keep this value stable and include it in deployment-secret backups. Replacing or losing it makes existing encrypted notification credentials unreadable and those destinations must be reconnected. Admins connect Resend from **Settings → Alerts**; no Resend or website-origin environment variables are required on the workers.

Stackray is built for authorized asset inventory, security research, and site intelligence. Use it responsibly and follow applicable laws, terms of service, and rate limits. Do not use Stackray for abusive traffic, unauthorized vulnerability testing, or service disruption. You are responsible for how you deploy and use Stackray.

## Why Deploy Stackray on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying Stackray on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.

## License

Stackray is available under the [MIT License](https://github.com/CarlosCommits/stackray/blob/main/LICENSE).
