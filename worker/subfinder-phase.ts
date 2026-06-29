import { eq, sql } from "drizzle-orm";
import { getDomain } from "tldts";

import {
  scanEvents,
  scanResults,
  scanSubdomainDiscoveryRuns,
  scanSubdomains,
} from "../drizzle/schema.ts";
import { env } from "../lib/env/server.ts";
import { getExecutionTarget } from "../lib/server/scans/normalize-targets.ts";
import { db } from "./db.ts";
import {
  buildSubfinderArguments,
  parseSubfinderJsonLine,
  runSubfinderCli,
} from "./subfinder.ts";
import type { ClaimedScan } from "./scan-claims.ts";

type SubdomainDiscoveryRunStatus = typeof scanSubdomainDiscoveryRuns.$inferInsert.status;

const DEFAULT_SUBFINDER_SOURCE_TIMEOUT_SECONDS = env.STACKRAY_SUBFINDER_SOURCE_TIMEOUT_SECONDS ?? 60;
const DEFAULT_SUBFINDER_MAX_TIME_MINUTES = env.STACKRAY_SUBFINDER_MAX_TIME_MINUTES
  ?? (env.STACKRAY_SUBFINDER_TIMEOUT_MS ? Math.max(1, Math.floor(env.STACKRAY_SUBFINDER_TIMEOUT_MS / 60_000)) : 5);
const DEFAULT_SUBFINDER_PROCESS_TIMEOUT_MS =
  env.STACKRAY_SUBFINDER_TIMEOUT_MS ?? (DEFAULT_SUBFINDER_MAX_TIME_MINUTES * 60_000) + 10_000;

function logWorkerEvent(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      component: "httpx-worker",
      event,
      ...payload,
    }),
  );
}

function getRegistrableDomain(target: string | null) {
  if (!target) {
    return null;
  }

  const domain = getDomain(getExecutionTarget(target));
  return domain ? domain.toLowerCase() : null;
}

async function createSubdomainDiscoveryRun(
  claimedScan: ClaimedScan,
  status: SubdomainDiscoveryRunStatus,
  targetDomain: string | null,
  errorMessage: string | null = null,
) {
  const [run] = await db
    .insert(scanSubdomainDiscoveryRuns)
    .values({
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      status,
      targetDomain,
      errorMessage,
      startedAt: status === "skipped" ? null : new Date(),
      completedAt: status === "skipped" ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: scanSubdomainDiscoveryRuns.attemptId,
      set: {
        status,
        targetDomain,
        errorMessage,
        resultCount: 0,
        startedAt: status === "skipped" ? null : new Date(),
        completedAt: status === "skipped" ? new Date() : null,
      },
    })
    .returning();

  await db
    .delete(scanSubdomains)
    .where(eq(scanSubdomains.runId, run.id));

  return run;
}

async function completeSubdomainDiscoveryRun(
  runId: string,
  status: SubdomainDiscoveryRunStatus,
  resultCount: number,
  errorMessage: string | null = null,
) {
  await db
    .update(scanSubdomainDiscoveryRuns)
    .set({
      status,
      resultCount,
      errorMessage,
      completedAt: new Date(),
    })
    .where(eq(scanSubdomainDiscoveryRuns.id, runId));
}

async function emitSubdomainProgress(claimedScan: ClaimedScan, subdomainCount: number) {
  const resultCount = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(scanResults)
    .where(eq(scanResults.attemptId, claimedScan.attempt.id));

  await db.insert(scanEvents).values({
    scanId: claimedScan.scan.id,
    attemptId: claimedScan.attempt.id,
    eventType: "scan.progress",
    payload: {
      scanId: claimedScan.scan.id,
      resultCount: resultCount[0]?.value ?? 0,
      subdomainCount,
      at: new Date().toISOString(),
    },
  });
}

export async function enrichAttemptWithSubfinder(
  claimedScan: ClaimedScan,
  options: {
    signal?: AbortSignal;
    isCancellationRequested: (scanId: string) => Promise<boolean>;
  },
): Promise<
  | { status: "completed" }
  | { status: "cancelled" }
  | { status: "aborted" }
  | { status: "failed"; errorMessage: string }
> {
  const targetDomain = getRegistrableDomain(claimedScan.target.normalizedTarget);

  if (!targetDomain) {
    await createSubdomainDiscoveryRun(claimedScan, "skipped", null, "Scan target does not have a registrable domain.");
    logWorkerEvent("subfinder_discovery_skipped", {
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      target: claimedScan.target.normalizedTarget,
      reason: "no_registrable_domain",
    });
    return { status: "completed" };
  }

  const run = await createSubdomainDiscoveryRun(claimedScan, "running", targetDomain);
  const seen = new Set<string>();
  let resultCount = 0;

  logWorkerEvent("subfinder_discovery_started", {
    scanId: claimedScan.scan.id,
    attemptId: claimedScan.attempt.id,
    targetDomain,
  });

  const result = await runSubfinderCli({
    command: env.SUBFINDER_BIN ?? "subfinder",
    args: buildSubfinderArguments(targetDomain, {
      sourceTimeoutSeconds: DEFAULT_SUBFINDER_SOURCE_TIMEOUT_SECONDS,
      maxTimeMinutes: DEFAULT_SUBFINDER_MAX_TIME_MINUTES,
    }),
    timeoutMs: DEFAULT_SUBFINDER_PROCESS_TIMEOUT_MS,
    signal: options.signal,
    shouldCancel: async () => options.isCancellationRequested(claimedScan.scan.id),
    onJsonLine: async (payload) => {
      const parsed = parseSubfinderJsonLine(payload);

      if (!parsed || parsed.host === targetDomain || !parsed.host.endsWith(`.${targetDomain}`)) {
        return;
      }

      const source = parsed.source ?? (parsed.sources.length === 1 ? parsed.sources[0] : null);
      const ipKey = parsed.ip?.toLowerCase() ?? "";
      const sourceKey = source?.toLowerCase() ?? "";
      const key = [parsed.host, ipKey, sourceKey].join("\0");

      if (seen.has(key)) {
        return;
      }

      seen.add(key);

      const inserted = await db
        .insert(scanSubdomains)
        .values({
          scanId: claimedScan.scan.id,
          attemptId: claimedScan.attempt.id,
          runId: run.id,
          rootDomain: targetDomain,
          host: parsed.host,
          ip: parsed.ip,
          ipKey,
          source,
          sourceKey,
          wildcardCertificate: parsed.wildcardCertificate,
          rawJson: parsed.rawJson,
        })
        .onConflictDoNothing()
        .returning({ id: scanSubdomains.id });

      if (inserted.length > 0) {
        resultCount += 1;
      }
    },
  }).catch((error: unknown) => ({
    status: "failed" as const,
    exitCode: 1,
    stderr: error instanceof Error ? error.message : "Subfinder failed.",
  }));

  if (result.status === "cancelled") {
    await completeSubdomainDiscoveryRun(run.id, "skipped", resultCount, "Scan was cancelled.");
    logWorkerEvent("subfinder_discovery_cancelled", {
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      targetDomain,
      resultCount,
    });
    return { status: "cancelled" };
  }

  if (result.status === "aborted") {
    await completeSubdomainDiscoveryRun(run.id, "failed", resultCount, "Worker shutdown interrupted subdomain discovery.");
    logWorkerEvent("subfinder_discovery_aborted", {
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      targetDomain,
      resultCount,
    });
    return { status: "aborted" };
  }

  if (result.status === "completed") {
    await completeSubdomainDiscoveryRun(run.id, "completed", resultCount);
    await emitSubdomainProgress(claimedScan, resultCount);
    logWorkerEvent("subfinder_discovery_completed", {
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      targetDomain,
      resultCount,
    });
    return { status: "completed" };
  }

  if (result.status === "timed_out") {
    const timeoutMessage = `Subfinder timed out after ${DEFAULT_SUBFINDER_PROCESS_TIMEOUT_MS}ms; using partial results.`;
    await completeSubdomainDiscoveryRun(run.id, "completed", resultCount, timeoutMessage);
    await emitSubdomainProgress(claimedScan, resultCount);
    logWorkerEvent("subfinder_discovery_timed_out", {
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      targetDomain,
      resultCount,
      timeoutMs: DEFAULT_SUBFINDER_PROCESS_TIMEOUT_MS,
      message: result.stderr || timeoutMessage,
    });
    return { status: "completed" };
  }

  const errorMessage = result.stderr || `subfinder ${result.status}`;
  await completeSubdomainDiscoveryRun(run.id, "failed", resultCount, errorMessage);
  logWorkerEvent("subfinder_discovery_failed", {
    scanId: claimedScan.scan.id,
    attemptId: claimedScan.attempt.id,
    targetDomain,
    status: result.status,
    resultCount,
    message: errorMessage,
  });
  return { status: "failed", errorMessage };
}
