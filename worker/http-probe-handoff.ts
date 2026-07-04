import { and, eq } from "drizzle-orm";

import {
  scanAttempts,
  scanEvents,
  scanPhaseRuns,
  scans,
} from "../drizzle/schema.ts";
import { enqueueGraphileJob } from "../lib/server/jobs/graphile.ts";
import {
  completeAttemptInTransaction,
  type AttemptMeta,
  type AttemptTransaction,
} from "./attempts.ts";
import { getPhaseJobKey, type ScanPhaseKind } from "./queue.ts";
import { resolveGraphileJobFlags } from "./worker-config.ts";

const RESULT_PHASES_AFTER_HTTP_PROBE = ["headless", "browser_fallback", "nuclei_dns", "nuclei_http", "ip_intel"] as const satisfies readonly ScanPhaseKind[];
const IMMEDIATE_PHASES_AFTER_HTTP_PROBE = ["subfinder", "headless", "finalize"] as const satisfies readonly ScanPhaseKind[];
const NO_AUTHORITATIVE_RESULT_REASON = "No authoritative HTTP result was selected.";
const TERMINAL_PHASE_STATUSES = new Set(["completed", "failed", "skipped", "cancelled"]);

type PhaseRow = typeof scanPhaseRuns.$inferSelect;
type HandoffClaimedScan = {
  readonly scan: Pick<typeof scans.$inferSelect, "id">;
  readonly attempt: Pick<typeof scanAttempts.$inferSelect, "id" | "attemptNumber" | "metaJson">;
};
type DesiredPhaseState = {
  readonly scanId: string;
  readonly attemptId: string;
  readonly resultId: string | null;
  readonly phase: ScanPhaseKind;
  readonly status: "queued" | "skipped";
  readonly reason?: string | null;
  readonly now: Date;
};

function phaseMetaEquals(left: unknown, right: unknown) {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}

function phaseNeedsUpdate(existing: PhaseRow, next: {
  readonly resultId: string | null;
  readonly status: "queued" | "skipped";
  readonly jobKey: string;
  readonly errorMessage: string | null;
  readonly metaJson: Record<string, unknown>;
}) {
  return existing.resultId !== next.resultId
    || existing.status !== next.status
    || existing.jobKey !== next.jobKey
    || existing.errorCode !== null
    || existing.errorMessage !== next.errorMessage
    || !phaseMetaEquals(existing.metaJson, next.metaJson)
    || (next.status === "queued" && existing.completedAt !== null)
    || (next.status === "skipped" && existing.completedAt === null);
}

async function emitPhaseEvent(tx: AttemptTransaction, phaseRun: {
  readonly scanId: string;
  readonly attemptId: string;
  readonly resultId: string | null;
  readonly phase: ScanPhaseKind;
  readonly status: "queued" | "skipped";
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly metaJson: Record<string, unknown>;
  readonly queuedAt: Date;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
}, now: Date) {
  await tx.insert(scanEvents).values({
    scanId: phaseRun.scanId,
    attemptId: phaseRun.attemptId,
    eventType: "scan.phase",
    payload: {
      scanId: phaseRun.scanId,
      attemptId: phaseRun.attemptId,
      resultId: phaseRun.resultId,
      phase: phaseRun.phase,
      status: phaseRun.status,
      errorCode: phaseRun.errorCode,
      errorMessage: phaseRun.errorMessage,
      meta: phaseRun.metaJson,
      queuedAt: phaseRun.queuedAt.toISOString(),
      startedAt: phaseRun.startedAt?.toISOString() ?? null,
      completedAt: phaseRun.completedAt?.toISOString() ?? null,
      at: now.toISOString(),
    },
  });
}

async function ensurePhaseState(
  tx: AttemptTransaction,
  existingPhaseByKind: Map<ScanPhaseKind, PhaseRow>,
  desired: DesiredPhaseState,
) {
  const existing = existingPhaseByKind.get(desired.phase);

  if (existing && TERMINAL_PHASE_STATUSES.has(existing.status)) {
    return existing.status;
  }

  const jobKey = getPhaseJobKey(desired.scanId, desired.attemptId, desired.phase);
  const errorMessage = desired.reason ?? null;
  const metaJson = desired.reason ? { reason: desired.reason } : {};
  const completedAt = desired.status === "skipped" ? desired.now : null;

  if (!existing) {
    await tx.insert(scanPhaseRuns).values({
      scanId: desired.scanId,
      attemptId: desired.attemptId,
      resultId: desired.resultId,
      phase: desired.phase,
      status: desired.status,
      workerId: null,
      jobKey,
      errorCode: null,
      errorMessage,
      metaJson,
      queuedAt: desired.now,
      startedAt: null,
      completedAt,
      updatedAt: desired.now,
    });
    await emitPhaseEvent(tx, {
      scanId: desired.scanId,
      attemptId: desired.attemptId,
      resultId: desired.resultId,
      phase: desired.phase,
      status: desired.status,
      errorCode: null,
      errorMessage,
      metaJson,
      queuedAt: desired.now,
      startedAt: null,
      completedAt,
    }, desired.now);
    existingPhaseByKind.set(desired.phase, {
      id: "",
      scanId: desired.scanId,
      attemptId: desired.attemptId,
      resultId: desired.resultId,
      phase: desired.phase,
      status: desired.status,
      workerId: null,
      jobKey,
      errorCode: null,
      errorMessage,
      metaJson,
      queuedAt: desired.now,
      startedAt: null,
      completedAt,
      updatedAt: desired.now,
    });
    return desired.status;
  }

  if (existing.status === "running") {
    return existing.status;
  }

  const nextPhaseRun = {
    resultId: desired.resultId,
    status: desired.status,
    jobKey,
    errorMessage,
    metaJson,
  };

  if (!phaseNeedsUpdate(existing, nextPhaseRun)) {
    return existing.status;
  }

  await tx
    .update(scanPhaseRuns)
    .set({
      resultId: desired.resultId,
      status: desired.status,
      workerId: null,
      jobKey,
      errorCode: null,
      errorMessage,
      metaJson,
      startedAt: desired.status === "queued" ? null : existing.startedAt,
      completedAt,
      updatedAt: desired.now,
    })
    .where(eq(scanPhaseRuns.id, existing.id));
  await emitPhaseEvent(tx, {
    scanId: existing.scanId,
    attemptId: existing.attemptId,
    resultId: desired.resultId,
    phase: existing.phase,
    status: desired.status,
    errorCode: null,
    errorMessage,
    metaJson,
    queuedAt: existing.queuedAt,
    startedAt: desired.status === "queued" ? null : existing.startedAt,
    completedAt,
  }, desired.now);
  existingPhaseByKind.set(desired.phase, {
    ...existing,
    resultId: desired.resultId,
    status: desired.status,
    workerId: null,
    jobKey,
    errorCode: null,
    errorMessage,
    metaJson,
    startedAt: desired.status === "queued" ? null : existing.startedAt,
    completedAt,
    updatedAt: desired.now,
  });

  return desired.status;
}

async function enqueueImmediatePhase(
  tx: AttemptTransaction,
  phase: ScanPhaseKind,
  payload: Record<string, unknown>,
  scanId: string,
  attemptId: string,
) {
  await enqueueGraphileJob(tx, phase, payload, {
    flags: resolveGraphileJobFlags(),
    jobKey: getPhaseJobKey(scanId, attemptId, phase),
    jobKeyMode: "replace",
  });
}

export async function ensureCompletedHttpProbeHandoff(
  tx: AttemptTransaction,
  claimedScan: HandoffClaimedScan,
  {
    authoritativeResultId,
    attemptMetaPatch = {},
  }: {
    authoritativeResultId: string | null;
    attemptMetaPatch?: Partial<AttemptMeta>;
  },
) {
  const now = new Date();
  const scanId = claimedScan.scan.id;
  const attemptId = claimedScan.attempt.id;
  const existingPhases = await tx
    .select()
    .from(scanPhaseRuns)
    .where(and(eq(scanPhaseRuns.attemptId, attemptId), eq(scanPhaseRuns.scanId, scanId)));
  const existingPhaseByKind = new Map(existingPhases.map((phaseRun) => [phaseRun.phase, phaseRun]));

  await completeAttemptInTransaction(tx, claimedScan, attemptMetaPatch);

  const subfinderStatus = await ensurePhaseState(tx, existingPhaseByKind, {
    scanId,
    attemptId,
    resultId: null,
    phase: "subfinder",
    status: "queued",
    now,
  });

  if (subfinderStatus === "queued") {
    await enqueueImmediatePhase(tx, "subfinder", { scanId, attemptId }, scanId, attemptId);
  }

  if (authoritativeResultId) {
    const headlessStatus = await ensurePhaseState(tx, existingPhaseByKind, {
      scanId,
      attemptId,
      resultId: authoritativeResultId,
      phase: "headless",
      status: "queued",
      now,
    });

    if (headlessStatus === "queued") {
      await enqueueImmediatePhase(tx, "headless", { scanId, attemptId, resultId: authoritativeResultId }, scanId, attemptId);
    }

    for (const phase of RESULT_PHASES_AFTER_HTTP_PROBE) {
      if (phase === "headless") {
        continue;
      }

      await ensurePhaseState(tx, existingPhaseByKind, {
        scanId,
        attemptId,
        resultId: authoritativeResultId,
        phase,
        status: "queued",
        now,
      });
    }
  } else {
    for (const phase of RESULT_PHASES_AFTER_HTTP_PROBE) {
      await ensurePhaseState(tx, existingPhaseByKind, {
        scanId,
        attemptId,
        resultId: null,
        phase,
        status: "skipped",
        reason: NO_AUTHORITATIVE_RESULT_REASON,
        now,
      });
    }
  }

  const finalizeStatus = await ensurePhaseState(tx, existingPhaseByKind, {
    scanId,
    attemptId,
    resultId: null,
    phase: "finalize",
    status: "queued",
    now,
  });

  if (finalizeStatus === "queued") {
    await enqueueImmediatePhase(tx, "finalize", { scanId, attemptId }, scanId, attemptId);
  }

  return {
    immediatePhases: IMMEDIATE_PHASES_AFTER_HTTP_PROBE,
  };
}
