# Subfinder active wildcard filtering issue

## Purpose

This note documents a Subfinder behavior observed while testing Stackray subdomain discovery against a wildcard-backed apex domain. Stackray should not work around this by replacing Subfinder active discovery with a custom passive-plus-validation pipeline. If we decide to improve the behavior, the preferred path is to investigate Subfinder itself and submit an upstream PR.

## Observed case

The examples below use anonymized reserved names. Replace `example.test` and the sample hostnames with the real target when reproducing against an upstream issue branch.

Domain shape:

```text
example.test
```

Stackray currently runs Subfinder with active resolution and IP output:

```bash
subfinder -silent -json -d example.test -nW -oI -duc -max-time 2
```

That command returned 14 active subdomains in local testing:

```text
accounts.event.example.test
alpha.example.test
api.service.example.test
auth.example.test
auth2.example.test
beta.example.test
chat.example.test
clerk.event.example.test
feedback.example.test
http.service.example.test
page-preview.example.test
signin.example.test
sse.service.example.test
www.example.test
```

A third-party DNS enumeration tool reported 15 subdomains, and specifically included names that Stackray/Subfinder active mode did not include:

```text
event.example.test
legacy.example.test
```

Running Subfinder in passive JSON mode did include both names:

```bash
subfinder -silent -json -d example.test -duc -max-time 2
```

Relevant passive output:

```json
{"host":"legacy.example.test","input":"example.test","source":"submd"}
{"host":"event.example.test","input":"example.test","source":"submd"}
```

With source collection enabled, both names were observed from multiple passive sources:

```bash
subfinder -silent -json -cs -d example.test -duc -max-time 2
```

Relevant output:

```json
{"host":"legacy.example.test","input":"example.test","sources":["submd","hackertarget","thc"]}
{"host":"event.example.test","input":"example.test","sources":["thc","submd","hackertarget"]}
```

## Why Stackray missed it

This is caused by Subfinder active mode, not by Stackray persistence or UI rendering.

Subfinder documents:

- `-nW, -active`: display active subdomains only
- `-oI, -ip`: include host IP in output, active mode only

Stackray chose active mode because it gives IP addresses and suppresses many non-resolving passive candidates. For this wildcard-backed domain, that also suppresses some legitimate or interesting names because the apex has wildcard DNS behavior through a common hosting provider.

Local DNS checks showed random/nonexistent hosts resolving to the same provider wildcard IPs:

```text
zz-not-real-12345.example.test -> 203.0.113.10, 203.0.113.11
x1779115084718.example.test   -> 203.0.113.10, 203.0.113.11
event.example.test            -> 203.0.113.10, 203.0.113.11
legacy.example.test           -> 203.0.113.10, 203.0.113.11
```

Because those names match the wildcard DNS response set, Subfinder active mode appears to filter them out as wildcard matches.

The false-negative risk is real: one filtered host was not just passive noise. It responded over HTTPS with `200` during local testing. Another filtered host looked less healthy: normal HTTPS failed certificate validation, and `curl -k` returned a provider-level deployment-not-found response.

## Reproduction commands

Run active mode, which misses the two apex-level names:

```bash
subfinder -silent -json -d example.test -nW -oI -duc -max-time 2
```

Run passive mode, which includes them:

```bash
subfinder -silent -json -d example.test -duc -max-time 2 | grep -E 'event|legacy'
```

Run passive mode with collected sources:

```bash
subfinder -silent -json -cs -d example.test -duc -max-time 2 | grep -E 'event|legacy'
```

Check wildcard DNS behavior:

```bash
node --input-type=module <<'EOF'
import dns from "node:dns/promises";

for (const host of [
  "zz-not-real-12345.example.test",
  "event.example.test",
  "legacy.example.test",
]) {
  try {
    console.log(host, await dns.resolve4(host));
  } catch (error) {
    console.log(host, error.code);
  }
}
EOF
```

Check HTTP behavior:

```bash
curl -I -L --max-time 15 https://event.example.test
curl -I -L --max-time 15 https://legacy.example.test
curl -k -I -L --max-time 15 https://legacy.example.test
```

## Upstream investigation direction

The likely upstream issue is that active wildcard filtering is too coarse for wildcard-backed hosting providers. A host can resolve to the wildcard IP set and still be a real configured route/deployment.

Potential upstream improvements to investigate:

- Preserve active-mode candidates that have strong passive-source evidence, even when their DNS answer matches a wildcard baseline.
- Emit wildcard-filtered candidates in JSON with a marker such as `wildcard_filtered: true` instead of dropping them entirely.
- Add an option to include wildcard-matching candidates while still resolving IPs, so downstream tools can decide how to score them.
- Compare more than just A/AAAA overlap when deciding whether a candidate is wildcard noise, for example CNAME, HTTP status, TLS/SNI response, or provider-specific signals.

For Stackray, the ideal upstream shape would let us keep using Subfinder as the source of truth and still receive:

- `host`
- `source` or `sources`
- resolved IPs when available
- a wildcard/filtering confidence marker

That would avoid a Stackray-specific passive discovery and validation pipeline while preserving the data needed to explain uncertain subdomain results.

## Current Stackray decision

Do not change Stackray to passive-only discovery for this issue yet.

Passive mode would include the filtered hosts, but it would also remove IP output from Subfinder and require Stackray to build separate DNS/HTTP validation logic. That is larger than the desired product change right now and duplicates behavior that belongs closer to Subfinder.
