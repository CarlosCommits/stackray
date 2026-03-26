import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { createInterface } from "node:readline";

import { and, desc, eq, sql } from "drizzle-orm";

import {
  scanAttempts,
  scanEvents,
  scanResultCpes,
  scanResultTechnologies,
  scanResultWordpressPlugins,
  scanResultWordpressThemes,
  scanResults,
  scanTargets,
  scans,
} from "../drizzle/schema.ts";
import { db } from "./db.ts";
import { env } from "../lib/env/server.ts";
import { buildScreenshotObjectKey, screenshotStorageEnabled, uploadScreenshotObject } from "../lib/server/storage/screenshots.ts";
import { buildEnrichedTechnologies, promoteTechnologiesFromCpe } from "../lib/server/scans/technology-enrichment.ts";
import { normalizeTargets } from "../lib/server/scans/normalize-targets.ts";

type ScanRow = typeof scans.$inferSelect;
type ScanTargetRow = typeof scanTargets.$inferSelect;
type AttemptRow = typeof scanAttempts.$inferSelect;

type ClaimedScan = {
  scan: ScanRow;
  attempt: AttemptRow;
  targets: ScanTargetRow[];
};

type HttpxJson = Record<string, unknown>;

type HttpxProcess = {
  stdin: Pick<NodeJS.WritableStream, "write" | "end">;
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  kill(signal?: NodeJS.Signals | number): boolean;
  on(event: "error", listener: (error: Error) => void): HttpxProcess;
  on(event: "close", listener: (code: number | null) => void): HttpxProcess;
  killed?: boolean;
};

type HttpxSpawn = (
  command: string,
  args: readonly string[],
  options: { stdio: ["pipe", "pipe", "pipe"] },
) => HttpxProcess;

type RunHttpxCliResult = {
  status: "completed" | "failed" | "cancelled" | "timed_out" | "aborted";
  exitCode: number;
  stderr: string;
};

type RunHttpxCliOptions = {
  command: string;
  args: readonly string[];
  targets: readonly string[];
  timeoutMs: number;
  onJsonLine: (payload: HttpxJson) => Promise<void> | void;
  allowNonJsonStdout?: boolean;
  shouldCancel?: () => boolean | Promise<boolean>;
  cancellationPollIntervalMs?: number;
  signal?: AbortSignal;
  spawnProcess?: HttpxSpawn;
};

type HttpxBehaviorOptions = {
  browserLikeHeaders: boolean;
  tlsImpersonate: boolean;
};

const DEFAULT_SCAN_TIMEOUT_MS = env.STACKRAY_HTTPX_TIMEOUT_MS ?? 15 * 60 * 1000;
const DEFAULT_SCREENSHOT_TIMEOUT_MS = env.STACKRAY_SCREENSHOT_TIMEOUT_MS ?? 15 * 1000;
const DEFAULT_CANCELLATION_POLL_INTERVAL_MS = 500;
const PROCESS_KILL_GRACE_PERIOD_MS = 1_000;
const DEFAULT_HTTPX_BEHAVIOR_OPTIONS: HttpxBehaviorOptions = {
  browserLikeHeaders: env.STACKRAY_HTTPX_BROWSER_HEADERS === "true",
  tlsImpersonate: env.STACKRAY_HTTPX_TLS_IMPERSONATE === "true",
};
const BROWSER_LIKE_HEADERS = [
  "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language: en-US,en;q=0.9",
  "Accept-Encoding: gzip, deflate, br",
  "Upgrade-Insecure-Requests: 1",
];

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
    : [];
}

function parseResponseTimeMs(payload: HttpxJson): number | null {
  const explicit = asNumber(payload.response_time_ms);

  if (explicit !== null) {
    return explicit;
  }

  const timeString = asString(payload.time);

  if (!timeString) {
    return null;
  }

  const match = timeString.match(/([\d.]+)ms/i);

  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(match[1]!);

  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function toObject(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function buildSearchDocument(payload: {
  input: string | null;
  finalUrl: string | null;
  title: string | null;
  server: string | null;
  technologies: string[];
  plugins: string[];
  themes: string[];
  cpes: string[];
}) {
  return [
    payload.input,
    payload.finalUrl,
    payload.title,
    payload.server,
    ...payload.technologies,
    ...payload.plugins,
    ...payload.themes,
    ...payload.cpes,
  ]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ");
}

function extractCpeEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{ cpe: string; vendor: string | null; product: string | null }>;
  }

  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      return [{ cpe: entry, vendor: null, product: null }];
    }

    if (isObject(entry) && typeof entry.cpe === "string") {
      return [
        {
          cpe: entry.cpe,
          vendor: typeof entry.vendor === "string" ? entry.vendor : null,
          product: typeof entry.product === "string" ? entry.product : null,
        },
      ];
    }

    return [];
  });
}

export function buildHttpxArguments(
  scan: ScanRow,
  behaviorOptions: HttpxBehaviorOptions = DEFAULT_HTTPX_BEHAVIOR_OPTIONS,
): string[] {
  const args = [
    "-silent",
    "-json",
    "-stream",
    "-td",
    "-title",
    "-sc",
    "-cl",
    "-ct",
    "-rt",
    "-location",
    "-server",
    "-wp",
    "-cpe",
    "-favicon",
    "-jarm",
    "-cdn",
    "-ip",
    "-cname",
    "-asn",
    "-tls-grab",
    "-csp-probe",
    "-hash",
    "md5,mmh3,sha256",
    "-extract-fqdn",
    "-include-chain",
  ];
  const options = toObject(scan.optionsJson);

  if (options.followRedirects !== false) {
    args.push("-fr");
  }

  if (options.includeRawResponse === true) {
    args.push("-sr");
  }

  if (behaviorOptions.browserLikeHeaders) {
    for (const header of BROWSER_LIKE_HEADERS) {
      args.push("-H", header);
    }
  }

  if (behaviorOptions.tlsImpersonate) {
    args.push("-tlsi");
  }

  return args;
}

export function buildHttpxScreenshotArguments({ storeDir }: { storeDir: string }) {
  return [
    "-silent",
    "-json",
    "-screenshot",
    "-fr",
    "-esb",
    "-ehb",
    "-no-screenshot-full-page",
    "-st",
    String(Math.ceil(DEFAULT_SCREENSHOT_TIMEOUT_MS / 1000)),
    "-srd",
    storeDir,
  ];
}

function shouldCaptureHomepageScreenshot(result: { statusCode: number | null; contentType: string | null; finalUrl: string | null; path: string | null }) {
  const statusCode = result.statusCode ?? 0;
  const contentType = result.contentType?.toLowerCase() ?? "";

  if (!result.finalUrl) {
    return false;
  }

  if (statusCode < 200 || statusCode >= 400) {
    return false;
  }

  return contentType.includes("text/html") || contentType.includes("application/xhtml+xml") || contentType.length === 0;
}

async function captureAndStoreScreenshot(result: typeof scanResults.$inferSelect, target: ScanTargetRow, signal?: AbortSignal) {
  if (!screenshotStorageEnabled()) {
    return null;
  }

  if (!shouldCaptureHomepageScreenshot(result)) {
    return null;
  }

  const workingDirectory = await mkdtemp(join(tmpdir(), "stackray-httpx-screenshot-"));

  try {
    let screenshotPath: string | null = null;

    const screenshotRun = await runHttpxCli({
      command: env.HTTPX_BIN ?? "httpx",
      args: buildHttpxScreenshotArguments({ storeDir: workingDirectory }),
      targets: [target.normalizedTarget],
      timeoutMs: DEFAULT_SCREENSHOT_TIMEOUT_MS,
      allowNonJsonStdout: true,
      signal,
      onJsonLine: async (payload) => {
        screenshotPath = asString(payload.screenshot_path) ?? asString(payload.screenshot_path_rel);
      },
    });

    if (screenshotRun.status !== "completed" || !screenshotPath) {
      return null;
    }

    const resolvedScreenshotPath = isAbsolute(screenshotPath) ? screenshotPath : join(workingDirectory, screenshotPath);

    const objectKey = buildScreenshotObjectKey(result.scanId, result.id);
    const upload = await uploadScreenshotObject(resolvedScreenshotPath, objectKey);

    const [updatedResult] = await db
      .update(scanResults)
      .set({
        screenshotObjectKey: objectKey,
        screenshotContentType: upload.contentType,
        screenshotByteSize: upload.byteSize,
        screenshotCapturedAt: new Date(),
      })
      .where(eq(scanResults.id, result.id))
      .returning();

    return updatedResult ?? null;
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

export async function runHttpxCli({
  command,
  args,
  targets,
  timeoutMs,
  onJsonLine,
  allowNonJsonStdout = false,
  shouldCancel,
  cancellationPollIntervalMs = DEFAULT_CANCELLATION_POLL_INTERVAL_MS,
  signal,
  spawnProcess = spawn,
}: RunHttpxCliOptions): Promise<RunHttpxCliResult> {
  const httpx = spawnProcess(command, args, {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stdout = createInterface({ input: httpx.stdout });
  const stderrChunks: string[] = [];
  const nonJsonStdoutChunks: string[] = [];

  let terminationReason: RunHttpxCliResult["status"] | null = null;
  let cancellationCheckInFlight = false;

  const closePromise = new Promise<number>((resolve, reject) => {
    httpx.on("error", reject);
    httpx.on("close", (code) => {
      resolve(code ?? 0);
    });
  });

  const terminateProcess = (reason: Exclude<RunHttpxCliResult["status"], "completed" | "failed">) => {
    if (terminationReason) {
      return;
    }

    terminationReason = reason;

    if (!httpx.killed) {
      httpx.kill("SIGTERM");
      setTimeout(() => {
        if (!httpx.killed) {
          httpx.kill("SIGKILL");
        }
      }, PROCESS_KILL_GRACE_PERIOD_MS).unref();
    }
  };

  const abortListener = () => {
    terminateProcess("aborted");
  };

  if (signal?.aborted) {
    terminateProcess("aborted");
  } else {
    signal?.addEventListener("abort", abortListener, { once: true });
  }

  const timeoutTimer = setTimeout(() => {
    terminateProcess("timed_out");
  }, timeoutMs);
  timeoutTimer.unref();

  const cancellationTimer = shouldCancel
    ? setInterval(async () => {
        if (terminationReason || cancellationCheckInFlight) {
          return;
        }

        cancellationCheckInFlight = true;

        try {
          if (await shouldCancel()) {
            terminateProcess("cancelled");
          }
        } finally {
          cancellationCheckInFlight = false;
        }
      }, cancellationPollIntervalMs)
    : null;

  cancellationTimer?.unref();

  httpx.stderr.on("data", (chunk) => {
    stderrChunks.push(chunk.toString());
  });

  for (const target of targets) {
    httpx.stdin.write(`${target}\n`);
  }
  httpx.stdin.end();

  try {
    for await (const line of stdout) {
      if (terminationReason) {
        continue;
      }

      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      try {
        const payload = JSON.parse(trimmed) as HttpxJson;
        await onJsonLine(payload);
      } catch (error) {
        if (!allowNonJsonStdout || !(error instanceof SyntaxError)) {
          throw error;
        }

        nonJsonStdoutChunks.push(trimmed);
      }
    }

    const exitCode = await closePromise;
    const stderr = stderrChunks.join(" ").trim();
    const stdoutNoise = nonJsonStdoutChunks.join(" ").trim();

    if (terminationReason) {
      return {
        status: terminationReason,
        exitCode,
        stderr,
      };
    }

    if (exitCode !== 0) {
      return {
        status: "failed",
        exitCode,
        stderr: stderr || stdoutNoise || `httpx exited with code ${exitCode}`,
      };
    }

    return {
      status: "completed",
      exitCode,
      stderr,
    };
  } finally {
    clearTimeout(timeoutTimer);
    if (cancellationTimer) {
      clearInterval(cancellationTimer);
    }
    stdout.close();
    signal?.removeEventListener("abort", abortListener);
  }
}

export function resolveTargetForPayload(payload: HttpxJson, targets: readonly ScanTargetRow[]) {
  const candidates = [asString(payload.input), asString(payload.url), asString(payload.final_url)].filter(
    (value): value is string => Boolean(value),
  );

  for (const candidate of candidates) {
    try {
      const normalized = normalizeTargets([candidate])[0]?.normalizedTarget;

      if (!normalized) {
        continue;
      }

      const matchedTarget = targets.find((target) => target.normalizedTarget === normalized);

      if (matchedTarget) {
        return matchedTarget;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function emitEvent(scanId: string, attemptId: string | null, eventType: typeof scanEvents.$inferInsert.eventType, payload: Record<string, unknown>) {
  await db.insert(scanEvents).values({
    scanId,
    attemptId,
    eventType,
    payload,
  });
}

async function isCancellationRequested(scanId: string) {
  const [scan] = await db
    .select({ cancellationRequestedAt: scans.cancellationRequestedAt })
    .from(scans)
    .where(eq(scans.id, scanId))
    .limit(1);

  return scan?.cancellationRequestedAt !== null;
}

async function claimNextQueuedScan(): Promise<ClaimedScan | null> {
  const [queuedScan] = await db
    .select()
    .from(scans)
    .where(eq(scans.status, "queued"))
    .orderBy(desc(scans.submittedAt))
    .limit(1);

  if (!queuedScan) {
    return null;
  }

  return db.transaction(async (tx) => {
    const [claimedScan] = await tx
      .update(scans)
      .set({
        status: "running",
        startedAt: queuedScan.startedAt ?? new Date(),
      })
      .where(and(eq(scans.id, queuedScan.id), eq(scans.status, "queued")))
      .returning();

    if (!claimedScan) {
      return null;
    }

    const [attemptCount] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(scanAttempts)
      .where(eq(scanAttempts.scanId, claimedScan.id));

    const [attempt] = await tx
      .insert(scanAttempts)
      .values({
        scanId: claimedScan.id,
        attemptNumber: (attemptCount?.value ?? 0) + 1,
        workerId: `local-worker:${process.pid}`,
        status: "running",
        startedAt: new Date(),
      })
      .returning();

    await tx.insert(scanEvents).values({
      scanId: claimedScan.id,
      attemptId: attempt.id,
      eventType: "scan.status",
      payload: {
        scanId: claimedScan.id,
        status: "running",
        attemptId: attempt.id,
        at: new Date().toISOString(),
      },
    });

    const targets = await tx
      .select()
      .from(scanTargets)
      .where(eq(scanTargets.scanId, claimedScan.id));

    return {
      scan: claimedScan,
      attempt,
      targets: [...targets].sort((left, right) => left.sortOrder - right.sortOrder),
    } satisfies ClaimedScan;
  });
}

async function persistHttpxResult(claimedScan: ClaimedScan, payload: HttpxJson, seenTargetIds: Set<string>) {
  const scanTarget = resolveTargetForPayload(payload, claimedScan.targets);

  if (!scanTarget) {
    return false;
  }

  seenTargetIds.add(scanTarget.id);

  const technologies = asStringArray(payload.tech);
  const wordpress = toObject(payload.wordpress);
  const plugins = asStringArray(wordpress.plugins);
  const themes = asStringArray(wordpress.themes);
  const cpeEntries = extractCpeEntries(payload.cpe);
  const responseHeaders = toObject(payload.header);
  const asn = toObject(payload.asn);
  const tls = toObject(payload.tls);
  const csp = toObject(payload.csp);
  const hashes = toObject(payload.hash);
  const bodyDomains = asStringArray(payload.body_domains);
  const bodyFqdns = asStringArray(payload.body_fqdns);
  const promotedCpeTechnologies = promoteTechnologiesFromCpe(cpeEntries);
  const visibleTechnologies = buildEnrichedTechnologies({
    persistedTechnologies: technologies,
    cpeEntries,
    cspJson: csp,
    bodyDomains,
    bodyFqdns,
  });
  const chain = Array.isArray(payload.chain)
    ? payload.chain.filter((entry): entry is Record<string, unknown> => isObject(entry))
    : [];

  const [result] = await db
    .insert(scanResults)
    .values({
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      scanTargetId: scanTarget.id,
      observedAt: new Date(),
      url: asString(payload.url),
      finalUrl: asString(payload.final_url) ?? asString(payload.url),
      input: asString(payload.input),
      host: asString(payload.host),
      scheme: asString(payload.scheme),
      port: asString(payload.port),
      path: asString(payload.path),
      method: asString(payload.method),
      hostIp: asString(payload.host_ip),
      statusCode: asNumber(payload.status_code),
      title: asString(payload.title),
      webServer: asString(payload.webserver),
      location: asString(payload.location),
      contentType: asString(payload.content_type),
      contentLength: asNumber(payload.content_length),
      responseTimeMs: parseResponseTimeMs(payload),
      words: asNumber(payload.words),
      lines: asNumber(payload.lines),
      cdn: asBoolean(payload.cdn) || asString(payload.cdn_name) !== null,
      cdnName: asString(payload.cdn_name),
      cdnType: asString(payload.cdn_type),
      faviconMmh3: asString(payload.favicon_mmh3),
      faviconMd5: asString(payload.favicon_md5),
      faviconUrl: asString(payload.favicon),
      faviconPath: asString(payload.favicon_path),
      sni: asString(tls.sni),
      jarmHash: asString(payload.jarm_hash) ?? asString(payload.jarm),
      bodyPreview: asString(payload.body_preview),
      rawHeaders: asString(payload.raw_header),
      responseHeadersJson: responseHeaders,
      dnsARecords: asStringArray(payload.a),
      dnsAaaaRecords: asStringArray(payload.aaaa),
      dnsCnameRecords: asStringArray(payload.cname),
      dnsResolvers: asStringArray(payload.resolvers),
      asnJson: asn,
      tlsJson: tls,
      cspJson: csp,
      hashesJson: hashes,
      bodyDomains,
      bodyFqdns,
      redirectChainStatusCodes: asNumberArray(payload.chain_status_codes),
      redirectChainJson: chain,
      http2: asBoolean(payload.http2),
      pipeline: asBoolean(payload.pipeline),
      websocket: asBoolean(payload.websocket),
      vhost: asBoolean(payload.vhost),
      storedResponsePath: asString(payload.stored_response_path),
      failed: asBoolean(payload.failed),
      rawJson: payload,
      searchDocument: buildSearchDocument({
        input: asString(payload.input),
        finalUrl: asString(payload.final_url) ?? asString(payload.url),
        title: asString(payload.title),
        server: asString(payload.webserver),
        technologies: visibleTechnologies,
        plugins,
        themes,
        cpes: cpeEntries.map((entry) => entry.cpe),
      }),
    })
    .returning();

  if (technologies.length > 0) {
    await db.insert(scanResultTechnologies).values(
      technologies.map((technologyName) => ({
        resultId: result.id,
        technologyName,
        source: "wappalyzer" as const,
      })),
    );
  }

  const cpeTechnologiesToPersist = promotedCpeTechnologies.filter((technologyName) => {
    return !technologies.some((existingTechnology) => existingTechnology.toLowerCase() === technologyName.toLowerCase());
  });

  if (cpeTechnologiesToPersist.length > 0) {
    await db.insert(scanResultTechnologies).values(
      cpeTechnologiesToPersist.map((technologyName) => ({
        resultId: result.id,
        technologyName,
        source: "cpe" as const,
      })),
    );
  }

  if (plugins.length > 0) {
    await db.insert(scanResultWordpressPlugins).values(
      plugins.map((pluginName) => ({
        resultId: result.id,
        pluginName,
      })),
    );
  }

  if (themes.length > 0) {
    await db.insert(scanResultWordpressThemes).values(
      themes.map((themeName) => ({
        resultId: result.id,
        themeName,
      })),
    );
  }

  if (cpeEntries.length > 0) {
    await db.insert(scanResultCpes).values(
      cpeEntries.map((entry) => ({
        resultId: result.id,
        cpe: entry.cpe,
        vendor: entry.vendor,
        product: entry.product,
      })),
    );
  }

  let resultWithScreenshot = result;

  try {
    resultWithScreenshot = (await captureAndStoreScreenshot(result, scanTarget)) ?? result;
  } catch (error) {
    console.warn("Screenshot capture failed", {
      scanId: claimedScan.scan.id,
      resultId: result.id,
      message: error instanceof Error ? error.message : "Unknown screenshot error",
    });
  }

  await emitEvent(claimedScan.scan.id, claimedScan.attempt.id, "scan.result", {
    scanId: claimedScan.scan.id,
    resultId: resultWithScreenshot.id,
    target: scanTarget.normalizedTarget,
    statusCode: resultWithScreenshot.statusCode ?? 0,
    finalUrl: resultWithScreenshot.finalUrl ?? resultWithScreenshot.url ?? scanTarget.normalizedTarget,
    title: resultWithScreenshot.title ?? "",
    server: resultWithScreenshot.webServer ?? null,
    cdn: {
      enabled: Boolean(resultWithScreenshot.cdn || resultWithScreenshot.cdnName || resultWithScreenshot.cdnType),
      name: resultWithScreenshot.cdnName ?? null,
      type: resultWithScreenshot.cdnType ?? null,
    },
    technologies: visibleTechnologies,
    screenshotAvailable: Boolean(resultWithScreenshot.screenshotObjectKey),
    at: new Date().toISOString(),
  });

  await emitEvent(claimedScan.scan.id, claimedScan.attempt.id, "scan.progress", {
    scanId: claimedScan.scan.id,
    processedTargets: seenTargetIds.size,
    totalTargets: claimedScan.targets.length,
    resultCount: seenTargetIds.size,
    at: new Date().toISOString(),
  });

  return true;
}

async function markAttemptFailed(claimedScan: ClaimedScan, errorCode: string, message: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(scanAttempts)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorCode,
        errorMessage: message,
      })
      .where(eq(scanAttempts.id, claimedScan.attempt.id));

    await tx
      .update(scans)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorCode,
        errorMessage: message,
      })
      .where(eq(scans.id, claimedScan.scan.id));

    await tx.insert(scanEvents).values({
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      eventType: "scan.failed",
      payload: {
        scanId: claimedScan.scan.id,
        status: "failed",
        errorCode,
        message,
        at: new Date().toISOString(),
      },
    });
  });
}

async function markAttemptCancelled(claimedScan: ClaimedScan) {
  await db.transaction(async (tx) => {
    await tx
      .update(scanAttempts)
      .set({
        status: "cancelled",
        completedAt: new Date(),
      })
      .where(eq(scanAttempts.id, claimedScan.attempt.id));

    await tx
      .update(scans)
      .set({
        status: "cancelled",
        completedAt: new Date(),
      })
      .where(eq(scans.id, claimedScan.scan.id));

    await tx.insert(scanEvents).values({
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      eventType: "scan.cancelled",
      payload: {
        scanId: claimedScan.scan.id,
        status: "cancelled",
        at: new Date().toISOString(),
      },
    });
  });
}

async function markAttemptCompleted(claimedScan: ClaimedScan) {
  const [resultCount] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(scanResults)
    .where(eq(scanResults.attemptId, claimedScan.attempt.id));

  await db.transaction(async (tx) => {
    await tx
      .update(scanAttempts)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(scanAttempts.id, claimedScan.attempt.id));

    await tx
      .update(scans)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(scans.id, claimedScan.scan.id));

    await tx.insert(scanEvents).values({
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      eventType: "scan.complete",
      payload: {
        scanId: claimedScan.scan.id,
        status: "completed",
        resultCount: resultCount?.value ?? 0,
        at: new Date().toISOString(),
      },
    });
  });
}

async function runClaimedScan(claimedScan: ClaimedScan, signal?: AbortSignal) {
  const seenTargetIds = new Set<string>();

  try {
    const result = await runHttpxCli({
      command: env.HTTPX_BIN ?? "httpx",
      args: buildHttpxArguments(claimedScan.scan),
      targets: claimedScan.targets.map((target) => target.normalizedTarget),
      timeoutMs: DEFAULT_SCAN_TIMEOUT_MS,
      signal,
      shouldCancel: async () => isCancellationRequested(claimedScan.scan.id),
      onJsonLine: async (payload) => {
        await persistHttpxResult(claimedScan, payload, seenTargetIds);
      },
    });

    if (result.status === "cancelled") {
      await markAttemptCancelled(claimedScan);
      return;
    }

    if (result.status === "timed_out") {
      await markAttemptFailed(claimedScan, "worker_timeout", "httpx scan timed out.");
      return;
    }

    if (result.status === "aborted") {
      await markAttemptFailed(claimedScan, "worker_shutdown", "Worker shutdown interrupted the scan.");
      return;
    }

    if (result.status === "failed") {
      await markAttemptFailed(claimedScan, `httpx_exit_${result.exitCode}`, result.stderr);
      return;
    }

    await markAttemptCompleted(claimedScan);
  } catch (error) {
    await markAttemptFailed(
      claimedScan,
      "worker_exception",
      error instanceof Error ? error.message : "Worker execution failed.",
    );
  }
}

export async function runWorkerLoop({ once = false, pollIntervalMs = 1000 }: { once?: boolean; pollIntervalMs?: number } = {}) {
  let stopped = false;
  const abortController = new AbortController();

  const stop = () => {
    if (stopped) {
      return;
    }

    stopped = true;
    abortController.abort();
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopped) {
    const claimedScan = await claimNextQueuedScan();

    if (!claimedScan) {
      if (once) {
        break;
      }

      await sleep(pollIntervalMs);
      continue;
    }

    await runClaimedScan(claimedScan, abortController.signal);

    if (once) {
      break;
    }
  }
}
