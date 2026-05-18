# Homepage Screenshot Plan

## Goal

Capture one screenshot for the homepage of each canonical scan result, store the image in Railway Bucket storage, and surface it on the scan detail page without storing image bytes in Postgres.

## Why this design

- `httpx` already has first-class screenshot support via `-screenshot`
- screenshot capture is materially slower than the main metadata pass, so it should run as a dedicated follow-up step
- Railway Buckets are private and S3-compatible, which fits authenticated screenshot delivery well
- Postgres should store screenshot metadata only, not image bytes

## Execution model

### Main scan pass

Keep the current `stack-deep` `httpx` pass unchanged for metadata, technology detection, DNS, TLS, and WordPress signals.

### Screenshot pass

For each canonical persisted scan result that represents the requested homepage target:

- run a second `httpx` invocation with a narrow screenshot profile
- use `-tdh -title -screenshot -json -fr -esb -ehb -srd <temp-dir>`
- do **not** include `-csp-probe` or `-extract-fqdn`
- read `screenshot_path` from the JSON output
- upload the PNG to Railway Bucket storage
- update the same `scan_results` row with screenshot metadata

## Persistence

Add screenshot metadata columns to `scan_results`:

- `screenshot_object_key`
- `screenshot_content_type`
- `screenshot_byte_size`
- `screenshot_captured_at`

These fields describe the durable object in the bucket while keeping the image itself out of Postgres.

## Storage

Use a Railway Bucket with AWS-SDK-compatible environment variables injected into the worker and app.

Recommended object key pattern:

`scan-screenshots/<scan-id>/<result-id>.webp`

## Delivery

Add an authenticated route:

`/api/v1/scans/[scanId]/results/[resultId]/screenshot`

This route should:

- verify session access
- verify screenshot metadata exists for the result
- generate a short-lived presigned `GetObject` URL
- redirect the browser to that URL

## UI

Add a screenshot panel to the scan detail page that:

- shows the homepage screenshot when available
- uses the authenticated screenshot route as the image source
- shows a lightweight placeholder when the screenshot is not available yet

## Environment

Expected service variables:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_ENDPOINT_URL`
- `AWS_S3_BUCKET_NAME`
- `AWS_DEFAULT_REGION`
- `STACKRAY_SCREENSHOT_TIMEOUT_MS` (optional)
- `STACKRAY_HEADLESS_ENRICHMENT_TIMEOUT_MS` (optional)

## Verification

- schema migration applies cleanly
- worker stores screenshot metadata for successful homepage results
- screenshot route returns a redirect for authorized users
- scan detail page renders the screenshot without breaking existing cards
- diagnostics, tests, and build all pass
