import { spawn } from "node:child_process";
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

function buildHttpxArguments(scan: ScanRow): string[] {
  const args = [
    "-silent",
    "-json",
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

  return args;
}

function resolveTargetForPayload(payload: HttpxJson, targets: readonly ScanTargetRow[]) {
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

  return targets.length === 1 ? targets[0]! : null;
}

async function emitEvent(scanId: string, attemptId: string | null, eventType: typeof scanEvents.$inferInsert.eventType, payload: Record<string, unknown>) {
  await db.insert(scanEvents).values({
    scanId,
    attemptId,
    eventType,
    payload,
  });
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
    throw new Error("Unable to associate the httpx result with a scan target.");
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
      bodyDomains: asStringArray(payload.body_domains),
      bodyFqdns: asStringArray(payload.body_fqdns),
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
        technologies,
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

  await emitEvent(claimedScan.scan.id, claimedScan.attempt.id, "scan.result", {
    scanId: claimedScan.scan.id,
    resultId: result.id,
    target: scanTarget.normalizedTarget,
    statusCode: result.statusCode ?? 0,
    finalUrl: result.finalUrl ?? result.url ?? scanTarget.normalizedTarget,
    title: result.title ?? "",
    server: result.webServer ?? null,
    cdn: {
      enabled: Boolean(result.cdn || result.cdnName || result.cdnType),
      name: result.cdnName ?? null,
      type: result.cdnType ?? null,
    },
    technologies,
    at: new Date().toISOString(),
  });

  await emitEvent(claimedScan.scan.id, claimedScan.attempt.id, "scan.progress", {
    scanId: claimedScan.scan.id,
    processedTargets: seenTargetIds.size,
    totalTargets: claimedScan.targets.length,
    resultCount: seenTargetIds.size,
    at: new Date().toISOString(),
  });
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

async function runClaimedScan(claimedScan: ClaimedScan) {
  const seenTargetIds = new Set<string>();
  const httpx = spawn(process.env.HTTPX_BIN ?? "httpx", buildHttpxArguments(claimedScan.scan), {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stdout = createInterface({ input: httpx.stdout });
  const stderrChunks: string[] = [];

  httpx.stderr.on("data", (chunk) => {
    stderrChunks.push(chunk.toString());
  });

  for (const target of claimedScan.targets) {
    httpx.stdin.write(`${target.normalizedTarget}\n`);
  }
  httpx.stdin.end();

  try {
    for await (const line of stdout) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      const payload = JSON.parse(trimmed) as HttpxJson;
      await persistHttpxResult(claimedScan, payload, seenTargetIds);
    }

    const exitCode = await new Promise<number>((resolve, reject) => {
      httpx.on("error", reject);
      httpx.on("close", (code) => {
        resolve(code ?? 0);
      });
    });

    if (exitCode !== 0) {
      const stderr = stderrChunks.join(" ").trim() || `httpx exited with code ${exitCode}`;
      await markAttemptFailed(claimedScan, `httpx_exit_${exitCode}`, stderr);
      return;
    }

    await markAttemptCompleted(claimedScan);
  } catch (error) {
    httpx.kill();
    await markAttemptFailed(
      claimedScan,
      "worker_exception",
      error instanceof Error ? error.message : "Worker execution failed.",
    );
  }
}

export async function runWorkerLoop({ once = false, pollIntervalMs = 1000 }: { once?: boolean; pollIntervalMs?: number } = {}) {
  let stopped = false;

  const stop = () => {
    stopped = true;
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

    await runClaimedScan(claimedScan);

    if (once) {
      break;
    }
  }
}
