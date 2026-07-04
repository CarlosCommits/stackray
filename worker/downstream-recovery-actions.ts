import { and, eq } from "drizzle-orm";

import {
  scanEvents,
  scanPhaseRuns,
  scanResults,
} from "../drizzle/schema.ts";
import { enqueueGraphileJob, removeGraphileJob } from "../lib/server/jobs/graphile.ts";
import {
  buildBrowserFallbackDecision,
  buildBrowserFallbackPhaseMeta,
} from "./browser-fallback.ts";
import { getPhaseJobKey } from "./queue.ts";
import {
  RESULT_PHASES,
  WORKER_INTERRUPTED_MESSAGE,
  type DownstreamPhase,
  type RecoveryDb,
  type StalePhaseRow,
} from "./downstream-recovery-types.ts";
import { resolveGraphileJobFlags } from "./worker-config.ts";

type PhasePayloadResult =
  | { readonly kind: "payload"; readonly payload: Record<string, unknown> }
  | { readonly kind: "missing_result" };
type InsertPhaseEventInput = {
  readonly tx: RecoveryDb;
  readonly phaseRun: StalePhaseRow;
  readonly status: "failed" | "queued" | "skipped";
  readonly now: Date;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
};
type SkipRelatedPhaseInput = {
  readonly tx: RecoveryDb;
  readonly sourcePhaseRun: StalePhaseRow;
  readonly phase: DownstreamPhase;
  readonly reason: string;
  readonly now: Date;
};

function isResultPhase(phase: DownstreamPhase): phase is (typeof RESULT_PHASES)[number] {
  return RESULT_PHASES.some((resultPhase) => resultPhase === phase);
}

function isQueuedPhaseRecoverable(phaseRun: StalePhaseRow) {
  if (phaseRun.metaJson.recoveryReason === "worker_interrupted") {
    return true;
  }

  switch (phaseRun.phase) {
    case "headless":
    case "subfinder":
    case "finalize":
      return true;
    case "browser_fallback":
    case "nuclei_dns":
    case "nuclei_http":
    case "ip_intel":
      return phaseRun.readyForRecovery;
    default: {
      const exhaustivePhase: never = phaseRun.phase;
      return exhaustivePhase;
    }
  }
}

function buildRecoveredPhasePayload(phase: DownstreamPhase, phaseRun: StalePhaseRow): PhasePayloadResult {
  if (!isResultPhase(phase)) {
    return { kind: "payload", payload: { scanId: phaseRun.scanId, attemptId: phaseRun.attemptId } };
  }

  if (!phaseRun.resultId) {
    return { kind: "missing_result" };
  }

  return {
    kind: "payload",
    payload: { scanId: phaseRun.scanId, attemptId: phaseRun.attemptId, resultId: phaseRun.resultId },
  };
}

function getMissingResultMessage(phase: DownstreamPhase) {
  return `Recovery could not continue ${phase} because its scan result is missing.`;
}

async function enqueueRecoveredPhaseJob(tx: RecoveryDb, phase: DownstreamPhase, phaseRun: StalePhaseRow) {
  const payloadResult = buildRecoveredPhasePayload(phase, phaseRun);

  if (payloadResult.kind === "missing_result") {
    return false;
  }

  await enqueueGraphileJob(tx, phase, payloadResult.payload, {
    jobKey: getPhaseJobKey(phaseRun.scanId, phaseRun.attemptId, phase),
    jobKeyMode: "replace",
    flags: resolveGraphileJobFlags(),
  });

  return true;
}

async function insertPhaseEvent({ tx, phaseRun, status, now, errorCode, errorMessage }: InsertPhaseEventInput) {
  await tx.insert(scanEvents).values({
    scanId: phaseRun.scanId,
    attemptId: phaseRun.attemptId,
    eventType: "scan.phase",
    payload: {
      scanId: phaseRun.scanId,
      attemptId: phaseRun.attemptId,
      resultId: phaseRun.resultId,
      phase: phaseRun.phase,
      status,
      errorCode,
      errorMessage,
      meta: errorMessage ? { message: errorMessage } : {},
      queuedAt: phaseRun.queuedAt.toISOString(),
      startedAt: status === "queued" ? null : phaseRun.startedAt?.toISOString() ?? null,
      completedAt: status === "queued" ? null : now.toISOString(),
      at: now.toISOString(),
    },
  });
}

async function failInterruptedPhase(tx: RecoveryDb, phaseRun: StalePhaseRow, now: Date) {
  await tx
    .update(scanPhaseRuns)
    .set({
      status: "failed",
      workerId: null,
      errorCode: "worker_interrupted",
      errorMessage: WORKER_INTERRUPTED_MESSAGE,
      metaJson: { message: WORKER_INTERRUPTED_MESSAGE },
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(scanPhaseRuns.id, phaseRun.phaseRunId));
  await insertPhaseEvent({
    tx,
    phaseRun,
    status: "failed",
    now,
    errorCode: "worker_interrupted",
    errorMessage: WORKER_INTERRUPTED_MESSAGE,
  });
}

async function failMissingResultPhase(tx: RecoveryDb, phaseRun: StalePhaseRow, now: Date) {
  const message = getMissingResultMessage(phaseRun.phase);

  await tx
    .update(scanPhaseRuns)
    .set({
      status: "failed",
      workerId: null,
      errorCode: "recovery_missing_result",
      errorMessage: message,
      metaJson: { message },
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(scanPhaseRuns.id, phaseRun.phaseRunId));
  await insertPhaseEvent({
    tx,
    phaseRun,
    status: "failed",
    now,
    errorCode: "recovery_missing_result",
    errorMessage: message,
  });
}

async function enqueueAttemptPhase(tx: RecoveryDb, phase: DownstreamPhase, phaseRun: StalePhaseRow) {
  await enqueueGraphileJob(tx, phase, { scanId: phaseRun.scanId, attemptId: phaseRun.attemptId }, {
    jobKey: getPhaseJobKey(phaseRun.scanId, phaseRun.attemptId, phase),
    jobKeyMode: "replace",
    flags: resolveGraphileJobFlags(),
  });
}

async function enqueueResultPhase(tx: RecoveryDb, phase: DownstreamPhase, phaseRun: StalePhaseRow) {
  if (!phaseRun.resultId) {
    return false;
  }

  await enqueueGraphileJob(tx, phase, { scanId: phaseRun.scanId, attemptId: phaseRun.attemptId, resultId: phaseRun.resultId }, {
    jobKey: getPhaseJobKey(phaseRun.scanId, phaseRun.attemptId, phase),
    jobKeyMode: "replace",
    flags: resolveGraphileJobFlags(),
  });

  return true;
}

async function getRecoveredResult(tx: RecoveryDb, phaseRun: StalePhaseRow) {
  if (!phaseRun.resultId) {
    return null;
  }

  const [result] = await tx
    .select()
    .from(scanResults)
    .where(and(eq(scanResults.id, phaseRun.resultId), eq(scanResults.scanId, phaseRun.scanId), eq(scanResults.attemptId, phaseRun.attemptId)));

  return result ?? null;
}

async function markRelatedPhaseSkipped({ tx, sourcePhaseRun, phase, reason, now }: SkipRelatedPhaseInput) {
  const [phaseRun] = await tx
    .select({
      phaseRunId: scanPhaseRuns.id,
      scanId: scanPhaseRuns.scanId,
      attemptId: scanPhaseRuns.attemptId,
      resultId: scanPhaseRuns.resultId,
      phase: scanPhaseRuns.phase,
      status: scanPhaseRuns.status,
      metaJson: scanPhaseRuns.metaJson,
      queuedAt: scanPhaseRuns.queuedAt,
      startedAt: scanPhaseRuns.startedAt,
    })
    .from(scanPhaseRuns)
    .where(and(eq(scanPhaseRuns.attemptId, sourcePhaseRun.attemptId), eq(scanPhaseRuns.phase, phase), eq(scanPhaseRuns.status, "queued")));

  await tx
    .update(scanPhaseRuns)
    .set({
      status: "skipped",
      workerId: null,
      errorCode: null,
      errorMessage: reason,
      metaJson: { reason },
      completedAt: now,
      updatedAt: now,
    })
    .where(and(eq(scanPhaseRuns.attemptId, sourcePhaseRun.attemptId), eq(scanPhaseRuns.phase, phase), eq(scanPhaseRuns.status, "queued")));

  if (phaseRun) {
    await insertPhaseEvent({
      tx,
      phaseRun: { ...phaseRun, phase, status: "queued", readyForRecovery: false },
      status: "skipped",
      now,
      errorCode: null,
      errorMessage: reason,
    });
  }
}

async function recoverAfterHeadlessInterruption(tx: RecoveryDb, phaseRun: StalePhaseRow, now: Date) {
  const result = await getRecoveredResult(tx, phaseRun);

  if (!result) {
    const reason = "Recovered headless phase did not have a result to continue enrichment.";
    await markRelatedPhaseSkipped({ tx, sourcePhaseRun: phaseRun, phase: "browser_fallback", reason, now });
    await markRelatedPhaseSkipped({ tx, sourcePhaseRun: phaseRun, phase: "nuclei_dns", reason, now });
    await markRelatedPhaseSkipped({ tx, sourcePhaseRun: phaseRun, phase: "nuclei_http", reason, now });
    await markRelatedPhaseSkipped({ tx, sourcePhaseRun: phaseRun, phase: "ip_intel", reason, now });
    await enqueueAttemptPhase(tx, "finalize", phaseRun);
    return;
  }

  const triggerOptions = { headlessFailed: true };
  const fallbackDecision = buildBrowserFallbackDecision(result, triggerOptions);

  if (fallbackDecision.shouldRun) {
    await tx
      .update(scanPhaseRuns)
      .set({
        metaJson: buildBrowserFallbackPhaseMeta(fallbackDecision, triggerOptions),
        updatedAt: now,
      })
      .where(and(eq(scanPhaseRuns.attemptId, phaseRun.attemptId), eq(scanPhaseRuns.phase, "browser_fallback"), eq(scanPhaseRuns.status, "queued")));
    await enqueueResultPhase(tx, "browser_fallback", phaseRun);
    return;
  }

  await markRelatedPhaseSkipped({ tx, sourcePhaseRun: phaseRun, phase: "browser_fallback", reason: fallbackDecision.reason, now });
  await enqueueResultPhase(tx, "ip_intel", phaseRun);
  await enqueueResultPhase(tx, "nuclei_dns", phaseRun);
}

async function requeueFinalizePhase(tx: RecoveryDb, phaseRun: StalePhaseRow, now: Date) {
  await tx
    .update(scanPhaseRuns)
    .set({
      status: "queued",
      workerId: null,
      errorCode: null,
      errorMessage: null,
      metaJson: { recoveryReason: "worker_interrupted" },
      startedAt: null,
      completedAt: null,
      updatedAt: now,
    })
    .where(eq(scanPhaseRuns.id, phaseRun.phaseRunId));
  await insertPhaseEvent({ tx, phaseRun, status: "queued", now, errorCode: null, errorMessage: null });
  await enqueueRecoveredPhaseJob(tx, "finalize", phaseRun);
}

async function continueAfterInterruptedPhase(tx: RecoveryDb, phaseRun: StalePhaseRow, now: Date) {
  switch (phaseRun.phase) {
    case "headless":
      await recoverAfterHeadlessInterruption(tx, phaseRun, now);
      return;
    case "browser_fallback":
      if (!await enqueueResultPhase(tx, "ip_intel", phaseRun)) {
        await markRelatedPhaseSkipped({
          tx,
          sourcePhaseRun: phaseRun,
          phase: "ip_intel",
          reason: getMissingResultMessage("ip_intel"),
          now,
        });
      }
      if (!await enqueueResultPhase(tx, "nuclei_dns", phaseRun)) {
        await markRelatedPhaseSkipped({
          tx,
          sourcePhaseRun: phaseRun,
          phase: "nuclei_dns",
          reason: getMissingResultMessage("nuclei_dns"),
          now,
        });
      }
      await enqueueAttemptPhase(tx, "finalize", phaseRun);
      return;
    case "subfinder":
      await enqueueAttemptPhase(tx, "finalize", phaseRun);
      return;
    case "nuclei_dns":
      if (!await enqueueResultPhase(tx, "nuclei_http", phaseRun)) {
        await markRelatedPhaseSkipped({
          tx,
          sourcePhaseRun: phaseRun,
          phase: "nuclei_http",
          reason: getMissingResultMessage("nuclei_http"),
          now,
        });
        await enqueueAttemptPhase(tx, "finalize", phaseRun);
      }
      return;
    case "nuclei_http":
    case "ip_intel":
      await enqueueAttemptPhase(tx, "finalize", phaseRun);
      return;
    case "finalize":
      await requeueFinalizePhase(tx, phaseRun, now);
      return;
    default: {
      const exhaustivePhase: never = phaseRun.phase;
      return exhaustivePhase;
    }
  }
}

export async function recoverLockedPhase(tx: RecoveryDb, phaseRun: StalePhaseRow) {
  const now = new Date();

  if (phaseRun.status === "queued") {
    if (!isQueuedPhaseRecoverable(phaseRun)) {
      return false;
    }

    const enqueued = await enqueueRecoveredPhaseJob(tx, phaseRun.phase, phaseRun);
    if (enqueued) {
      return true;
    }

    await failMissingResultPhase(tx, phaseRun, now);
    await enqueueAttemptPhase(tx, "finalize", phaseRun);
    return true;
  }

  await removeGraphileJob(tx, getPhaseJobKey(phaseRun.scanId, phaseRun.attemptId, phaseRun.phase));

  if (phaseRun.phase === "finalize") {
    await requeueFinalizePhase(tx, phaseRun, now);
    return true;
  }

  await failInterruptedPhase(tx, phaseRun, now);
  await continueAfterInterruptedPhase(tx, phaseRun, now);
  return true;
}
