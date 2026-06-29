import { and, eq, sql } from "drizzle-orm";

import {
  scanResults,
  scanPhaseRuns,
  scans,
} from "../drizzle/schema.ts";
import { db } from "./db.ts";
import { FINALIZE_RETRY_DELAY_MS } from "./finalize-config.ts";
import { screenshotStorageEnabled } from "../lib/server/storage/screenshots.ts";
import { enrichIpAddress } from "./ip-enrichment.ts";
import { enrichAttemptWithSubfinder } from "./subfinder-phase.ts";
import {
  markPhaseCompleted,
  markPhaseFailed,
  markPhaseRunning,
  markPhaseSkipped,
  TERMINAL_PHASE_STATUSES,
  upsertPhaseRun,
} from "./phase-runs.ts";
import {
  enqueuePhaseJob,
  type ScanPhaseKind,
} from "./queue.ts";
import {
  createNoJsonHttpProbePlaceholderResult,
  persistHttpxResult,
} from "./httpx-results.ts";
import {
  enrichResultWithHeadless,
  shouldCaptureHomepageScreenshot,
} from "./headless-enrichment.ts";
import {
  buildBrowserFallbackDecision,
  buildBrowserFallbackDecisionOptionsFromMeta,
  buildBrowserFallbackPhaseMeta,
  enrichResultWithBrowserFallback,
  type BrowserFallbackDecision,
  type BrowserFallbackDecisionOptions,
} from "./browser-fallback.ts";
import {
  runClaimedHttpProbePhase,
  summarizeAttemptResults,
} from "./http-probe-phase.ts";
import {
  enrichResultWithNucleiPhaseGroup,
  finalizeNucleiRunAggregate,
  type NucleiPhaseGroup,
} from "./nuclei-phase.ts";
import {
  markAttemptCancelled,
  markAttemptFailed,
  markScanCompleted,
} from "./attempts.ts";
import {
  claimNextQueuedScan,
  claimQueuedScanById,
  getClaimedScanForAttempt,
  getScanResultForPhase,
  type ClaimedScan,
} from "./scan-claims.ts";
export { recoverStaleHttpProbeJobs } from "./recovery.ts";

type ScanRow = typeof scans.$inferSelect;
type ScanResultRow = typeof scanResults.$inferSelect;

const ENRICHMENT_PHASES = ["subfinder", "headless", "browser_fallback", "nuclei_dns", "nuclei_http", "ip_intel"] as const;

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function logWorkerEvent(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      component: "httpx-worker",
      event,
      ...payload,
    }),
  );
}

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function pokeFinalizePhase(scanId: string, attemptId: string) {
  await enqueuePhaseJob("finalize", { scanId, attemptId }, { jobKeyMode: "replace" });
}

async function queuePhase(scanId: string, attemptId: string, phase: ScanPhaseKind, payload: Record<string, unknown>, resultId?: string | null) {
  await queuePhaseRun(scanId, attemptId, phase, resultId);
  await enqueuePhaseJob(phase, payload);
}

async function queuePhaseRun(scanId: string, attemptId: string, phase: ScanPhaseKind, resultId?: string | null) {
  await upsertPhaseRun({
    scanId,
    attemptId,
    resultId,
    phase,
    status: "queued",
  });
}

async function getPhaseRunForAttempt(attemptId: string, phase: ScanPhaseKind) {
  const [phaseRun] = await db
    .select()
    .from(scanPhaseRuns)
    .where(and(eq(scanPhaseRuns.attemptId, attemptId), eq(scanPhaseRuns.phase, phase)))
    .limit(1);

  return phaseRun ?? null;
}

async function enqueueQueuedPhase(
  attemptId: string,
  phase: ScanPhaseKind,
  payload: Record<string, unknown>,
  metaJson?: Record<string, unknown>,
) {
  const phaseRun = await getPhaseRunForAttempt(attemptId, phase);

  if (phaseRun?.status !== "queued") {
    return false;
  }

  if (metaJson) {
    await upsertPhaseRun({
      scanId: phaseRun.scanId,
      attemptId,
      resultId: typeof payload.resultId === "string" ? payload.resultId : phaseRun.resultId,
      phase,
      status: "queued",
      metaJson,
    });
  }

  await enqueuePhaseJob(phase, payload, { jobKeyMode: "replace" });
  return true;
}

async function enqueueNucleiDnsAfterHeadless(scanId: string, attemptId: string, resultId: string) {
  await enqueueQueuedPhase(attemptId, "nuclei_dns", { scanId, attemptId, resultId });
}

async function enqueueBrowserFallbackAfterHeadless(
  scanId: string,
  attemptId: string,
  resultId: string,
  decision: BrowserFallbackDecision,
  triggerOptions: BrowserFallbackDecisionOptions,
) {
  await enqueueQueuedPhase(
    attemptId,
    "browser_fallback",
    { scanId, attemptId, resultId },
    buildBrowserFallbackPhaseMeta(decision, triggerOptions),
  );
}

async function enqueueIpIntelAfterBrowserEnrichment(scanId: string, attemptId: string, resultId: string) {
  const result = await getScanResultForPhase(scanId, attemptId, resultId);

  if (!result) {
    await markPhaseFailed(scanId, attemptId, "ip_intel", new Error("IP intel phase could not find its scan result."), resultId);
    await pokeFinalizePhase(scanId, attemptId);
    return false;
  }

  if (!result.hostIp) {
    await markPhaseSkipped(scanId, attemptId, "ip_intel", "Authoritative result did not include a host IP.", resultId);
    await pokeFinalizePhase(scanId, attemptId);
    return false;
  }

  return enqueueQueuedPhase(attemptId, "ip_intel", { scanId, attemptId, resultId });
}

async function enqueueNucleiHttpAfterDns(scanId: string, attemptId: string, resultId: string) {
  await enqueueQueuedPhase(attemptId, "nuclei_http", { scanId, attemptId, resultId });
}

async function isCancellationRequested(scanId: string) {
  try {
    const [scan] = await db
      .select({ cancellationRequestedAt: scans.cancellationRequestedAt })
      .from(scans)
      .where(eq(scans.id, scanId))
      .limit(1);

    return scan?.cancellationRequestedAt !== null;
  } catch (error) {
    logWorkerEvent("scan_cancellation_check_failed", {
      scanId,
      errorName: getErrorName(error),
      message: getErrorMessage(error),
    });

    return false;
  }
}

async function runClaimedScan(claimedScan: ClaimedScan, signal?: AbortSignal) {
  await runClaimedHttpProbePhase(claimedScan, {
    isCancellationRequested,
    persistHttpxResult,
    createNoJsonHttpProbePlaceholderResult,
    queueEnrichmentPhaseJobs,
  }, signal);
}

async function queueEnrichmentPhaseJobs(claimedScan: ClaimedScan, authoritativeResult: ScanResultRow | null) {
  const scanId = claimedScan.scan.id;
  const attemptId = claimedScan.attempt.id;

  await queuePhase(scanId, attemptId, "subfinder", { scanId, attemptId });

  if (!authoritativeResult) {
    await markPhaseSkipped(scanId, attemptId, "headless", "No authoritative HTTP result was selected.");
    await markPhaseSkipped(scanId, attemptId, "browser_fallback", "No authoritative HTTP result was selected.");
    await markPhaseSkipped(scanId, attemptId, "nuclei_dns", "No authoritative HTTP result was selected.");
    await markPhaseSkipped(scanId, attemptId, "nuclei_http", "No authoritative HTTP result was selected.");
    await markPhaseSkipped(scanId, attemptId, "ip_intel", "No authoritative HTTP result was selected.");
  } else {
    const resultId = authoritativeResult.id;
    await Promise.all([
      queuePhase(scanId, attemptId, "headless", { scanId, attemptId, resultId }, resultId),
      // Keep downstream result-scoped enrichment queued until headless/browser fallback
      // has a chance to promote finalUrl, hostIp, and DNS fields on the selected result.
      queuePhaseRun(scanId, attemptId, "browser_fallback", resultId),
      queuePhaseRun(scanId, attemptId, "nuclei_dns", resultId),
      queuePhaseRun(scanId, attemptId, "nuclei_http", resultId),
      queuePhaseRun(scanId, attemptId, "ip_intel", resultId),
    ]);
  }

  await queuePhase(scanId, attemptId, "finalize", { scanId, attemptId });
}

async function getPhaseRunsForAttempt(attemptId: string) {
  return db
    .select()
    .from(scanPhaseRuns)
    .where(eq(scanPhaseRuns.attemptId, attemptId));
}

async function getFinalizationResult(claimedScan: ClaimedScan) {
  const summary = await summarizeAttemptResults(claimedScan);

  if (!summary.authoritativeResultId) {
    return null;
  }

  return getScanResultForPhase(claimedScan.scan.id, claimedScan.attempt.id, summary.authoritativeResultId);
}

export async function runScanById(scanId: string, signal?: AbortSignal) {
  const claimedScan = await claimQueuedScanById(scanId);

  if (!claimedScan) {
    return false;
  }

  await runClaimedScan(claimedScan, signal);
  return true;
}

export const runHttpProbeById = runScanById;

export async function runHeadlessPhaseById(scanId: string, attemptId: string, resultId: string, signal?: AbortSignal) {
  const claimedScan = await getClaimedScanForAttempt(scanId, attemptId);
  const result = await getScanResultForPhase(scanId, attemptId, resultId);

  if (!claimedScan || !result) {
    await markPhaseFailed(scanId, attemptId, "headless", new Error("Headless phase could not find its scan attempt or result."), resultId);
    await markPhaseFailed(scanId, attemptId, "browser_fallback", new Error("Browser fallback phase could not run because headless could not find its scan attempt or result."), resultId);
    await markPhaseFailed(scanId, attemptId, "nuclei_dns", new Error("Nuclei DNS phase could not run because headless could not find its scan attempt or result."), resultId);
    await markPhaseFailed(scanId, attemptId, "nuclei_http", new Error("Nuclei HTTP phase could not run because headless could not find its scan attempt or result."), resultId);
    await markPhaseFailed(scanId, attemptId, "ip_intel", new Error("IP intel phase could not run because headless could not find its scan attempt or result."), resultId);
    await pokeFinalizePhase(scanId, attemptId);
    return false;
  }

  await markPhaseRunning(scanId, attemptId, "headless", resultId);

  try {
    const screenshotTarget = {
      normalizedTarget: result.finalUrl ?? result.url ?? claimedScan.target.normalizedTarget,
    } satisfies Pick<ScanRow, "normalizedTarget">;
    const updatedResult = await enrichResultWithHeadless(result, screenshotTarget, {
      signal,
      isCancellationRequested,
    });

    await markPhaseCompleted(scanId, attemptId, "headless", resultId, {
      screenshotAvailable: Boolean(updatedResult.screenshotObjectKey),
      title: updatedResult.title ?? null,
      faviconUrl: updatedResult.faviconUrl ?? null,
    });
    await pokeFinalizePhase(scanId, attemptId);
    const headlessScreenshotMissing =
      screenshotStorageEnabled()
      && shouldCaptureHomepageScreenshot(updatedResult)
      && !updatedResult.screenshotObjectKey;
    const fallbackTriggerOptions = { headlessScreenshotMissing };
    const fallbackDecision = buildBrowserFallbackDecision(updatedResult, fallbackTriggerOptions);
    if (fallbackDecision.shouldRun) {
      await enqueueBrowserFallbackAfterHeadless(scanId, attemptId, resultId, fallbackDecision, fallbackTriggerOptions);
    } else {
      await markPhaseSkipped(scanId, attemptId, "browser_fallback", fallbackDecision.reason, resultId);
      await pokeFinalizePhase(scanId, attemptId);
      await enqueueIpIntelAfterBrowserEnrichment(scanId, attemptId, resultId);
      await enqueueNucleiDnsAfterHeadless(scanId, attemptId, resultId);
    }
    return true;
  } catch (error) {
    console.warn("Headless enrichment failed", {
      scanId,
      resultId,
      message: error instanceof Error ? error.message : "Unknown headless enrichment error",
    });
    await markPhaseFailed(scanId, attemptId, "headless", error, resultId);
    await pokeFinalizePhase(scanId, attemptId);
    const fallbackTriggerOptions = { headlessFailed: true };
    const fallbackDecision = buildBrowserFallbackDecision(result, fallbackTriggerOptions);
    if (fallbackDecision.shouldRun) {
      await enqueueBrowserFallbackAfterHeadless(scanId, attemptId, resultId, fallbackDecision, fallbackTriggerOptions);
    } else {
      await markPhaseSkipped(scanId, attemptId, "browser_fallback", fallbackDecision.reason, resultId);
      await pokeFinalizePhase(scanId, attemptId);
      await enqueueIpIntelAfterBrowserEnrichment(scanId, attemptId, resultId);
      await enqueueNucleiDnsAfterHeadless(scanId, attemptId, resultId);
    }
    return false;
  }
}

export async function runBrowserFallbackPhaseById(scanId: string, attemptId: string, resultId: string, signal?: AbortSignal) {
  const claimedScan = await getClaimedScanForAttempt(scanId, attemptId);
  const result = await getScanResultForPhase(scanId, attemptId, resultId);

  if (!claimedScan || !result) {
    await markPhaseFailed(scanId, attemptId, "browser_fallback", new Error("Browser fallback phase could not find its scan attempt or result."), resultId);
    await markPhaseFailed(scanId, attemptId, "nuclei_dns", new Error("Nuclei DNS phase could not run because browser fallback could not find its scan attempt or result."), resultId);
    await markPhaseFailed(scanId, attemptId, "nuclei_http", new Error("Nuclei HTTP phase could not run because browser fallback could not find its scan attempt or result."), resultId);
    await markPhaseFailed(scanId, attemptId, "ip_intel", new Error("IP intel phase could not run because browser fallback could not find its scan attempt or result."), resultId);
    await pokeFinalizePhase(scanId, attemptId);
    return false;
  }

  const phaseRun = await getPhaseRunForAttempt(attemptId, "browser_fallback");
  const fallbackTriggerOptions = buildBrowserFallbackDecisionOptionsFromMeta(phaseRun?.metaJson);
  const fallbackDecision = buildBrowserFallbackDecision(result, fallbackTriggerOptions);
  const fallbackPhaseMeta = buildBrowserFallbackPhaseMeta(fallbackDecision, fallbackTriggerOptions);

  if (!fallbackDecision.shouldRun) {
    await markPhaseSkipped(scanId, attemptId, "browser_fallback", fallbackDecision.reason, resultId);
    await pokeFinalizePhase(scanId, attemptId);
    await enqueueIpIntelAfterBrowserEnrichment(scanId, attemptId, resultId);
    await enqueueNucleiDnsAfterHeadless(scanId, attemptId, resultId);
    return false;
  }

  await markPhaseRunning(scanId, attemptId, "browser_fallback", resultId, fallbackPhaseMeta);

  try {
    const fallbackTarget = {
      normalizedTarget: result.finalUrl ?? result.url ?? claimedScan.target.normalizedTarget,
    } satisfies Pick<ScanRow, "normalizedTarget">;
    const fallbackResult = await enrichResultWithBrowserFallback(result, fallbackTarget, fallbackDecision, {
      signal,
      isCancellationRequested,
    });

    if (fallbackResult.run.status !== "completed") {
      throw new Error(fallbackResult.run.stderr || `Browser fallback exited with status ${fallbackResult.run.status}.`);
    }

    await markPhaseCompleted(scanId, attemptId, "browser_fallback", resultId, {
      ...fallbackPhaseMeta,
      outcome: fallbackResult.outcome,
      recovered: fallbackResult.recovered,
    });
    await pokeFinalizePhase(scanId, attemptId);
    await enqueueIpIntelAfterBrowserEnrichment(scanId, attemptId, resultId);
    await enqueueNucleiDnsAfterHeadless(scanId, attemptId, resultId);
    return fallbackResult.recovered;
  } catch (error) {
    console.warn("Browser fallback failed", {
      scanId,
      resultId,
      message: error instanceof Error ? error.message : "Unknown browser fallback error",
    });
    await markPhaseFailed(scanId, attemptId, "browser_fallback", error, resultId, fallbackPhaseMeta);
    await pokeFinalizePhase(scanId, attemptId);
    await enqueueIpIntelAfterBrowserEnrichment(scanId, attemptId, resultId);
    await enqueueNucleiDnsAfterHeadless(scanId, attemptId, resultId);
    return false;
  }
}

export async function runSubfinderPhaseById(scanId: string, attemptId: string, signal?: AbortSignal) {
  const claimedScan = await getClaimedScanForAttempt(scanId, attemptId);

  if (!claimedScan) {
    await markPhaseFailed(scanId, attemptId, "subfinder", new Error("Subfinder phase could not find its scan attempt."));
    await pokeFinalizePhase(scanId, attemptId);
    return false;
  }

  await markPhaseRunning(scanId, attemptId, "subfinder");

  try {
    const result = await enrichAttemptWithSubfinder(claimedScan, {
      signal,
      isCancellationRequested,
    });

    if (result.status === "cancelled") {
      await markAttemptCancelled(claimedScan);
      await upsertPhaseRun({
        scanId,
        attemptId,
        phase: "subfinder",
        status: "cancelled",
        errorMessage: "Scan was cancelled.",
      });
      await pokeFinalizePhase(scanId, attemptId);
      return false;
    }

    if (result.status === "aborted") {
      await markAttemptFailed(claimedScan, "worker_shutdown", "Worker shutdown interrupted the scan.");
      await upsertPhaseRun({
        scanId,
        attemptId,
        phase: "subfinder",
        status: "failed",
        errorCode: "worker_shutdown",
        errorMessage: "Worker shutdown interrupted the scan.",
      });
      await pokeFinalizePhase(scanId, attemptId);
      return false;
    }

    if (result.status === "failed") {
      await markPhaseFailed(scanId, attemptId, "subfinder", new Error(result.errorMessage));
      await pokeFinalizePhase(scanId, attemptId);
      return false;
    }

    await markPhaseCompleted(scanId, attemptId, "subfinder");
    await pokeFinalizePhase(scanId, attemptId);
    return true;
  } catch (error) {
    await markPhaseFailed(scanId, attemptId, "subfinder", error);
    await pokeFinalizePhase(scanId, attemptId);
    return false;
  }
}

export async function runNucleiDnsPhaseById(scanId: string, attemptId: string, resultId: string) {
  return runNucleiPhaseById(scanId, attemptId, resultId, "dns");
}

export async function runNucleiHttpPhaseById(scanId: string, attemptId: string, resultId: string) {
  return runNucleiPhaseById(scanId, attemptId, resultId, "http");
}

async function runNucleiPhaseById(scanId: string, attemptId: string, resultId: string, group: NucleiPhaseGroup) {
  const phase = group === "dns" ? "nuclei_dns" : "nuclei_http";
  const claimedScan = await getClaimedScanForAttempt(scanId, attemptId);
  const result = await getScanResultForPhase(scanId, attemptId, resultId);

  if (!claimedScan || !result) {
    await markPhaseFailed(scanId, attemptId, phase, new Error(`${phase} could not find its scan attempt or result.`), resultId);
    if (group === "dns") {
      await markPhaseFailed(scanId, attemptId, "nuclei_http", new Error("Nuclei HTTP phase could not run because nuclei DNS could not find its scan attempt or result."), resultId);
    }
    await pokeFinalizePhase(scanId, attemptId);
    return false;
  }

  await markPhaseRunning(scanId, attemptId, phase, resultId);
  const phaseResult = await enrichResultWithNucleiPhaseGroup(scanId, claimedScan.target, result, group);

  if (phaseResult.status === "skipped") {
    await markPhaseSkipped(scanId, attemptId, phase, phaseResult.errorMessage, resultId);
    await pokeFinalizePhase(scanId, attemptId);
    if (group === "dns") {
      await enqueueNucleiHttpAfterDns(scanId, attemptId, resultId);
    }
    return true;
  }

  if (phaseResult.status === "failed") {
    await upsertPhaseRun({
      scanId,
      attemptId,
      resultId,
      phase,
      status: "failed",
      errorCode: "nuclei_failed",
      errorMessage: phaseResult.errorMessage,
      metaJson: {
        matchCount: phaseResult.matchCount,
        technologyCount: phaseResult.technologyCount,
      },
    });
    await pokeFinalizePhase(scanId, attemptId);
    if (group === "dns") {
      await enqueueNucleiHttpAfterDns(scanId, attemptId, resultId);
    }
    return false;
  }

  await markPhaseCompleted(scanId, attemptId, phase, resultId, {
    matchCount: phaseResult.matchCount,
    technologyCount: phaseResult.technologyCount,
  });
  await pokeFinalizePhase(scanId, attemptId);
  if (group === "dns") {
    await enqueueNucleiHttpAfterDns(scanId, attemptId, resultId);
  }
  return true;
}

export async function runIpIntelPhaseById(scanId: string, attemptId: string, resultId: string) {
  const result = await getScanResultForPhase(scanId, attemptId, resultId);

  if (!result) {
    await markPhaseFailed(scanId, attemptId, "ip_intel", new Error("IP intel phase could not find its scan result."), resultId);
    await pokeFinalizePhase(scanId, attemptId);
    return false;
  }

  if (!result.hostIp) {
    await markPhaseSkipped(scanId, attemptId, "ip_intel", "Authoritative result did not include a host IP.", resultId);
    await pokeFinalizePhase(scanId, attemptId);
    return true;
  }

  await markPhaseRunning(scanId, attemptId, "ip_intel", resultId, { hostIp: result.hostIp });

  try {
    await enrichIpAddress(result.hostIp);
    await markPhaseCompleted(scanId, attemptId, "ip_intel", resultId, { hostIp: result.hostIp });
    await pokeFinalizePhase(scanId, attemptId);
    return true;
  } catch (error) {
    await markPhaseFailed(scanId, attemptId, "ip_intel", error, resultId);
    await pokeFinalizePhase(scanId, attemptId);
    return false;
  }
}

export async function finalizeScanById(scanId: string, attemptId: string) {
  const claimedScan = await getClaimedScanForAttempt(scanId, attemptId);

  if (!claimedScan) {
    await markPhaseFailed(scanId, attemptId, "finalize", new Error("Finalize phase could not find its scan attempt."));
    return false;
  }

  if (claimedScan.scan.status === "completed") {
    await markPhaseCompleted(scanId, attemptId, "finalize");
    return true;
  }

  if (claimedScan.scan.status === "failed" || claimedScan.scan.status === "cancelled") {
    await markPhaseSkipped(scanId, attemptId, "finalize", `Scan is already ${claimedScan.scan.status}.`);
    return false;
  }

  await markPhaseRunning(scanId, attemptId, "finalize");

  const phaseRuns = await getPhaseRunsForAttempt(attemptId);
  const phaseByKind = new Map(phaseRuns.map((phaseRun) => [phaseRun.phase, phaseRun]));
  const pendingPhases = ENRICHMENT_PHASES.filter((phase) => {
    const phaseRun = phaseByKind.get(phase);
    return !phaseRun || !TERMINAL_PHASE_STATUSES.has(phaseRun.status);
  });

  if (pendingPhases.length > 0) {
    await upsertPhaseRun({
      scanId,
      attemptId,
      phase: "finalize",
      status: "queued",
      metaJson: { waitingFor: pendingPhases },
    });
    await enqueuePhaseJob("finalize", { scanId, attemptId }, { runAt: new Date(Date.now() + FINALIZE_RETRY_DELAY_MS) });
    return false;
  }

  if (await isCancellationRequested(scanId)) {
    await markAttemptCancelled(claimedScan);
    await upsertPhaseRun({
      scanId,
      attemptId,
      phase: "finalize",
      status: "cancelled",
      errorMessage: "Scan was cancelled.",
    });
    return false;
  }

  const result = await getFinalizationResult(claimedScan);
  await finalizeNucleiRunAggregate(claimedScan, result, phaseRuns);
  const [resultCount] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(scanResults)
    .where(eq(scanResults.attemptId, attemptId));

  await markScanCompleted(claimedScan, resultCount?.value ?? 0);
  await markPhaseCompleted(scanId, attemptId, "finalize", result?.id ?? null, {
    resultCount: resultCount?.value ?? 0,
  });
  return true;
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
