import { createHash } from "node:crypto";

import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { canonicalTargets, scanEvents, scans } from "@/lib/db/schema";
import type { CreateScanRequest } from "@/lib/contracts/scans";
import { createScanResponseSchema } from "@/lib/contracts/scans";
import { enqueueGraphileJob } from "@/lib/server/jobs/graphile";
import type { ActorContext } from "@/lib/session/actor-context";
import { assertCanRunScans } from "@/lib/server/scans/access";
import { normalizeTarget } from "@/lib/server/scans/normalize-targets";

const ACTIVE_SCAN_STATUSES = ["pending", "queued", "running", "processing"] as const;
const DEFAULT_SCAN_PROFILE = "stack-deep";

function getRequestFingerprint(actor: ActorContext, request: CreateScanRequest, normalizedTarget: string) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        userId: actor.user.id,
        target: normalizedTarget,
        options: request.options,
      }),
    )
    .digest("hex");
}

type CreateScanOptions = {
  scheduleId?: string | null;
  scheduledForAt?: Date | null;
  skipActiveReuse?: boolean;
};

export async function createScan(actor: ActorContext, request: CreateScanRequest, options: CreateScanOptions = {}) {
  assertCanRunScans(actor);

  const normalizedTarget = normalizeTarget(request.target);

  const requestFingerprint = getRequestFingerprint(
    actor,
    request,
    normalizedTarget.normalizedTarget,
  );

  if (request.idempotencyKey) {
    const [existingByIdempotencyKey] = await db
      .select({ id: scans.id, status: scans.status })
      .from(scans)
      .where(and(eq(scans.createdByUserId, actor.user.id), eq(scans.idempotencyKey, request.idempotencyKey)))
      .orderBy(desc(scans.submittedAt))
      .limit(1);

    if (existingByIdempotencyKey) {
      return createScanResponseSchema.parse({
        scanId: existingByIdempotencyKey.id,
        status: existingByIdempotencyKey.status,
        reused: true,
      });
    }
  }

  if (!options.skipActiveReuse) {
    const [existingActiveScan] = await db
      .select({ id: scans.id, status: scans.status })
      .from(scans)
      .where(
        and(
          eq(scans.createdByUserId, actor.user.id),
          eq(scans.requestFingerprint, requestFingerprint),
          inArray(scans.status, [...ACTIVE_SCAN_STATUSES]),
        ),
      )
      .orderBy(desc(scans.submittedAt))
      .limit(1);

    if (existingActiveScan) {
      return createScanResponseSchema.parse({
        scanId: existingActiveScan.id,
        status: existingActiveScan.status,
        reused: true,
      });
    }
  }

  const createdScan = await db.transaction(async (tx) => {
    const [scan] = await tx
      .insert(scans)
      .values({
        createdByUserId: actor.user.id,
        createdByApiKeyId: actor.apiKey?.id ?? null,
        scheduleId: options.scheduleId ?? null,
        source: actor.source,
        status: "queued",
        profile: DEFAULT_SCAN_PROFILE,
        idempotencyKey: request.idempotencyKey,
        requestFingerprint,
        canonicalTargetId: null,
        inputTarget: normalizedTarget.inputTarget,
        normalizedTarget: normalizedTarget.normalizedTarget,
        optionsJson: request.options,
        scheduledForAt: options.scheduledForAt ?? null,
      })
      .returning();

    await tx
      .insert(canonicalTargets)
      .values({
        normalizedTarget: normalizedTarget.normalizedTarget,
        targetType: normalizedTarget.targetType,
      })
      .onConflictDoNothing();

    const [canonicalRow] = await tx
      .select()
      .from(canonicalTargets)
      .where(eq(canonicalTargets.normalizedTarget, normalizedTarget.normalizedTarget))
      .limit(1);

    await tx
      .update(scans)
      .set({
        canonicalTargetId: canonicalRow?.id ?? null,
      })
      .where(eq(scans.id, scan.id));

    await tx.insert(scanEvents).values({
      scanId: scan.id,
      attemptId: null,
      eventType: "scan.status",
      payload: {
        scanId: scan.id,
        status: "queued",
        attemptId: scan.id,
        at: new Date().toISOString(),
      },
    });

    await enqueueGraphileJob(
      tx,
      "http_probe",
      {
        scanId: scan.id,
      },
      {
        jobKey: `scan:${scan.id}:http_probe`,
        jobKeyMode: "preserve_run_at",
        runAt: scan.submittedAt,
      },
    );

    return scan;
  });

  return createScanResponseSchema.parse({
    scanId: createdScan.id,
    status: createdScan.status,
    reused: false,
  });
}
