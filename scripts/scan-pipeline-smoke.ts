import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
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

type WorkerRole = "http" | "intel" | "browser";

type WorkerProcess = {
  role: WorkerRole;
  child: ChildProcess;
  logs: string[];
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
    "import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';",
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
    "const args = process.argv.slice(2);",
    "if (args.includes('-version') || args.includes('--version')) {",
    "  console.log('fake-nuclei 0.0.0');",
    "  process.exit(0);",
    "}",
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
      idempotencyKey: `ci-smoke-${Date.now()}`,
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
        at: new Date().toISOString(),
      },
    });
    await enqueueGraphileJob(tx, "http_probe", { scanId: scan.id }, {
      jobKey: `scan:${scan.id}:http_probe`,
      jobKeyMode: "preserve_run_at",
      runAt: scan.submittedAt,
    });

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

function startWorker(role: WorkerRole, env: Record<string, string>): WorkerProcess {
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

async function stopWorkers(workers: readonly WorkerProcess[]) {
  await Promise.all(workers.map(async ({ child }) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    child.kill("SIGTERM");
    await Promise.race([
      once(child, "exit"),
      new Promise((resolve) => setTimeout(resolve, 5_000)).then(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL");
        }
      }),
    ]);
  }));
}

async function readScanSnapshot(scanId: string) {
  const [scan] = await db.select().from(scans).where(eq(scans.id, scanId)).limit(1);
  const [attempt] = await db.select().from(scanAttempts).where(eq(scanAttempts.scanId, scanId)).limit(1);
  const phases = await db
    .select()
    .from(scanPhaseRuns)
    .where(eq(scanPhaseRuns.scanId, scanId))
    .orderBy(asc(scanPhaseRuns.queuedAt), asc(scanPhaseRuns.phase));
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
    attempt,
    phases,
    resultCount: resultCount?.value ?? 0,
    nucleiMatchCount: nucleiMatchCount?.value ?? 0,
    subdomainCount: subdomainCount?.value ?? 0,
  };
}

function summarizePhases(phases: Awaited<ReturnType<typeof readScanSnapshot>>["phases"]) {
  return phases.map((phase) => `${phase.phase}:${phase.status}`).join(", ");
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

async function waitForCompletion(scanId: string, workers: readonly WorkerProcess[]) {
  const deadline = Date.now() + 90_000;
  let lastSnapshot = await readScanSnapshot(scanId);

  while (Date.now() < deadline) {
    lastSnapshot = await readScanSnapshot(scanId);

    if (lastSnapshot.scan?.status === "completed") {
      assertCompletedSnapshot(lastSnapshot);
      return lastSnapshot;
    }

    if (lastSnapshot.scan?.status === "failed" || lastSnapshot.scan?.status === "cancelled") {
      break;
    }

    const exitedWorker = workers.find((worker) => worker.child.exitCode !== null && worker.child.exitCode !== 0);
    if (exitedWorker) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const workerLogs = workers
    .map((worker) => `--- worker:${worker.role} ---\n${worker.logs.join("").trim()}`)
    .join("\n");
  throw new Error([
    `Timed out waiting for scan ${scanId}.`,
    `Scan status: ${lastSnapshot.scan?.status ?? "missing"}`,
    `Phases: ${summarizePhases(lastSnapshot.phases) || "none"}`,
    workerLogs,
  ].join("\n"));
}

async function main() {
  const fixture = await startFixtureServer();
  const fakeBin = await createFakeScannerBin();
  const workerEnv = {
    HTTPX_BIN: fakeBin.httpx,
    SUBFINDER_BIN: fakeBin.subfinder,
    NUCLEI_BIN: fakeBin.nuclei,
    STACKRAY_SMOKE_FIXTURE_PORT: String(fixture.port),
    STACKRAY_HTTPX_TIMEOUT_MS: "5000",
    STACKRAY_SUBFINDER_TIMEOUT_MS: "5000",
    STACKRAY_SUBFINDER_SOURCE_TIMEOUT_SECONDS: "1",
    STACKRAY_SUBFINDER_MAX_TIME_MINUTES: "1",
    STACKRAY_NUCLEI_TIMEOUT_MS: "5000",
    STACKRAY_HEADLESS_ENRICHMENT_TIMEOUT_MS: "5000",
    STACKRAY_HEADLESS_TECH_DETECTION_TIMEOUT_MS: "5000",
    STACKRAY_SCREENSHOT_TIMEOUT_MS: "1000",
    STACKRAY_HEADLESS_IDLE_MS: "1",
    STACKRAY_EXTERNAL_REVERSE_IP: "false",
  };
  const workers: WorkerProcess[] = [];

  try {
    const scanId = await queueSmokeScan(fixture.port);
    workers.push(
      startWorker("http", workerEnv),
      startWorker("intel", workerEnv),
      startWorker("browser", workerEnv),
    );
    const snapshot = await waitForCompletion(scanId, workers);

    console.info(JSON.stringify({
      event: "scan_pipeline_smoke_completed",
      scanId,
      resultCount: snapshot.resultCount,
      nucleiMatchCount: snapshot.nucleiMatchCount,
      subdomainCount: snapshot.subdomainCount,
      phases: snapshot.phases.map((phase) => ({ phase: phase.phase, status: phase.status })),
    }, null, 2));
  } finally {
    await stopWorkers(workers);
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
