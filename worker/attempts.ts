import { eq, sql } from "drizzle-orm";

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

export async function markAttemptCompleted(claimedScan: ClaimedScan, metaPatch: Partial<AttemptMeta>) {
  const [resultCount] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(scanResults)
    .where(eq(scanResults.attemptId, claimedScan.attempt.id));

  const mergedMetaJson = {
    ...(claimedScan.attempt.metaJson ?? {}),
    ...metaPatch,
    resultCount: metaPatch.resultCount ?? resultCount?.value ?? 0,
  };

  await db.transaction(async (tx) => {
    await tx
      .update(scanAttempts)
      .set({
        status: "completed",
        completedAt: new Date(),
        metaJson: mergedMetaJson,
      })
      .where(eq(scanAttempts.id, claimedScan.attempt.id));
  });

  logWorkerEvent("scan_attempt_completed", {
    scanId: claimedScan.scan.id,
    attemptId: claimedScan.attempt.id,
    attemptNumber: claimedScan.attempt.attemptNumber,
    requestProfile: mergedMetaJson.requestProfile,
    resultCount: mergedMetaJson.resultCount,
    forbiddenResultCount: mergedMetaJson.forbiddenResultCount ?? 0,
  });

  return mergedMetaJson;
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
