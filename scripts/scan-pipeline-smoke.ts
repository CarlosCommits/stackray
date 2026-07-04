import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { asc, eq, sql } from "drizzle-orm";

import {
  canonicalTargets,
  scanAttempts,
  scanEvents,
  scanPhaseRuns,
  scanResultNucleiMatches,
  scanResults,
  scans,
  scanSubdomains,
  users,
} from "../drizzle/schema.ts";
import { enqueueGraphileJob } from "../lib/server/jobs/graphile.ts";
import { db, pool } from "../worker/db.ts";
import { SMOKE_JOB_FLAG } from "../worker/worker-config.ts";

const SMOKE_USER_ID = "00000000-0000-4000-8000-0000000000c1";
const TARGET_HOST = "stackray-smoke.test";
const EXPECTED_PHASES = [
  "http_probe",
  "subfinder",
  "headless",
  "browser_fallback",
  "nuclei_dns",
  "nuclei_http",
  "ip_intel",
  "finalize",
] as const;
const COMPLETION_TIMEOUT_MS = 90_000;
const WORKER_STOP_TIMEOUT_MS = 12_000;
const WAIT_POLL_INTERVAL_MS = 250;

type WorkerRole = "http" | "intel" | "browser";

type WorkerProcess = {
  role: WorkerRole;
  child: ChildProcess;
  logs: string[];
};

type WorkerEnv = Record<string, string>;

type WaitForPredicateOptions = {
  readonly description: string;
  readonly timeoutMs: number;
  readonly workers: readonly WorkerProcess[];
  readonly details?: () => Promise<string> | string;
};

type SmokeScenarioContext = {
  readonly fixturePort: number;
  readonly workerEnv: WorkerEnv;
  readonly fakeBinDirectory: string;
};

type SmokeScenarioResult = {
  readonly name: string;
  readonly scanId: string;
  readonly resultCount: number;
  readonly nucleiMatchCount: number;
  readonly subdomainCount: number;
  readonly phases: Awaited<ReturnType<typeof readScanSnapshot>>["phases"];
};

function fixtureHandler(request: IncomingMessage, response: ServerResponse) {
  if (request.url === "/favicon.ico") {
    response.writeHead(200, {
      "content-type": "image/x-icon",
      server: "Stackray Fixture",
    });
    response.end(Buffer.from("AAABAAEAEBAAAAAAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAQAQAAMMOAADDDgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "base64"));
    return;
  }

  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    server: "Stackray Fixture",
  });
  response.end(`<!doctype html>
<html>
  <head>
    <title>Stackray CI smoke fixture</title>
    <link rel="icon" href="/favicon.ico">
  </head>
  <body>
    <h1>Stackray CI smoke fixture</h1>
    <script src="https://js.stripe.com/v3"></script>
    <script>window.stackraySmokeFixture = true;</script>
  </body>
</html>`);
}

async function startFixtureServer() {
  const server = createServer(fixtureHandler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve fixture server address.");
  }

  return {
    port: address.port,
    close: async () => {
      server.close();
      await once(server, "close");
    },
  };
}

async function writeExecutable(filePath: string, contents: string) {
  await writeFile(filePath, contents, "utf8");
  await chmod(filePath, 0o755);
}

function fakeHttpxSource() {
  return [
    "#!/usr/bin/env node",
    "import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';",
    "import { join } from 'node:path';",
    "",
    "const args = process.argv.slice(2);",
    "if (args.includes('-version') || args.includes('--version')) {",
    "  console.log('fake-httpx 0.0.0');",
    "  process.exit(0);",
    "}",
    "",
    "const fixturePort = process.env.STACKRAY_SMOKE_FIXTURE_PORT;",
    "if (!fixturePort) throw new Error('STACKRAY_SMOKE_FIXTURE_PORT is required.');",
    "",
    "async function holdOnceIfRequested() {",
    "  const gateFile = process.env.STACKRAY_SMOKE_HTTPX_HOLD_ONCE_FILE;",
    "  if (!gateFile || existsSync(gateFile)) return;",
    "  writeFileSync(gateFile, JSON.stringify({ scanner: 'httpx', pid: process.pid, args, at: new Date().toISOString() }));",
    "  await new Promise(() => setInterval(() => {}, 60_000));",
    "}",
    "",
    "function argValue(flag) {",
    "  const index = args.indexOf(flag);",
    "  return index === -1 ? null : args[index + 1] ?? null;",
    "}",
    "",
    "function targetsFromInput() {",
    "  const explicitTarget = argValue('-u');",
    "  if (explicitTarget) return [explicitTarget];",
    "  return readFileSync(0, 'utf8').split(/\\s+/).map((value) => value.trim()).filter(Boolean);",
    "}",
    "",
    "function normalizeTarget(target) {",
    "  const url = new URL(target.includes('://') ? target : `https://${target}`);",
    "  const path = `${url.pathname || '/'}${url.search}`;",
    "  return {",
    "    input: target,",
    "    outputUrl: `https://stackray-smoke.test:${fixturePort}${path}`,",
    "    fetchUrl: `http://127.0.0.1:${fixturePort}${path}`,",
    "    path,",
    "  };",
    "}",
    "",
    "function getTitle(html) {",
    "  return /<title>([^<]+)<\\/title>/i.exec(html)?.[1] ?? 'Stackray CI smoke fixture';",
    "}",
    "",
    "function maybeWriteScreenshot(payload) {",
    "  const storeDir = argValue('-srd');",
    "  if (!storeDir) return payload;",
    "  const screenshotDir = join(storeDir, 'screenshot');",
    "  mkdirSync(screenshotDir, { recursive: true });",
    "  const screenshotPath = join(screenshotDir, 'fixture.png');",
    "  writeFileSync(screenshotPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64'));",
    "  return { ...payload, screenshot_path: screenshotPath };",
    "}",
    "",
    "for (const target of targetsFromInput()) {",
    "  await holdOnceIfRequested();",
    "  const normalized = normalizeTarget(target);",
    "  const started = Date.now();",
    "  const response = await fetch(normalized.fetchUrl, { headers: { host: `stackray-smoke.test:${fixturePort}` } });",
    "  const body = await response.text();",
    "  const payload = maybeWriteScreenshot({",
    "    url: normalized.outputUrl,",
    "    final_url: normalized.outputUrl,",
    "    input: normalized.input,",
    "    host: 'stackray-smoke.test',",
    "    scheme: 'https',",
    "    port: String(fixturePort),",
    "    path: normalized.path,",
    "    method: 'GET',",
    "    host_ip: '198.51.100.42',",
    "    status_code: response.status,",
    "    title: getTitle(body),",
    "    webserver: response.headers.get('server') ?? 'Stackray Fixture',",
    "    content_type: response.headers.get('content-type') ?? 'text/html',",
    "    content_length: body.length,",
    "    response_time: `${Date.now() - started}ms`,",
    "    words: body.split(/\\s+/).filter(Boolean).length,",
    "    lines: body.split('\\n').length,",
    "    tech: ['Stripe', 'Next.js'],",
    "    favicon: '123456789',",
    "    favicon_md5: 'd41d8cd98f00b204e9800998ecf8427e',",
    "    favicon_url: `https://stackray-smoke.test:${fixturePort}/favicon.ico`,",
    "    a: ['198.51.100.42'],",
    "    cname: [],",
    "    resolvers: ['127.0.0.1'],",
    "    hash: { body_md5: 'stackray-fixture-md5' },",
    "    body_domains: ['stackray-smoke.test'],",
    "    body_fqdns: ['assets.stackray-smoke.test'],",
    "    body_preview: body.slice(0, 200),",
    "    chain_status_codes: [response.status],",
    "    chain: [{ url: normalized.outputUrl, status_code: response.status }],",
    "    link_request: [{ ResourceType: 'Document', URL: normalized.outputUrl, StatusCode: response.status }],",
    "  });",
    "  console.log(JSON.stringify(payload));",
    "}",
  ].join("\n");
}

function fakeSubfinderSource() {
  return [
    "#!/usr/bin/env node",
    "const args = process.argv.slice(2);",
    "if (args.includes('-version') || args.includes('--version')) {",
    "  console.log('fake-subfinder 0.0.0');",
    "  process.exit(0);",
    "}",
    "const domain = args[args.indexOf('-d') + 1] ?? 'stackray-smoke.test';",
    "console.log(JSON.stringify({",
    "  host: `www.${domain}`,",
    "  input: domain,",
    "  ip: '198.51.100.43',",
    "  source: 'stackray-smoke',",
    "  sources: ['stackray-smoke'],",
    "  wildcard_certificate: false,",
    "}));",
  ].join("\n");
}

function fakeNucleiSource() {
  return [
    "#!/usr/bin/env node",
    "import { existsSync, writeFileSync } from 'node:fs';",
    "",
    "const args = process.argv.slice(2);",
    "if (args.includes('-version') || args.includes('--version')) {",
    "  console.log('fake-nuclei 0.0.0');",
    "  process.exit(0);",
    "}",
    "async function holdOnceIfRequested() {",
    "  const gateFile = process.env.STACKRAY_SMOKE_NUCLEI_HOLD_ONCE_FILE;",
    "  if (!gateFile || existsSync(gateFile)) return;",
    "  writeFileSync(gateFile, JSON.stringify({ scanner: 'nuclei', pid: process.pid, args, at: new Date().toISOString() }));",
    "  await new Promise(() => setInterval(() => {}, 60_000));",
    "}",
    "",
    "await holdOnceIfRequested();",
    "const target = args[args.indexOf('-u') + 1] ?? 'stackray-smoke.test';",
    "const isUrl = /^https?:\\/\\//.test(target);",
    "console.log(JSON.stringify(isUrl ? {",
    "  'template-id': 'tech-detect',",
    "  'template-path': 'http/technologies/tech-detect.yaml',",
    "  'matcher-name': 'Stackray Fixture App',",
    "  type: 'http',",
    "  severity: 'info',",
    "  'matched-at': target,",
    "  host: 'stackray-smoke.test',",
    "  url: target,",
    "  ip: '198.51.100.42',",
    "} : {",
    "  'template-id': 'stackray-dns-service-detection',",
    "  'template-path': 'dns/stackray-dns-service-detection.yaml',",
    "  'matcher-name': 'Stackray Fixture DNS',",
    "  type: 'dns',",
    "  severity: 'info',",
    "  'matched-at': target,",
    "  host: target,",
    "  ip: '198.51.100.42',",
    "}));",
  ].join("\n");
}

async function createFakeScannerBin() {
  const directory = await mkdtemp(join(tmpdir(), "stackray-smoke-bin-"));
  const httpx = join(directory, "httpx");
  const subfinder = join(directory, "subfinder");
  const nuclei = join(directory, "nuclei");

  await Promise.all([
    writeExecutable(httpx, fakeHttpxSource()),
    writeExecutable(subfinder, fakeSubfinderSource()),
    writeExecutable(nuclei, fakeNucleiSource()),
  ]);

  return {
    directory,
    httpx,
    subfinder,
    nuclei,
    cleanup: async () => {
      await rm(directory, { recursive: true, force: true });
    },
  };
}

async function queueSmokeScan(port: number) {
  await db.insert(users).values({
    id: SMOKE_USER_ID,
    email: "ci-smoke@stackray.local",
    displayName: "Stackray CI Smoke",
    emailVerified: true,
    role: "admin",
  }).onConflictDoNothing();

  const inputTarget = `https://${TARGET_HOST}:${port}`;
  const normalizedTarget = `${TARGET_HOST}:${port}`;
  const optionsJson = {
    followRedirects: true,
    includeRawResponse: false,
    headless: false,
  };
  const requestFingerprint = createHash("sha256")
    .update(JSON.stringify({ userId: SMOKE_USER_ID, target: normalizedTarget, options: optionsJson }))
    .digest("hex");

  const createdScan = await db.transaction(async (tx) => {
    const [scan] = await tx.insert(scans).values({
      createdByUserId: SMOKE_USER_ID,
      createdByApiKeyId: null,
      scheduleId: null,
      source: "cli",
      status: "queued",
      profile: "stack-deep",
      idempotencyKey: `ci-smoke-${Date.now()}-${process.hrtime.bigint()}`,
      requestFingerprint,
      canonicalTargetId: null,
      inputTarget,
      normalizedTarget,
      optionsJson,
      scheduledForAt: null,
    }).returning();

    await tx.insert(canonicalTargets).values({
      normalizedTarget,
      targetType: "url",
    }).onConflictDoNothing();

    const [canonicalRow] = await tx
      .select()
      .from(canonicalTargets)
      .where(eq(canonicalTargets.normalizedTarget, normalizedTarget))
      .limit(1);

    await tx.update(scans).set({ canonicalTargetId: canonicalRow?.id ?? null }).where(eq(scans.id, scan.id));
    await tx.insert(scanEvents).values({
      scanId: scan.id,
      attemptId: null,
      eventType: "scan.status",
      payload: {
        scanId: scan.id,
        status: "queued",
        attemptId: null,
        at: new Date().toISOString(),
      },
    });
    await enqueueGraphileJob(tx, "http_probe", { scanId: scan.id }, {
      jobKey: `scan:${scan.id}:http_probe`,
      jobKeyMode: "preserve_run_at",
      flags: [SMOKE_JOB_FLAG],
      runAt: scan.submittedAt,
    });

    return scan;
  });

  return createdScan.id;
}

async function queuePartialCompletedHttpProbeHandoffScan(port: number) {
  await db.insert(users).values({
    id: SMOKE_USER_ID,
    email: "ci-smoke@stackray.local",
    displayName: "Stackray CI Smoke",
    emailVerified: true,
    role: "admin",
  }).onConflictDoNothing();

  const now = new Date();
  const inputTarget = `https://${TARGET_HOST}:${port}`;
  const normalizedTarget = `${TARGET_HOST}:${port}`;
  const finalUrl = `https://${TARGET_HOST}:${port}/`;
  const optionsJson = {
    followRedirects: true,
    includeRawResponse: false,
    headless: false,
  };
  const requestFingerprint = createHash("sha256")
    .update(JSON.stringify({
      userId: SMOKE_USER_ID,
      target: normalizedTarget,
      options: optionsJson,
      scenario: "partial-http-probe-handoff",
      nonce: `${Date.now()}-${process.hrtime.bigint()}`,
    }))
    .digest("hex");

  const createdScan = await db.transaction(async (tx) => {
    const [scan] = await tx.insert(scans).values({
      createdByUserId: SMOKE_USER_ID,
      createdByApiKeyId: null,
      scheduleId: null,
      source: "cli",
      status: "processing",
      profile: "stack-deep",
      idempotencyKey: `ci-smoke-partial-handoff-${Date.now()}-${process.hrtime.bigint()}`,
      requestFingerprint,
      canonicalTargetId: null,
      inputTarget,
      normalizedTarget,
      optionsJson,
      scheduledForAt: null,
    }).returning();

    await tx.insert(canonicalTargets).values({
      normalizedTarget,
      targetType: "url",
    }).onConflictDoNothing();

    const [canonicalRow] = await tx
      .select()
      .from(canonicalTargets)
      .where(eq(canonicalTargets.normalizedTarget, normalizedTarget))
      .limit(1);

    await tx.update(scans).set({ canonicalTargetId: canonicalRow?.id ?? null }).where(eq(scans.id, scan.id));

    const [attempt] = await tx.insert(scanAttempts).values({
      scanId: scan.id,
      attemptNumber: 1,
      workerId: "smoke-partial-handoff",
      status: "running",
      startedAt: now,
      metaJson: {
        requestProfile: "baseline",
        fallbackReason: null,
        resultCount: 1,
        forbiddenResultCount: 0,
      },
    }).returning();

    const [result] = await tx.insert(scanResults).values({
      scanId: scan.id,
      attemptId: attempt.id,
      observedAt: now,
      url: finalUrl,
      finalUrl,
      input: inputTarget,
      host: TARGET_HOST,
      scheme: "https",
      port: String(port),
      path: "/",
      method: "GET",
      hostIp: "198.51.100.42",
      statusCode: 200,
      title: "Stackray CI smoke fixture",
      webServer: "Stackray Fixture",
      contentType: "text/html; charset=utf-8",
      contentLength: 256,
      responseTimeMs: 1,
      words: 8,
      lines: 12,
      faviconMmh3: "123456789",
      faviconMd5: "d41d8cd98f00b204e9800998ecf8427e",
      faviconUrl: `https://${TARGET_HOST}:${port}/favicon.ico`,
      dnsARecords: ["198.51.100.42"],
      dnsAaaaRecords: [],
      dnsCnameRecords: [],
      dnsResolvers: ["127.0.0.1"],
      bodyDomains: [TARGET_HOST],
      bodyFqdns: [`assets.${TARGET_HOST}`],
      bodyPreview: "Stackray CI smoke fixture",
      redirectChainStatusCodes: [200],
      redirectChainJson: [],
      failed: false,
      rawJson: {
        url: finalUrl,
        final_url: finalUrl,
        input: inputTarget,
        host: TARGET_HOST,
        host_ip: "198.51.100.42",
        status_code: 200,
        title: "Stackray CI smoke fixture",
        tech: ["Stripe", "Next.js"],
      },
      searchDocument: "Stackray CI smoke fixture Stripe Next.js",
    }).returning();

    await tx.insert(scanEvents).values({
      scanId: scan.id,
      attemptId: null,
      eventType: "scan.status",
      payload: {
        scanId: scan.id,
        status: "queued",
        attemptId: null,
        at: now.toISOString(),
      },
    });
    await tx.insert(scanEvents).values({
      scanId: scan.id,
      attemptId: attempt.id,
      eventType: "scan.status",
      payload: {
        scanId: scan.id,
        status: "processing",
        attemptId: attempt.id,
        at: now.toISOString(),
      },
    });
    await tx.insert(scanPhaseRuns).values([
      {
        scanId: scan.id,
        attemptId: attempt.id,
        resultId: result.id,
        phase: "http_probe",
        status: "completed",
        workerId: null,
        jobKey: `scan:${scan.id}:attempt:${attempt.id}:phase:http_probe`,
        metaJson: {
          resultCount: 1,
          selectedResultId: result.id,
          selectedResultStatusCode: 200,
          provisionalResultKind: null,
        },
        queuedAt: now,
        startedAt: now,
        completedAt: now,
        updatedAt: now,
      },
      {
        scanId: scan.id,
        attemptId: attempt.id,
        resultId: null,
        phase: "subfinder",
        status: "queued",
        workerId: null,
        jobKey: `scan:${scan.id}:attempt:${attempt.id}:phase:subfinder`,
        metaJson: {},
        queuedAt: now,
        updatedAt: now,
      },
    ]);

    return scan;
  });

  return createdScan.id;
}

function appendBounded(logs: string[], chunk: Buffer) {
  logs.push(chunk.toString());
  while (logs.join("").length > 20_000) {
    logs.shift();
  }
}

function startWorker(role: WorkerRole, env: WorkerEnv): WorkerProcess {
  const child = spawn(
    process.execPath,
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--experimental-strip-types", "worker/index.ts"],
    {
      env: {
        ...process.env,
        ...env,
        STACKRAY_WORKER_ROLE: role,
        STACKRAY_WORKER_CONCURRENCY: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const worker: WorkerProcess = { role, child, logs: [] };

  child.stdout?.on("data", (chunk: Buffer) => appendBounded(worker.logs, chunk));
  child.stderr?.on("data", (chunk: Buffer) => appendBounded(worker.logs, chunk));
  child.on("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      worker.logs.push(`\nworker ${role} exited with code ${code} signal ${signal}\n`);
    }
  });

  return worker;
}

function formatWorkerLogs(workers: readonly WorkerProcess[]) {
  return workers
    .map((worker) => `--- worker:${worker.role} ---\n${worker.logs.join("").trim()}`)
    .join("\n");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPredicate(predicate: () => boolean | Promise<boolean>, options: WaitForPredicateOptions) {
  const deadline = Date.now() + options.timeoutMs;

  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }

    await delay(WAIT_POLL_INTERVAL_MS);
  }

  const details = options.details ? await options.details() : "";
  throw new Error([
    `Timed out waiting for ${options.description}.`,
    details,
    formatWorkerLogs(options.workers),
  ].filter(Boolean).join("\n"));
}

async function waitForFile(filePath: string, description: string, workers: readonly WorkerProcess[]) {
  await waitForPredicate(() => existsSync(filePath), {
    description,
    timeoutMs: 30_000,
    workers,
  });
}

async function interruptWorker(worker: WorkerProcess) {
  if (worker.child.exitCode !== null || worker.child.signalCode !== null) {
    throw new Error(`Cannot interrupt ${worker.role} worker because it already exited.`);
  }

  worker.child.kill("SIGTERM");

  await Promise.race([
    once(worker.child, "exit"),
    delay(WORKER_STOP_TIMEOUT_MS).then(() => {
      if (worker.child.exitCode === null && worker.child.signalCode === null) {
        worker.child.kill("SIGKILL");
      }
    }),
  ]);
}

async function stopWorkers(workers: readonly WorkerProcess[]) {
  await Promise.all(workers.map(async ({ child }) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    child.kill("SIGTERM");
    await Promise.race([
      once(child, "exit"),
      delay(WORKER_STOP_TIMEOUT_MS).then(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL");
        }
      }),
    ]);
  }));
}

async function readScanSnapshot(scanId: string) {
  const [scan] = await db.select().from(scans).where(eq(scans.id, scanId)).limit(1);
  const attempts = await db
    .select()
    .from(scanAttempts)
    .where(eq(scanAttempts.scanId, scanId))
    .orderBy(asc(scanAttempts.attemptNumber));
  const phases = await db
    .select()
    .from(scanPhaseRuns)
    .where(eq(scanPhaseRuns.scanId, scanId))
    .orderBy(asc(scanPhaseRuns.queuedAt), asc(scanPhaseRuns.phase));
  const events = await db
    .select()
    .from(scanEvents)
    .where(eq(scanEvents.scanId, scanId))
    .orderBy(asc(scanEvents.id));
  const [resultCount] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(scanResults)
    .where(eq(scanResults.scanId, scanId));
  const [nucleiMatchCount] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(scanResultNucleiMatches)
    .innerJoin(scanResults, eq(scanResults.id, scanResultNucleiMatches.resultId))
    .where(eq(scanResults.scanId, scanId));
  const [subdomainCount] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(scanSubdomains)
    .where(eq(scanSubdomains.scanId, scanId));

  return {
    scan,
    attempt: attempts[0] ?? null,
    attempts,
    phases,
    events,
    resultCount: resultCount?.value ?? 0,
    nucleiMatchCount: nucleiMatchCount?.value ?? 0,
    subdomainCount: subdomainCount?.value ?? 0,
  };
}

function summarizePhases(phases: Awaited<ReturnType<typeof readScanSnapshot>>["phases"]) {
  return phases.map((phase) => `${phase.phase}:${phase.status}`).join(", ");
}

function isWorkerInterruptedRecoveredPhase(phaseRun: Awaited<ReturnType<typeof readScanSnapshot>>["phases"][number]) {
  return (phaseRun.status === "failed" || phaseRun.status === "skipped")
    && (phaseRun.errorCode === "worker_interrupted" || phaseRun.metaJson["recoveryReason"] === "worker_interrupted");
}

function assertCompletedSnapshot(snapshot: Awaited<ReturnType<typeof readScanSnapshot>>) {
  if (!snapshot.scan) {
    throw new Error("Smoke scan row was not created.");
  }

  if (!snapshot.attempt) {
    throw new Error("Smoke scan attempt row was not created.");
  }

  if (snapshot.scan.status !== "completed") {
    throw new Error(`Expected scan to complete, got ${snapshot.scan.status}.`);
  }

  const phaseByKind = new Map(snapshot.phases.map((phase) => [phase.phase, phase]));

  for (const phase of EXPECTED_PHASES) {
    const phaseRun = phaseByKind.get(phase);

    if (!phaseRun) {
      throw new Error(`Expected phase ${phase} to exist. Phases: ${summarizePhases(snapshot.phases)}`);
    }

    if (phase === "browser_fallback" && phaseRun.status === "skipped") {
      continue;
    }

    if (phaseRun.status !== "completed") {
      throw new Error(`Expected phase ${phase} to complete, got ${phaseRun.status}: ${phaseRun.errorMessage ?? "no error"}`);
    }
  }

  if (snapshot.resultCount < 1) {
    throw new Error("Expected at least one persisted scan result.");
  }

  if (snapshot.nucleiMatchCount < 1) {
    throw new Error("Expected at least one persisted nuclei match.");
  }

  if (snapshot.subdomainCount < 1) {
    throw new Error("Expected at least one persisted subdomain row.");
  }
}

function assertRecoveredCompletionSnapshot(snapshot: Awaited<ReturnType<typeof readScanSnapshot>>) {
  if (!snapshot.scan) {
    throw new Error("Smoke scan row was not created.");
  }

  if (!snapshot.attempt) {
    throw new Error("Smoke scan attempt row was not created.");
  }

  if (snapshot.scan.status !== "completed") {
    throw new Error(`Expected recovered scan to complete, got ${snapshot.scan.status}.`);
  }

  const phaseByKind = new Map(snapshot.phases.map((phase) => [phase.phase, phase]));

  for (const phase of EXPECTED_PHASES) {
    const phaseRun = phaseByKind.get(phase);

    if (!phaseRun) {
      throw new Error(`Expected recovered phase ${phase} to exist. Phases: ${summarizePhases(snapshot.phases)}`);
    }

    if ((phase === "browser_fallback" || phase === "ip_intel") && phaseRun.status === "skipped") {
      continue;
    }

    if (isWorkerInterruptedRecoveredPhase(phaseRun)) {
      continue;
    }

    if (phaseRun.status !== "completed") {
      throw new Error(`Expected recovered phase ${phase} to complete, got ${phaseRun.status}: ${phaseRun.errorMessage ?? "no error"}`);
    }
  }

  if (snapshot.resultCount < 1) {
    throw new Error("Expected at least one persisted scan result after recovery.");
  }

  if (snapshot.nucleiMatchCount < 1) {
    throw new Error("Expected at least one persisted nuclei match after recovery.");
  }

}

function assertPartialHandoffRecoveredSnapshot(snapshot: Awaited<ReturnType<typeof readScanSnapshot>>) {
  if (!snapshot.scan) {
    throw new Error("Partial handoff smoke scan row was not created.");
  }

  if (!snapshot.attempt) {
    throw new Error("Partial handoff smoke scan attempt row was not created.");
  }

  if (snapshot.scan.status !== "completed") {
    throw new Error(`Expected partial handoff recovery to complete the scan, got ${snapshot.scan.status}.`);
  }

  if (snapshot.attempt.status !== "completed") {
    throw new Error(`Expected partial handoff recovery to complete the attempt, got ${snapshot.attempt.status}.`);
  }

  const phaseByKind = new Map(snapshot.phases.map((phase) => [phase.phase, phase]));

  for (const phase of EXPECTED_PHASES) {
    const phaseRun = phaseByKind.get(phase);

    if (!phaseRun) {
      throw new Error(`Expected partial handoff recovery to materialize ${phase}. Phases: ${summarizePhases(snapshot.phases)}`);
    }

    if ((phase === "browser_fallback" || phase === "ip_intel") && phaseRun.status === "skipped") {
      continue;
    }

    if (phaseRun.status !== "completed") {
      throw new Error(`Expected partial handoff phase ${phase} to finish, got ${phaseRun.status}: ${phaseRun.errorMessage ?? "no error"}`);
    }
  }

  if (snapshot.resultCount < 1) {
    throw new Error("Expected at least one persisted scan result after partial handoff recovery.");
  }

  if (snapshot.subdomainCount < 1) {
    throw new Error("Expected partial handoff recovery to run subfinder.");
  }
}

async function waitForCompletion(
  scanId: string,
  workers: readonly WorkerProcess[],
  assertSnapshot: (snapshot: Awaited<ReturnType<typeof readScanSnapshot>>) => void = assertCompletedSnapshot,
) {
  const deadline = Date.now() + COMPLETION_TIMEOUT_MS;
  let lastSnapshot = await readScanSnapshot(scanId);

  while (Date.now() < deadline) {
    lastSnapshot = await readScanSnapshot(scanId);

    if (lastSnapshot.scan?.status === "completed") {
      assertSnapshot(lastSnapshot);
      return lastSnapshot;
    }

    if (lastSnapshot.scan?.status === "failed" || lastSnapshot.scan?.status === "cancelled") {
      break;
    }

    const exitedWorker = workers.find((worker) => worker.child.exitCode !== null && worker.child.exitCode !== 0);
    if (exitedWorker) {
      break;
    }

    await delay(500);
  }

  throw new Error([
    `Timed out waiting for scan ${scanId}.`,
    `Scan status: ${lastSnapshot.scan?.status ?? "missing"}`,
    `Phases: ${summarizePhases(lastSnapshot.phases) || "none"}`,
    formatWorkerLogs(workers),
  ].join("\n"));
}

function jsonIncludesString(value: unknown, expected: string) {
  return JSON.stringify(value).includes(JSON.stringify(expected));
}

function assertNoRecordedErrorCode(snapshot: Awaited<ReturnType<typeof readScanSnapshot>>, errorCode: string) {
  const scanHasErrorCode = snapshot.scan?.errorCode === errorCode;
  const attemptHasErrorCode = snapshot.attempts.some((attempt) => attempt.errorCode === errorCode);
  const phaseHasErrorCode = snapshot.phases.some((phase) => phase.errorCode === errorCode);
  const eventHasErrorCode = snapshot.events.some((event) => jsonIncludesString(event.payload, errorCode));

  if (scanHasErrorCode || attemptHasErrorCode || phaseHasErrorCode || eventHasErrorCode) {
    throw new Error(`Expected scan ${snapshot.scan?.id ?? "unknown"} to avoid false terminal code ${errorCode}.`);
  }
}

function assertNoFailedPhaseRows(
  snapshot: Awaited<ReturnType<typeof readScanSnapshot>>,
  phases: readonly string[],
  forbiddenErrorCodes: readonly string[],
  allowedErrorCodes: readonly string[] = [],
) {
  const phaseSet = new Set(phases);
  const forbiddenCodeSet = new Set(forbiddenErrorCodes);
  const allowedCodeSet = new Set(allowedErrorCodes);
  const failedRows = snapshot.phases.filter((phase) => (
    phaseSet.has(phase.phase)
    && (
      forbiddenCodeSet.has(phase.errorCode ?? "")
      || (phase.status === "failed" && !allowedCodeSet.has(phase.errorCode ?? ""))
    )
  ));

  if (failedRows.length > 0) {
    throw new Error(
      `Expected recovered scan ${snapshot.scan?.id ?? "unknown"} to avoid failed ${phases.join("/")} rows. Phases: ${summarizePhases(snapshot.phases)}`,
    );
  }
}

function assertWorkerInterruptedRecovery(snapshot: Awaited<ReturnType<typeof readScanSnapshot>>, phase: string) {
  const phaseHasRecoveryReason = snapshot.phases.some((phaseRun) => (
    phaseRun.phase === phase && jsonIncludesString(phaseRun.metaJson, "worker_interrupted")
  ));
  const eventHasRecoveryReason = snapshot.events.some((event) => (
    jsonIncludesString(event.payload, phase) && jsonIncludesString(event.payload, "worker_interrupted")
  ));

  if (!phaseHasRecoveryReason && !eventHasRecoveryReason) {
    throw new Error(`Expected ${phase} to record worker_interrupted recovery evidence.`);
  }
}

function toScenarioResult(name: string, scanId: string, snapshot: Awaited<ReturnType<typeof readScanSnapshot>>): SmokeScenarioResult {
  return {
    name,
    scanId,
    resultCount: snapshot.resultCount,
    nucleiMatchCount: snapshot.nucleiMatchCount,
    subdomainCount: snapshot.subdomainCount,
    phases: snapshot.phases,
  };
}

async function runHappyPathScenario(context: SmokeScenarioContext) {
  const workers = [
    startWorker("http", context.workerEnv),
    startWorker("intel", context.workerEnv),
    startWorker("browser", context.workerEnv),
  ];

  try {
    const scanId = await queueSmokeScan(context.fixturePort);
    const snapshot = await waitForCompletion(scanId, workers, assertCompletedSnapshot);
    return toScenarioResult("happy_path", scanId, snapshot);
  } finally {
    await stopWorkers(workers);
  }
}

async function runHttpProbeInterruptionScenario(context: SmokeScenarioContext) {
  const httpxGateFile = join(context.fakeBinDirectory, "httpx-in-flight.json");
  const workerEnv = {
    ...context.workerEnv,
    STACKRAY_SMOKE_HTTPX_HOLD_ONCE_FILE: httpxGateFile,
  };
  const httpWorker = startWorker("http", workerEnv);
  const workers = [httpWorker, startWorker("intel", workerEnv), startWorker("browser", workerEnv)];

  try {
    const scanId = await queueSmokeScan(context.fixturePort);
    await waitForFile(httpxGateFile, "fake httpx to enter its one-shot hold", workers);
    await interruptWorker(httpWorker);
    workers.push(startWorker("http", workerEnv));

    const snapshot = await waitForCompletion(scanId, workers, assertRecoveredCompletionSnapshot);
    assertWorkerInterruptedRecovery(snapshot, "http_probe");
    assertNoRecordedErrorCode(snapshot, "worker_shutdown");
    assertNoFailedPhaseRows(snapshot, ["http_probe"], ["worker_shutdown", "phase_failed"]);
    return toScenarioResult("http_probe_worker_interruption", scanId, snapshot);
  } finally {
    await stopWorkers(workers);
  }
}

async function runPartialHttpProbeHandoffRecoveryScenario(context: SmokeScenarioContext) {
  const scanId = await queuePartialCompletedHttpProbeHandoffScan(context.fixturePort);
  const workers = [
    startWorker("http", context.workerEnv),
    startWorker("intel", context.workerEnv),
    startWorker("browser", context.workerEnv),
  ];

  try {
    const snapshot = await waitForCompletion(scanId, workers, assertPartialHandoffRecoveredSnapshot);
    return toScenarioResult("http_probe_partial_handoff_recovery", scanId, snapshot);
  } finally {
    await stopWorkers(workers);
  }
}

async function runNucleiInterruptionScenario(context: SmokeScenarioContext) {
  const nucleiGateFile = join(context.fakeBinDirectory, "nuclei-in-flight.json");
  const workerEnv = {
    ...context.workerEnv,
    STACKRAY_SMOKE_NUCLEI_HOLD_ONCE_FILE: nucleiGateFile,
  };
  const intelWorker = startWorker("intel", workerEnv);
  const workers = [startWorker("http", workerEnv), intelWorker, startWorker("browser", workerEnv)];

  try {
    const scanId = await queueSmokeScan(context.fixturePort);
    await waitForFile(nucleiGateFile, "fake nuclei to enter its one-shot hold", workers);
    await interruptWorker(intelWorker);
    workers.push(startWorker("intel", workerEnv));

    const snapshot = await waitForCompletion(scanId, workers, assertRecoveredCompletionSnapshot);
    assertWorkerInterruptedRecovery(snapshot, "nuclei_dns");
    assertNoRecordedErrorCode(snapshot, "nuclei_failed");
    assertNoFailedPhaseRows(snapshot, ["nuclei_dns", "nuclei_http"], ["nuclei_failed"], ["worker_interrupted"]);
    return toScenarioResult("nuclei_worker_interruption", scanId, snapshot);
  } finally {
    await stopWorkers(workers);
  }
}

async function main() {
  const fixture = await startFixtureServer();
  const fakeBin = await createFakeScannerBin();
  const workerEnv: WorkerEnv = {
    HTTPX_BIN: fakeBin.httpx,
    SUBFINDER_BIN: fakeBin.subfinder,
    NUCLEI_BIN: fakeBin.nuclei,
    STACKRAY_SMOKE_FIXTURE_PORT: String(fixture.port),
    STACKRAY_HTTPX_TIMEOUT_MS: "20000",
    STACKRAY_SUBFINDER_TIMEOUT_MS: "5000",
    STACKRAY_SUBFINDER_SOURCE_TIMEOUT_SECONDS: "1",
    STACKRAY_SUBFINDER_MAX_TIME_MINUTES: "1",
    STACKRAY_NUCLEI_TIMEOUT_MS: "20000",
    STACKRAY_HEADLESS_ENRICHMENT_TIMEOUT_MS: "5000",
    STACKRAY_HEADLESS_TECH_DETECTION_TIMEOUT_MS: "5000",
    STACKRAY_SCREENSHOT_TIMEOUT_MS: "1000",
    STACKRAY_HEADLESS_IDLE_MS: "1",
    STACKRAY_EXTERNAL_REVERSE_IP: "false",
    STACKRAY_ALLOW_SMOKE_JOBS: "true",
    STACKRAY_GRAPHILE_JOB_FLAGS: SMOKE_JOB_FLAG,
  };

  try {
    const context = {
      fixturePort: fixture.port,
      workerEnv,
      fakeBinDirectory: fakeBin.directory,
    } satisfies SmokeScenarioContext;
    const results = [
      await runHappyPathScenario(context),
      await runHttpProbeInterruptionScenario(context),
      await runPartialHttpProbeHandoffRecoveryScenario(context),
      await runNucleiInterruptionScenario(context),
    ];

    console.info(JSON.stringify({
      event: "scan_pipeline_smoke_completed",
      scenarios: results.map((result) => ({
        name: result.name,
        scanId: result.scanId,
        resultCount: result.resultCount,
        nucleiMatchCount: result.nucleiMatchCount,
        subdomainCount: result.subdomainCount,
        phases: result.phases.map((phase) => ({ phase: phase.phase, status: phase.status })),
      })),
    }, null, 2));
  } finally {
    await fakeBin.cleanup();
    await fixture.close();
    await pool.end();
  }
}

main().catch(async (error) => {
  console.error(error);
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});
