# Stackray Agent CLI Contract

## Goal

Allow an AI agent to queue scans, watch progress, and fetch final results while using the same backend and history store as the UI.

## Design rules

- the CLI is a client of the Stackray API, not a separate data plane
- the CLI should not keep its own permanent scan history
- every command returns a canonical `scan_id` when referring to a scan
- JSON output must be stable and machine-friendly

## Commands

## 1. Submit a scan

```bash
stackray scan submit https://primary.example.test --profile stack-deep --json
```

### Output

```json
{
  "scanId": "scn_01J...",
  "status": "queued",
  "reused": false
}
```

## 2. Watch a scan

```bash
stackray scan watch scn_01J...
```

Behavior:

- connect to SSE endpoint first
- print progress and incremental result summaries
- fall back to polling if SSE is unavailable

## 3. Get scan status

```bash
stackray scan status scn_01J... --json
```

## 4. Get final results

```bash
stackray scan results scn_01J... --json
```

Expected output should include both a normalized observation and the preserved raw `httpx` result object so agents can choose between concise fields and full evidence.

## 5. Search history

```bash
stackray search results --technology WordPress --cdn fastly --json
```

## 6. List recent scans

```bash
stackray scan list --status completed --limit 20 --json
```

## Authentication

Use a bearer token:

```bash
export STACKRAY_TOKEN=...
export STACKRAY_BASE_URL=https://app.stackray.local
```

## Idempotency

The CLI should allow an explicit idempotency key:

```bash
stackray scan submit https://primary.example.test --idempotency-key nightly-tpss
```

If the backend returns `reused=true`, the CLI should present the existing `scan_id` rather than treating it as an error.

`idempotency-key` is meant for replay protection on near-duplicate submissions, not for permanently reserving a key forever.

## Agent-friendly expectations

- all commands support `--json`
- all IDs are stable strings, not positional numbers
- `watch` exits zero on successful completion
- `watch` exits non-zero on terminal failure or cancellation
- `results` can optionally output a reduced summary or full payload

## Local worker mode (future)

If the product later supports scans that must originate from the agent's machine, the CLI can gain a `worker run` mode that claims central jobs and writes results back through the same API. That mode must not create a second source of truth.
