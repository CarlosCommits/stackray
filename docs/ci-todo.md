# CI TODO

## Scan pipeline smoke

- Add a CI job that exercises one full scan through the Graphile queue with the role-based workers enabled.
- Keep the target deterministic and local: serve a small HTTP fixture inside CI instead of scanning an external domain.
- Assert the scan reaches `completed` and that phase rows transition through the expected terminal states:
  - `http_probe`
  - `subfinder`
  - `headless`
  - `browser_fallback`
  - `nuclei_dns`
  - `nuclei_http`
  - `ip_intel` when the fixture produces a host IP
  - `finalize`
- Prefer a lightweight fixture that can prove orchestration and dashboard data shape without requiring long scanner runtimes.

## Railway template validation

- After the Railway template is revised, add CI coverage that validates the template creates the intended service shape:
  - `web`
  - `worker-http`
  - `worker-intel`
  - `worker-browser`
- Ensure worker services use the continuous direct Node worker entrypoint, not `pnpm worker` or a one-shot worker command.
- Validate each worker service sets the expected `STACKRAY_WORKER_ROLE`.
- Include a template/schema check that does not require creating live production infrastructure on every PR.
