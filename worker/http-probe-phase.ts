import {
  buildHttpxArguments,
  getHttpxBehaviorOptionsForProfile,
  getHttpxExecutionTarget,
  getNextHttpxRequestProfile,
  runHttpxCli,
  type HttpxJson,
  type HttpxRequestProfile,
} from "./httpx.ts";
import { eq } from "drizzle-orm";

import { scanResults } from "../drizzle/schema.ts";
import { env } from "../lib/env/server.ts";
import {
  rankAuthoritativeScanResults,
  type RankedAuthoritativeScanResult,
} from "../lib/server/scans/result-selection.ts";
import {
  type AttemptMeta,
  buildAttemptMeta,
  markAttemptCancelled,
  markAttemptCompleted,
  markAttemptFailed,
  markScanFailedAfterAttemptCompletion,
  markScanProcessing,
} from "./attempts.ts";
import { db } from "./db.ts";
import {
  markPhaseCompleted,
  markPhaseFailed,
  markPhaseRunning,
  markPhaseSkipped,
  upsertPhaseRun,
} from "./phase-runs.ts";
import {
  createFallbackAttempt,
  type ClaimedScan,
} from "./scan-claims.ts";

const BLOCKED_HTTP_STATUS_CODES = new Set([403, 429]);
const DEFAULT_SCAN_TIMEOUT_MS = env.STACKRAY_HTTPX_TIMEOUT_MS ?? 15 * 60 * 1000;

type ScanResultRow = typeof scanResults.$inferSelect;

type AttemptResultSelectionRow = Pick<
  ScanResultRow,
  "id" | "input" | "url" | "finalUrl" | "statusCode" | "title" | "contentType" | "observedAt"
>;

export type AttemptResultSummary = {
  resultCount: number;
  forbiddenResultCount: number;
  candidateResults: RankedAuthoritativeScanResult<AttemptResultSelectionRow>[];
  authoritativeResult: RankedAuthoritativeScanResult<AttemptResultSelectionRow> | null;
  authoritativeResultId: string | null;
  authoritativeResultStatusCode: number | null;
  authoritativeResultTitle: string | null;
  authoritativeResultContentType: string | null;
  authoritativeRetryUrl: string | null;
};

export type RunClaimedHttpProbePhaseDependencies = {
  isCancellationRequested: (scanId: string) => Promise<boolean>;
  persistHttpxResult: (
    claimedScan: ClaimedScan,
    payload: HttpxJson,
    resultCount: { value: number },
  ) => Promise<unknown>;
  createNoJsonHttpProbePlaceholderResult: (
    claimedScan: ClaimedScan,
    requestProfile: HttpxRequestProfile,
    fallbackReason: string,
  ) => Promise<ScanResultRow | null>;
  queueEnrichmentPhaseJobs: (
    claimedScan: ClaimedScan,
    authoritativeResult: ScanResultRow | null,
    attemptMetaPatch: Partial<AttemptMeta>,
  ) => Promise<void>;
  recoverInterruptedHttpProbe: (claimedScan: ClaimedScan) => Promise<void>;
};

export type AttemptFallbackDecision = {
  shouldFallback: boolean;
  nextProfile: HttpxRequestProfile | null;
  retryUrl: string | null;
  reason:
    | "authoritative_result_blocked"
    | "authoritative_result_degraded"
    | "authoritative_result_not_blocked"
    | "authoritative_result_missing"
    | "fallback_exhausted";
};

type AttemptFallbackSummary = {
  authoritativeResultStatusCode: number | null;
  authoritativeResultTitle: string | null;
  authoritativeResultContentType: string | null;
  authoritativeRetryUrl: string | null;
};

export function isDegradedMachineReadableDocument(result: {
  statusCode: number | null;
  title: string | null;
  contentType: string | null;
}) {
  const statusCode = result.statusCode ?? 0;
  const title = result.title?.trim() ?? "";
  const contentType = result.contentType?.toLowerCase() ?? "";

  if (statusCode < 200 || statusCode >= 400) {
    return false;
  }

  return title.length === 0 && (contentType.includes("text/markdown") || contentType.includes("text/x-markdown"));
}

export function buildAttemptFallbackDecision(
  requestProfile: HttpxRequestProfile,
  summary: AttemptFallbackSummary,
): AttemptFallbackDecision {
  const nextProfile = getNextHttpxRequestProfile(requestProfile);

  if (summary.authoritativeResultStatusCode === null) {
    if (nextProfile) {
      return {
        shouldFallback: true,
        nextProfile,
        retryUrl: null,
        reason: "authoritative_result_missing",
      };
    }

    return {
      shouldFallback: false,
      nextProfile: null,
      retryUrl: null,
      reason: "fallback_exhausted",
    };
  }

  if (!BLOCKED_HTTP_STATUS_CODES.has(summary.authoritativeResultStatusCode)) {
    if (
      nextProfile
      && isDegradedMachineReadableDocument({
        statusCode: summary.authoritativeResultStatusCode,
        title: summary.authoritativeResultTitle,
        contentType: summary.authoritativeResultContentType,
      })
    ) {
      return {
        shouldFallback: true,
        nextProfile,
        retryUrl: summary.authoritativeRetryUrl,
        reason: "authoritative_result_degraded",
      };
    }

    return {
      shouldFallback: false,
      nextProfile: null,
      retryUrl: null,
      reason: "authoritative_result_not_blocked",
    };
  }

  if (!nextProfile) {
    return {
      shouldFallback: false,
      nextProfile: null,
      retryUrl: summary.authoritativeRetryUrl,
      reason: "fallback_exhausted",
    };
  }

  return {
    shouldFallback: true,
    nextProfile,
    retryUrl: summary.authoritativeRetryUrl,
    reason: "authoritative_result_blocked",
  };
}

export function getRequestProfileLabel(profile: HttpxRequestProfile) {
  switch (profile) {
    case "baseline":
      return "Baseline";
    case "browser_headers":
      return "Browser headers";
  }
}

export function getFallbackReason(profile: HttpxRequestProfile) {
  switch (profile) {
    case "baseline":
      return null;
    case "browser_headers":
      return "blocked_after_baseline";
  }
}

export function formatFallbackAttemptReason(
  requestProfile: HttpxRequestProfile,
  fallbackDecision: AttemptFallbackDecision,
  summary: Pick<AttemptFallbackSummary, "authoritativeResultStatusCode" | "authoritativeResultContentType">,
) {
  if (fallbackDecision.reason === "authoritative_result_degraded") {
    return `Received degraded ${summary.authoritativeResultContentType ?? "unknown content"} result after ${getRequestProfileLabel(requestProfile)}.`;
  }

  return `Received authoritative ${summary.authoritativeResultStatusCode ?? "missing"} after ${getRequestProfileLabel(requestProfile)}.`;
}

export function buildRetryTargets(
  target: Pick<{ normalizedTarget: string }, "normalizedTarget">,
) {
  return [getHttpxExecutionTarget(target.normalizedTarget)];
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

export async function summarizeAttemptResults(claimedScan: ClaimedScan): Promise<AttemptResultSummary> {
  const rows = await db
    .select({
      id: scanResults.id,
      input: scanResults.input,
      statusCode: scanResults.statusCode,
      title: scanResults.title,
      contentType: scanResults.contentType,
      finalUrl: scanResults.finalUrl,
      url: scanResults.url,
      observedAt: scanResults.observedAt,
    })
    .from(scanResults)
    .where(eq(scanResults.attemptId, claimedScan.attempt.id));

  const candidateResults = rankAuthoritativeScanResults(rows, claimedScan.target.normalizedTarget);
  const authoritativeResult = candidateResults[0] ?? null;

  return {
    resultCount: rows.length,
    forbiddenResultCount: rows.filter((row) => (row.statusCode ?? 0) === 403).length,
    candidateResults,
    authoritativeResult,
    authoritativeResultId: authoritativeResult?.resultId ?? null,
    authoritativeResultStatusCode: authoritativeResult?.statusCode ?? null,
    authoritativeResultTitle: authoritativeResult?.result.title ?? null,
    authoritativeResultContentType: authoritativeResult?.result.contentType ?? null,
    authoritativeRetryUrl: authoritativeResult?.finalUrl ?? authoritativeResult?.url ?? null,
  };
}

function buildAttemptSelectionTracePayload(
  claimedScan: ClaimedScan,
  requestProfile: HttpxRequestProfile,
  attemptSummary: AttemptResultSummary,
) {
  return {
    scanId: claimedScan.scan.id,
    attemptId: claimedScan.attempt.id,
    attemptNumber: claimedScan.attempt.attemptNumber,
    requestProfile,
    candidateResults: attemptSummary.candidateResults.map((candidate) => ({
      resultId: candidate.resultId,
      statusCode: candidate.statusCode,
      title: candidate.result.title ?? null,
      contentType: candidate.result.contentType ?? null,
      input: candidate.input,
      url: candidate.url,
      finalUrl: candidate.finalUrl,
      matchedOn: candidate.matchedOn,
      matchesPrimaryTarget: candidate.matchesPrimaryTarget,
    })),
    selectedResultId: attemptSummary.authoritativeResultId,
    selectedResultStatus: attemptSummary.authoritativeResultStatusCode,
    selectedResultTitle: attemptSummary.authoritativeResultTitle,
    selectedResultContentType: attemptSummary.authoritativeResultContentType,
    selectedResultUrl: attemptSummary.authoritativeResult?.url ?? null,
    selectedResultFinalUrl: attemptSummary.authoritativeResult?.finalUrl ?? null,
    selectedMatchSource: attemptSummary.authoritativeResult?.matchedOn ?? null,
    forbiddenResultCount: attemptSummary.forbiddenResultCount,
    resultCount: attemptSummary.resultCount,
  };
}

export type RunClaimedHttpProbePhaseResult =
  | { status: "completed" }
  | { status: "cancelled" }
  | { status: "aborted" }
  | { status: "failed"; errorMessage: string };

export async function runClaimedHttpProbePhase(
  claimedScan: ClaimedScan,
  dependencies: RunClaimedHttpProbePhaseDependencies,
  signal?: AbortSignal,
): Promise<RunClaimedHttpProbePhaseResult> {
  let activeClaimedScan = claimedScan;
  let retryTargets = [getHttpxExecutionTarget(claimedScan.target.normalizedTarget)];
  let activeAttemptCompleted = false;

  try {
    await markPhaseRunning(claimedScan.scan.id, claimedScan.attempt.id, "http_probe");

    while (true) {
      activeAttemptCompleted = false;
      const resultCount = { value: 0 };
      const requestProfile =
        activeClaimedScan.attempt.metaJson?.requestProfile === "browser_headers" ? "browser_headers" : "baseline";
      const activeFallbackReason =
        typeof activeClaimedScan.attempt.metaJson?.fallbackReason === "string"
          ? activeClaimedScan.attempt.metaJson.fallbackReason
          : getFallbackReason(requestProfile);
      const activeScanId = activeClaimedScan.scan.id;
      const activeAttemptId = activeClaimedScan.attempt.id;
      const activeAttemptNumber = activeClaimedScan.attempt.attemptNumber;

      const result = await runHttpxCli({
        command: env.HTTPX_BIN ?? "httpx",
        args: buildHttpxArguments(activeClaimedScan.scan, getHttpxBehaviorOptionsForProfile(requestProfile)),
        targets: retryTargets,
        timeoutMs: DEFAULT_SCAN_TIMEOUT_MS,
        signal,
        shouldCancel: async () => dependencies.isCancellationRequested(activeScanId),
        onJsonLine: async (payload) => {
          await dependencies.persistHttpxResult(activeClaimedScan, payload, resultCount);
        },
      });

      if (result.status === "cancelled") {
        logWorkerEvent("scan_attempt_cancelled", {
          scanId: activeScanId,
          attemptId: activeAttemptId,
          attemptNumber: activeAttemptNumber,
          requestProfile,
        });
        await markAttemptCancelled(activeClaimedScan);
        await upsertPhaseRun({
          scanId: activeScanId,
          attemptId: activeAttemptId,
          phase: "http_probe",
          status: "cancelled",
          errorMessage: "Scan was cancelled.",
        });
        return { status: "cancelled" };
      }

      if (result.status === "timed_out") {
        logWorkerEvent("scan_attempt_failed", {
          scanId: activeScanId,
          attemptId: activeAttemptId,
          attemptNumber: activeAttemptNumber,
          requestProfile,
          reason: "worker_timeout",
        });
        await markAttemptFailed(activeClaimedScan, "worker_timeout", "httpx scan timed out.");
        await upsertPhaseRun({
          scanId: activeScanId,
          attemptId: activeAttemptId,
          phase: "http_probe",
          status: "failed",
          errorCode: "worker_timeout",
          errorMessage: "httpx scan timed out.",
        });
        return { status: "failed", errorMessage: "httpx scan timed out." };
      }

      if (result.status === "aborted") {
        logWorkerEvent("scan_attempt_aborted", {
          scanId: activeScanId,
          attemptId: activeAttemptId,
          attemptNumber: activeAttemptNumber,
          requestProfile,
          reason: "worker_shutdown",
        });
        await dependencies.recoverInterruptedHttpProbe(activeClaimedScan);
        return { status: "aborted" };
      }

      if (result.status === "failed") {
        logWorkerEvent("scan_attempt_failed", {
          scanId: activeScanId,
          attemptId: activeAttemptId,
          attemptNumber: activeAttemptNumber,
          requestProfile,
          reason: `httpx_exit_${result.exitCode}`,
          message: result.stderr || null,
        });
        await markAttemptFailed(activeClaimedScan, `httpx_exit_${result.exitCode}`, result.stderr);
        await upsertPhaseRun({
          scanId: activeScanId,
          attemptId: activeAttemptId,
          phase: "http_probe",
          status: "failed",
          errorCode: `httpx_exit_${result.exitCode}`,
          errorMessage: result.stderr,
        });
        return { status: "failed", errorMessage: result.stderr };
      }

      const attemptSummary = await summarizeAttemptResults(activeClaimedScan);
      const selectionTracePayload = buildAttemptSelectionTracePayload(activeClaimedScan, requestProfile, attemptSummary);
      const fallbackDecision = buildAttemptFallbackDecision(requestProfile, attemptSummary);

      logWorkerEvent("scan_attempt_selection_evaluated", selectionTracePayload);
      logWorkerEvent("scan_attempt_fallback_decided", {
        ...selectionTracePayload,
        fallbackTriggered: fallbackDecision.shouldFallback,
        fallbackDecisionReason: fallbackDecision.reason,
        retryUrl: fallbackDecision.retryUrl,
        nextRequestProfile: fallbackDecision.nextProfile,
      });

      const completedAttemptMeta = buildAttemptMeta(
        requestProfile,
        activeFallbackReason,
        attemptSummary.resultCount,
        attemptSummary.forbiddenResultCount,
      );

      if (!fallbackDecision.shouldFallback) {
        let authoritativeResult = attemptSummary.authoritativeResultId
          ? (await db
            .select()
            .from(scanResults)
            .where(eq(scanResults.id, attemptSummary.authoritativeResultId))
            .limit(1))[0] ?? null
          : null;
        const createdNoJsonPlaceholder =
          !authoritativeResult
          && fallbackDecision.reason === "fallback_exhausted"
          && attemptSummary.resultCount === 0
            ? await dependencies.createNoJsonHttpProbePlaceholderResult(
              activeClaimedScan,
              requestProfile,
              activeFallbackReason ?? getFallbackReason(requestProfile) ?? "http_probe_no_output",
            )
            : null;

        authoritativeResult ??= createdNoJsonPlaceholder;

        logWorkerEvent("scan_attempt_post_processing_target", {
          ...selectionTracePayload,
          retryUrl: attemptSummary.authoritativeRetryUrl,
          postProcessingTarget: createdNoJsonPlaceholder
            ? "http_probe_no_output_placeholder"
            : authoritativeResult
              ? "authoritative_result"
              : "none",
        });

        if (await dependencies.isCancellationRequested(activeScanId)) {
          await markAttemptCancelled(activeClaimedScan);
          await upsertPhaseRun({
            scanId: activeScanId,
            attemptId: activeAttemptId,
            phase: "http_probe",
            status: "cancelled",
            errorMessage: "Scan was cancelled.",
          });
          return { status: "cancelled" };
        }

        await markScanProcessing(activeClaimedScan);
        await markPhaseCompleted(activeScanId, activeAttemptId, "http_probe", authoritativeResult?.id ?? null, {
          resultCount: attemptSummary.resultCount,
          selectedResultId: authoritativeResult?.id ?? null,
          selectedResultStatusCode: authoritativeResult?.statusCode ?? null,
          provisionalResultKind: createdNoJsonPlaceholder ? "http_probe_no_output" : null,
        });
        await dependencies.queueEnrichmentPhaseJobs(activeClaimedScan, authoritativeResult, completedAttemptMeta);
        activeAttemptCompleted = true;
        return { status: "completed" };
      }

      const nextProfile = fallbackDecision.nextProfile;

      if (nextProfile === null) {
        throw new Error("Fallback decision requested a retry without a next request profile.");
      }

      await markAttemptCompleted(activeClaimedScan, completedAttemptMeta);
      activeAttemptCompleted = true;
      activeClaimedScan = await createFallbackAttempt(
        activeClaimedScan,
        nextProfile,
        formatFallbackAttemptReason(requestProfile, fallbackDecision, attemptSummary),
      );
      activeAttemptCompleted = false;
      await markPhaseSkipped(activeScanId, activeAttemptId, "http_probe", "A fallback HTTP probe attempt superseded this attempt.");
      await markPhaseRunning(activeClaimedScan.scan.id, activeClaimedScan.attempt.id, "http_probe");
      retryTargets = buildRetryTargets(activeClaimedScan.target);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker execution failed.";

    if (activeAttemptCompleted) {
      await markScanFailedAfterAttemptCompletion(activeClaimedScan, "worker_exception", message);
      await markPhaseFailed(activeClaimedScan.scan.id, activeClaimedScan.attempt.id, "http_probe", error);
      return { status: "failed", errorMessage: message };
    }

    await markAttemptFailed(activeClaimedScan, "worker_exception", message);
    await markPhaseFailed(activeClaimedScan.scan.id, activeClaimedScan.attempt.id, "http_probe", error);
    return { status: "failed", errorMessage: message };
  }
}
