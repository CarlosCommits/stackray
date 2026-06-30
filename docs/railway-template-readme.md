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

Stackray checks GitHub releases for newer versions. Admin users will see an in-app update notice when a new release is available. To update a Railway deployment, redeploy the `Stackray-website`, `worker-http`, `worker-intel`, and `worker-browser` services so all services run the same version.

Stackray is built for authorized asset inventory, security research, and site intelligence. Use it responsibly and follow applicable laws, terms of service, and rate limits. Do not use Stackray for abusive traffic, unauthorized vulnerability testing, or service disruption. You are responsible for how you deploy and use Stackray.

## Why Deploy Stackray on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying Stackray on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.

## License

Stackray is available under the [MIT License](https://github.com/CarlosCommits/stackray/blob/main/LICENSE).
