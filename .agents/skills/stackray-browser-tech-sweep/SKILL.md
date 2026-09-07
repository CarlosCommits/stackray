---
name: stackray-browser-tech-sweep
description: Stackray workflow for manually inspecting live websites and DNS/TXT evidence, comparing runtime JavaScript/framework/analytics/DNS promotions against existing Stackray scan results, and adding conservative technology detection rules. Use when the user asks to sweep one or more sites with agent-browser, compare modern frontend/browser/DNS technologies against Stackray results, use subagents to parallelize website technology inspection, use BuiltWith as a lead generator, or investigate Wappalyzer/httpx/Nuclei TXT misses.
---

# Stackray Browser Tech Sweep

Use this skill when the task is broader than adding one known technology: the user wants a manual live-site sweep, a comparison against Stackray scan results, and new detections for any missed runtime technologies.

This skill complements `$stackray-technology-detection`. Use that skill for the actual detector-layer decisions, metadata rules, tests, and scanner proof. Use `$agent-browser` for manual browser inspection.

## Workflow

1. Read Stackray context before editing:
   - `docs/technology-detection.md`
   - the repository root's `.agents/skills/stackray-technology-detection/SKILL.md`
   - the installed `$agent-browser` skill's `SKILL.md`

2. Confirm the local Stackray instance:
   - Check tmux/compose for running Stackray services.
   - Prefer the existing worker containers and local `.env.local` database.
   - Do not rely on host `httpx`, `nuclei`, or browser binaries when worker containers are available.

3. Split the sweep across subagents when the user provides multiple sites or explicitly asks for parallelization:
   - Assign disjoint domains to each subagent.
   - Ask for browser evidence, latest Stackray scan technologies, missed technologies, and unsafe/noisy signals.
   - Tell subagents not to edit files unless they own a clearly bounded implementation slice.
   - Keep implementation integration in the main agent unless the write scopes are disjoint.

4. Build the Stackray baseline for each domain:
   - Find the latest completed scan/result in the local DB.
   - If no completed local scan exists, create a baseline Stackray scan first when the local app is running and auth is available, then wait for completion before comparing.
   - If a baseline scan cannot be created, say so explicitly and continue with manual browser evidence plus worker `httpx` proof as provisional evidence, not a full Stackray comparison.
   - Extract detected technologies, sources, URLs, Nuclei technology matches, DNS service matches, and TXT record findings.
   - Record whether the missing item is absent entirely or only lacks metadata/icon.

5. Inspect DNS TXT technology evidence for every domain:
   - Treat BuiltWith DNS, email, verification, analytics, AI, cloud, and infrastructure entries as TXT/DNS leads, not just browser-runtime leads.
   - Query the Stackray scan result's Nuclei data for `finding_kind = 'txt_record'`, `finding_kind = 'dns_service'`, and technology detections with `source = 'nuclei'`.
   - Compare raw TXT evidence from Stackray with promoted technologies. Look for TXT records that clearly identify a service but did not become a `source: "nuclei"` technology.
   - If Stackray has no TXT finding for the result, or if the Nuclei DNS phase failed/skipped, independently inspect current TXT records with `dig TXT <domain>` or `node:dns.resolveTxt` and label that evidence as live DNS evidence rather than persisted Stackray evidence.
   - Do not paste full secret-like TXT values into reports. Redact verification tokens and quote only the stable prefix or provider domain needed to justify a rule.
   - For missed TXT/DNS services, implement through Nuclei YAML/fallback-compatible TXT rules, not Wappalyzer fingerprints or hardcoded TypeScript constants.

6. Sweep each live site in a real browser:
   - Use `agent-browser`, not only curl or static HTML.
   - Wait for runtime resources, then collect targeted evidence from:
     - script URLs and fetched resources
     - browser globals and global property paths
     - cookies, localStorage, and sessionStorage keys
     - DOM markers and meta tags
     - stable package names or vendor CDN paths
     - response headers when relevant
   - Inspect a few product pages or app entry pages when the homepage is sparse, but avoid login-only assumptions.

7. Classify evidence before editing:
   - Strong: exact vendor CDN/package URL, documented cookie, global, DOM attribute, header, or DNS verification record.
   - Supporting: product API hostname, script body token, storage key, generated config URL.
   - Unsafe: customer logos, testimonials, marketing copy, broad product words, generic bundle strings, or unrelated SVG/asset names.

8. Compare manually observed evidence to Stackray results:
   - Add a detector only when Stackray currently misses a real runtime technology and the signal is stable enough.
   - Add metadata only when Stackray already detects the technology but display data is missing or wrong.
   - Do not duplicate generated Wappalyzer metadata just to fix one field; use sparse overrides.

9. Use BuiltWith as an optional candidate source:
   - After the Stackray baseline and before final detector decisions, try `https://builtwith.com/<domain>` or search the domain from `https://builtwith.com/`.
   - Treat BuiltWith as a lead generator, not proof. Its output can include internal operations tools, private data platforms, broad schema markers, inferred language, and generic page attributes that should not become Stackray detections without public evidence.
   - If BuiltWith presents a simple first-party image-selection challenge, attempt to solve it once or twice using the visible prompt and screenshot/coordinate clicks. Do not immediately give up just because the challenge appears.
   - If BuiltWith requires login, blocks with an unsolved challenge, rate-limits the session, or otherwise prevents access after a reasonable attempt, mark BuiltWith unavailable for that domain and continue with Stackray + live-browser evidence.
   - Extract technology headings or profile entries as candidate hints, then classify them before acting:
     - Strong public candidates: items with likely script URLs, browser globals, cookies, DOM markers, headers, DNS, or TXT evidence to verify on the live site.
     - Infrastructure candidates: CDN, hosting, DNS, MX, SSL, TXT verification, email, and edge/runtime services that need scanner/DNS/header proof.
     - Internal/operations candidates: CI, data pipelines, Terraform/IaC, private databases, and observability tools. These are low confidence unless the public site exposes an actual UI, API, badge, webhook marker, or DNS/TXT signature.
     - Noise/generic candidates: schema tags, viewport/mobile compatibility, language inference, rankings, public datasets, page-type guesses, and broad marketing/category labels. Usually ignore these.
   - For every BuiltWith candidate that Stackray misses, inspect the live site or DNS records for stable evidence before editing. Never add a detector solely because BuiltWith lists the technology.
   - In the final report, include BuiltWith status and note which BuiltWith candidates were accepted, rejected, or left as unverified leads.

10. Implement through the right detection layer:
   - Wappalyzer/httpx runtime signals go in `lib/server/scans/custom-wappalyzer-fingerprints.json`.
   - Display fixes go in `lib/server/scans/custom-technology-metadata.json`.
   - DNS/TXT signatures go in Nuclei YAML and TXT fallback-supported templates, not hardcoded TypeScript constants.
   - Never hand-edit `lib/server/scans/generated/wappalyzer-catalog.json`.

11. Prove the result:
   - Add focused unit tests for custom fingerprints and metadata.
   - Run focused tests first, then `pnpm lint` and `pnpm typecheck` when changes are code-facing.
   - Run worker-container `httpx -tdh -cff` for JavaScript-heavy detections.
   - For TXT/DNS detections, validate the Nuclei YAML, run focused Nuclei/TXT fallback tests, and prove the matcher against real or fixture TXT evidence.
   - Success means the JSONL `tech` array includes the expected canonical names on the real site.

12. Report clearly:
   - List sites swept, missed technologies added, and signals intentionally rejected.
   - Include scanner proof and test commands.
   - Include DNS TXT status: persisted TXT evidence checked, accepted TXT/DNS promotions, rejected TXT leads, and any live DNS evidence that was not in the local scan.
   - State whether existing scans need workers restarted/redeployed or new scans to see the detections.

## Reference

For reusable commands, SQL shape, extraction snippets, and subagent prompts, read `references/sweep-workflow.md`.
