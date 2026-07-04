import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  scanAttempts,
  scanEvents,
  scanResults,
  scans,
} from "../drizzle/schema.ts";
import { db } from "./db.ts";
import type { HttpxRequestProfile } from "./httpx.ts";

type ScanRow = typeof scans.$inferSelect;
type AttemptRow = typeof scanAttempts.$inferSelect;

export type AttemptMeta = {
  requestProfile: HttpxRequestProfile;
  fallbackReason: string | null;
  resultCount: number;
  forbiddenResultCount: number;
};

type ClaimedScan = {
  scan: Pick<ScanRow, "id">;
  attempt: Pick<AttemptRow, "id" | "attemptNumber" | "metaJson">;
};

export type AttemptTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type InterruptedAttemptRecoveryOutcome = "requeued" | "failed" | "not_recoverable";

export function buildAttemptMeta(
  profile: HttpxRequestProfile,
  fallbackReason: string | null,
  resultCount = 0,
  forbiddenResultCount = 0,
): AttemptMeta {
  return {
    requestProfile: profile,
    fallbackReason,
    resultCount,
    forbiddenResultCount,
  };
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

export async function markAttemptFailed(claimedScan: ClaimedScan, errorCode: string, message: string) {
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

export async function markAttemptCancelled(claimedScan: ClaimedScan) {
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

const WORKER_INTERRUPTED_ATTEMPT_MESSAGE =
  "Worker stopped before this attempt completed; recovery requeued the scan.";
const WORKER_INTERRUPTED_RECOVERY_EXHAUSTED_MESSAGE =
  "Worker interruption recovery was exhausted before the scan could complete.";
export const MAX_WORKER_INTERRUPTED_SCAN_RECOVERIES = 3;

export async function markAttemptInterruptedInTransaction(
  tx: AttemptTransaction,
  {
    scanId,
    attemptId,
  }: {
    scanId: string;
    attemptId: string;
  },
): Promise<InterruptedAttemptRecoveryOutcome> {
  const interruptedAt = new Date();
  const interruptedAtIso = interruptedAt.toISOString();
  const [previousInterruptedAttempts] = await tx
    .select({ value: sql<number>`count(*)::int` })
    .from(scanAttempts)
    .where(and(eq(scanAttempts.scanId, scanId), eq(scanAttempts.errorCode, "worker_interrupted")));
  const recoveryExhausted = (previousInterruptedAttempts?.value ?? 0) >= MAX_WORKER_INTERRUPTED_SCAN_RECOVERIES;

  const [updatedScan] = await tx
    .update(scans)
    .set(recoveryExhausted
      ? {
        status: "failed",
        completedAt: interruptedAt,
        errorCode: "worker_interrupted_recovery_exhausted",
        errorMessage: WORKER_INTERRUPTED_RECOVERY_EXHAUSTED_MESSAGE,
      }
      : {
        status: "queued",
        completedAt: null,
        errorCode: null,
        errorMessage: null,
      })
    .where(and(
      eq(scans.id, scanId),
      inArray(scans.status, ["queued", "running", "processing"]),
      isNull(scans.cancellationRequestedAt),
    ))
    .returning({ id: scans.id });

  if (!updatedScan) {
    return "not_recoverable";
  }

  await tx
    .update(scanAttempts)
    .set({
      status: "cancelled",
      completedAt: interruptedAt,
      errorCode: "worker_interrupted",
      errorMessage: WORKER_INTERRUPTED_ATTEMPT_MESSAGE,
      workerId: null,
    })
    .where(and(eq(scanAttempts.id, attemptId), inArray(scanAttempts.status, ["queued", "running", "completed"])));

  if (recoveryExhausted) {
    await tx.insert(scanEvents).values({
      scanId,
      attemptId,
      eventType: "scan.failed",
      payload: {
        scanId,
        status: "failed",
        errorCode: "worker_interrupted_recovery_exhausted",
        message: WORKER_INTERRUPTED_RECOVERY_EXHAUSTED_MESSAGE,
        at: interruptedAtIso,
      },
    });

    return "failed";
  }

  await tx.insert(scanEvents).values({
    scanId,
    attemptId,
    eventType: "scan.status",
    payload: {
      scanId,
      attemptId,
      status: "queued",
      recoveryReason: "worker_interrupted",
      at: interruptedAtIso,
    },
  });

  return "requeued";
}

export async function completeAttemptInTransaction(
  tx: AttemptTransaction,
  claimedScan: ClaimedScan,
  metaPatch: Partial<AttemptMeta>,
) {
  const [resultCounts] = await tx
    .select({
      resultCount: sql<number>`count(*)::int`,
      forbiddenResultCount: sql<number>`count(*) filter (where ${scanResults.statusCode} = 403)::int`,
    })
    .from(scanResults)
    .where(eq(scanResults.attemptId, claimedScan.attempt.id));

  const existingMetaJson = claimedScan.attempt.metaJson ?? {};
  const mergedMetaJson = {
    ...existingMetaJson,
    ...metaPatch,
    resultCount: metaPatch.resultCount ?? resultCounts?.resultCount ?? 0,
    forbiddenResultCount: metaPatch.forbiddenResultCount
      ?? (typeof existingMetaJson.forbiddenResultCount === "number" ? existingMetaJson.forbiddenResultCount : undefined)
      ?? resultCounts?.forbiddenResultCount
      ?? 0,
  };

  const [completedAttempt] = await tx
    .update(scanAttempts)
    .set({
      status: "completed",
      completedAt: new Date(),
      workerId: null,
      metaJson: mergedMetaJson,
    })
    .where(and(eq(scanAttempts.id, claimedScan.attempt.id), inArray(scanAttempts.status, ["queued", "running"])))
    .returning({ id: scanAttempts.id });

  if (completedAttempt) {
    logWorkerEvent("scan_attempt_completed", {
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      attemptNumber: claimedScan.attempt.attemptNumber,
      requestProfile: mergedMetaJson.requestProfile,
      resultCount: mergedMetaJson.resultCount,
      forbiddenResultCount: mergedMetaJson.forbiddenResultCount ?? 0,
    });
  }

  return mergedMetaJson;
}

export async function markAttemptCompleted(claimedScan: ClaimedScan, metaPatch: Partial<AttemptMeta>) {
  return db.transaction(async (tx) => completeAttemptInTransaction(tx, claimedScan, metaPatch));
}

export async function markScanProcessing(claimedScan: ClaimedScan) {
  await db.transaction(async (tx) => {
    await tx
      .update(scans)
      .set({
        status: "processing",
      })
      .where(eq(scans.id, claimedScan.scan.id));

    await tx.insert(scanEvents).values({
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      eventType: "scan.status",
      payload: {
        scanId: claimedScan.scan.id,
        status: "processing",
        attemptId: claimedScan.attempt.id,
        at: new Date().toISOString(),
      },
    });
  });
}

export async function markScanCompleted(claimedScan: ClaimedScan, resultCount: number) {
  await db.transaction(async (tx) => {
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
        resultCount,
        at: new Date().toISOString(),
      },
    });
  });
}

export async function markScanFailedAfterAttemptCompletion(
  claimedScan: ClaimedScan,
  errorCode: string,
  message: string,
) {
  await db.transaction(async (tx) => {
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
