import { and, eq } from "drizzle-orm";

import {
  scanEvents,
  scanPhaseRuns,
} from "../drizzle/schema.ts";
import { db } from "./db.ts";
import { getPhaseJobKey, type ScanPhaseKind } from "./queue.ts";

export type ScanPhaseStatus = typeof scanPhaseRuns.$inferInsert.status;

export const TERMINAL_PHASE_STATUSES = new Set<ScanPhaseStatus>(["completed", "failed", "skipped", "cancelled"]);

export function getWorkerId() {
  return `graphile-worker:${process.pid}`;
}

async function emitPhaseEvent(phaseRun: typeof scanPhaseRuns.$inferSelect) {
  await db.insert(scanEvents).values({
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
      at: new Date().toISOString(),
    },
  });
}

function normalizePhaseMetaForComparison(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizePhaseMetaForComparison);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, entry]) => [key, normalizePhaseMetaForComparison(entry)]),
    );
  }

  return value;
}

export function phaseMetaEquals(left: unknown, right: unknown) {
  return JSON.stringify(normalizePhaseMetaForComparison(left)) === JSON.stringify(normalizePhaseMetaForComparison(right));
}

function dateTimeEquals(left: Date | null, right: Date | null) {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null);
}

export function phaseRunStateEquals(
  existing: typeof scanPhaseRuns.$inferSelect,
  next: {
    resultId: string | null;
    status: ScanPhaseStatus;
    workerId: string | null;
    jobKey: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    metaJson: Record<string, unknown>;
    startedAt: Date | null;
    completedAt: Date | null;
  },
) {
  return existing.resultId === next.resultId
    && existing.status === next.status
    && existing.workerId === next.workerId
    && existing.jobKey === next.jobKey
    && existing.errorCode === next.errorCode
    && existing.errorMessage === next.errorMessage
    && dateTimeEquals(existing.startedAt, next.startedAt)
    && dateTimeEquals(existing.completedAt, next.completedAt)
    && phaseMetaEquals(existing.metaJson, next.metaJson);
}

export async function upsertPhaseRun({
  scanId,
  attemptId,
  resultId = null,
  phase,
  status,
  errorCode = null,
  errorMessage = null,
  metaJson = {},
  jobKey = getPhaseJobKey(scanId, attemptId, phase),
}: {
  scanId: string;
  attemptId: string;
  resultId?: string | null;
  phase: ScanPhaseKind;
  status: ScanPhaseStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  metaJson?: Record<string, unknown>;
  jobKey?: string | null;
}) {
  const now = new Date();
  const [existing] = await db
    .select()
    .from(scanPhaseRuns)
    .where(and(eq(scanPhaseRuns.attemptId, attemptId), eq(scanPhaseRuns.phase, phase)))
    .limit(1);
  const startedAt = status === "running"
    ? existing?.status === "running"
      ? existing.startedAt ?? now
      : now
    : TERMINAL_PHASE_STATUSES.has(status)
      ? existing?.startedAt ?? null
      : null;
  const completedAt = TERMINAL_PHASE_STATUSES.has(status)
    ? existing?.status === status && TERMINAL_PHASE_STATUSES.has(existing.status)
      ? existing.completedAt ?? now
      : now
    : null;
  const workerId = status === "running"
    ? getWorkerId()
    : TERMINAL_PHASE_STATUSES.has(status)
      ? existing?.workerId ?? null
      : null;
  const preservedRecoveryCount =
    typeof existing?.metaJson?.recoveryCount === "number" && !("recoveryCount" in metaJson)
      ? { recoveryCount: existing.metaJson.recoveryCount }
      : {};
  const nextMetaJson = {
    ...preservedRecoveryCount,
    ...metaJson,
  };

  if (existing && TERMINAL_PHASE_STATUSES.has(existing.status)) {
    return existing;
  }

  const nextPhaseRunState = {
    resultId,
    status,
    workerId,
    jobKey,
    errorCode,
    errorMessage,
    metaJson: nextMetaJson,
    startedAt,
    completedAt,
  };

  if (existing && phaseRunStateEquals(existing, nextPhaseRunState)) {
    return existing;
  }

  const [phaseRun] = existing
    ? await db
      .update(scanPhaseRuns)
      .set({
        ...nextPhaseRunState,
        updatedAt: now,
      })
      .where(eq(scanPhaseRuns.id, existing.id))
      .returning()
    : await db
      .insert(scanPhaseRuns)
      .values({
        scanId,
        attemptId,
        resultId,
        phase,
        status,
        workerId,
        jobKey,
        errorCode,
        errorMessage,
        metaJson: nextMetaJson,
        startedAt,
        completedAt,
        queuedAt: now,
        updatedAt: now,
      })
      .returning();

  if (phaseRun) {
    await emitPhaseEvent(phaseRun);
  }

  return phaseRun ?? null;
}

export async function markPhaseRunning(scanId: string, attemptId: string, phase: ScanPhaseKind, resultId?: string | null, metaJson?: Record<string, unknown>) {
  return upsertPhaseRun({ scanId, attemptId, resultId, phase, status: "running", metaJson });
}

export async function markPhaseCompleted(scanId: string, attemptId: string, phase: ScanPhaseKind, resultId?: string | null, metaJson?: Record<string, unknown>) {
  return upsertPhaseRun({ scanId, attemptId, resultId, phase, status: "completed", metaJson });
}

export async function markPhaseSkipped(scanId: string, attemptId: string, phase: ScanPhaseKind, reason: string, resultId?: string | null) {
  return upsertPhaseRun({
    scanId,
    attemptId,
    resultId,
    phase,
    status: "skipped",
    errorMessage: reason,
    metaJson: { reason },
  });
}

export async function markPhaseFailed(
  scanId: string,
  attemptId: string,
  phase: ScanPhaseKind,
  error: unknown,
  resultId?: string | null,
  metaJson?: Record<string, unknown>,
) {
  const message = error instanceof Error ? error.message : String(error);

  return upsertPhaseRun({
    scanId,
    attemptId,
    resultId,
    phase,
    status: "failed",
    errorCode: "phase_failed",
    errorMessage: message,
    metaJson: { ...metaJson, message },
  });
}
