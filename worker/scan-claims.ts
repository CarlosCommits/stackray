import { and, asc, eq, sql } from "drizzle-orm";

import {
  scanAttempts,
  scanEvents,
  scanPhaseRuns,
  scanResults,
  scans,
} from "../drizzle/schema.ts";
import { buildAttemptMeta } from "./attempts.ts";
import { db } from "./db.ts";
import type { HttpxRequestProfile } from "./httpx.ts";
import { getWorkerId } from "./phase-runs.ts";
import { getHttpProbeScanJobKey } from "./queue.ts";

type ScanRow = typeof scans.$inferSelect;
type AttemptRow = typeof scanAttempts.$inferSelect;

export type ClaimedScan = {
  scan: ScanRow;
  attempt: AttemptRow;
  target: Pick<ScanRow, "inputTarget" | "normalizedTarget" | "canonicalTargetId">;
};

const SCAN_QUEUE_RELATIONS = ["scans", "scan_attempts", "scan_events"];

function isMissingScanQueueRelationMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("relation") &&
    normalizedMessage.includes("does not exist") &&
    SCAN_QUEUE_RELATIONS.some((relationName) => normalizedMessage.includes(relationName))
  );
}

export function isMissingScanQueueSchemaError(error: unknown) {
  let currentError: unknown = error;

  while (currentError instanceof Error) {
    const postgresError = currentError as Error & { cause?: unknown; code?: string };

    if (
      (postgresError.code === undefined || postgresError.code === "42P01") &&
      isMissingScanQueueRelationMessage(currentError.message)
    ) {
      return true;
    }

    currentError = postgresError.cause;
  }

  return false;
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

async function insertHttpProbeAttemptState({
  tx,
  scan,
  attempt,
  requestProfile,
  fallbackReason,
}: {
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0];
  scan: ScanRow;
  attempt: AttemptRow;
  requestProfile: HttpxRequestProfile;
  fallbackReason: string | null;
}) {
  const now = new Date();
  const queuedAtIso = now.toISOString();
  const phaseMeta = fallbackReason ? { requestProfile, fallbackReason } : {};
  const [httpProbePhase] = await tx
    .insert(scanPhaseRuns)
    .values({
      scanId: scan.id,
      attemptId: attempt.id,
      phase: "http_probe",
      status: "queued",
      jobKey: getHttpProbeScanJobKey(scan.id),
      metaJson: phaseMeta,
      queuedAt: now,
      updatedAt: now,
    })
    .returning();

  await tx.insert(scanEvents).values({
    scanId: scan.id,
    attemptId: attempt.id,
    eventType: "scan.status",
    payload: {
      scanId: scan.id,
      status: "running",
      attemptId: attempt.id,
      requestProfile,
      ...(fallbackReason ? { fallbackReason } : {}),
      at: new Date().toISOString(),
    },
  });

  if (!httpProbePhase) {
    return;
  }

  await tx.insert(scanEvents).values({
    scanId: scan.id,
    attemptId: attempt.id,
    eventType: "scan.phase",
    payload: {
      scanId: scan.id,
      attemptId: attempt.id,
      resultId: null,
      phase: "http_probe",
      status: "queued",
      errorCode: null,
      errorMessage: null,
      meta: phaseMeta,
      queuedAt: queuedAtIso,
      startedAt: null,
      completedAt: null,
      at: queuedAtIso,
    },
  });
}

async function createInitialAttempt(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], scan: ScanRow) {
  const [attemptCount] = await tx
    .select({ value: sql<number>`count(*)::int` })
    .from(scanAttempts)
    .where(eq(scanAttempts.scanId, scan.id));

  const [attempt] = await tx
    .insert(scanAttempts)
    .values({
      scanId: scan.id,
      attemptNumber: (attemptCount?.value ?? 0) + 1,
      workerId: getWorkerId(),
      status: "running",
      startedAt: new Date(),
      metaJson: buildAttemptMeta("baseline", null),
    })
    .returning();

  await insertHttpProbeAttemptState({
    tx,
    scan,
    attempt,
    requestProfile: "baseline",
    fallbackReason: null,
  });

  logWorkerEvent("scan_attempt_started", {
    scanId: scan.id,
    attemptId: attempt.id,
    attemptNumber: attempt.attemptNumber,
    requestProfile: "baseline",
    target: scan.normalizedTarget,
  });

  return attempt;
}

export async function claimNextQueuedScan(): Promise<ClaimedScan | null> {
  try {
    const [queuedScan] = await db
      .select()
      .from(scans)
      .where(eq(scans.status, "queued"))
      .orderBy(asc(scans.submittedAt), asc(scans.id))
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

      const attempt = await createInitialAttempt(tx, claimedScan);

      return {
        scan: claimedScan,
        attempt,
        target: {
          inputTarget: claimedScan.inputTarget,
          normalizedTarget: claimedScan.normalizedTarget,
          canonicalTargetId: claimedScan.canonicalTargetId,
        },
      } satisfies ClaimedScan;
    });
  } catch (error) {
    if (!isMissingScanQueueSchemaError(error)) {
      throw error;
    }

    return null;
  }
}

export async function claimQueuedScanById(scanId: string): Promise<ClaimedScan | null> {
  try {
    return db.transaction(async (tx) => {
      const [claimedScan] = await tx
        .update(scans)
        .set({
          status: "running",
          startedAt: new Date(),
        })
        .where(and(eq(scans.id, scanId), eq(scans.status, "queued")))
        .returning();

      if (!claimedScan) {
        return null;
      }

      const attempt = await createInitialAttempt(tx, claimedScan);

      return {
        scan: claimedScan,
        attempt,
        target: {
          inputTarget: claimedScan.inputTarget,
          normalizedTarget: claimedScan.normalizedTarget,
          canonicalTargetId: claimedScan.canonicalTargetId,
        },
      } satisfies ClaimedScan;
    });
  } catch (error) {
    if (!isMissingScanQueueSchemaError(error)) {
      throw error;
    }

    return null;
  }
}

export async function createFallbackAttempt(
  claimedScan: ClaimedScan,
  profile: HttpxRequestProfile,
  fallbackReason: string,
): Promise<ClaimedScan> {
  return db.transaction(async (tx) => {
    const [attemptCount] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(scanAttempts)
      .where(eq(scanAttempts.scanId, claimedScan.scan.id));

    const [attempt] = await tx
      .insert(scanAttempts)
      .values({
        scanId: claimedScan.scan.id,
        attemptNumber: (attemptCount?.value ?? 0) + 1,
        workerId: getWorkerId(),
        status: "running",
        startedAt: new Date(),
        metaJson: buildAttemptMeta(profile, fallbackReason),
      })
      .returning();

    await insertHttpProbeAttemptState({
      tx,
      scan: claimedScan.scan,
      attempt,
      requestProfile: profile,
      fallbackReason,
    });

    logWorkerEvent("scan_fallback_started", {
      scanId: claimedScan.scan.id,
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      requestProfile: profile,
      fallbackReason,
    });

    return {
      scan: claimedScan.scan,
      attempt,
      target: claimedScan.target,
    } satisfies ClaimedScan;
  });
}

export async function getClaimedScanForAttempt(scanId: string, attemptId: string): Promise<ClaimedScan | null> {
  const [scan] = await db
    .select()
    .from(scans)
    .where(eq(scans.id, scanId))
    .limit(1);

  if (!scan) {
    return null;
  }

  const [attempt] = await db
    .select()
    .from(scanAttempts)
    .where(and(eq(scanAttempts.id, attemptId), eq(scanAttempts.scanId, scanId)))
    .limit(1);

  if (!attempt) {
    return null;
  }

  return {
    scan,
    attempt,
    target: {
      inputTarget: scan.inputTarget,
      normalizedTarget: scan.normalizedTarget,
      canonicalTargetId: scan.canonicalTargetId,
    },
  } satisfies ClaimedScan;
}

export async function getScanResultForPhase(scanId: string, attemptId: string, resultId: string) {
  const [result] = await db
    .select()
    .from(scanResults)
    .where(and(eq(scanResults.id, resultId), eq(scanResults.scanId, scanId), eq(scanResults.attemptId, attemptId)))
    .limit(1);

  return result ?? null;
}
