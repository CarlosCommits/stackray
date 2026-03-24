import { createHash } from "node:crypto";

import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { canonicalTargets, scanEvents, scanTargets, scans } from "@/lib/db/schema";
import type { CreateScanRequest } from "@/lib/contracts/scans";
import { createScanResponseSchema } from "@/lib/contracts/scans";
import type { ActorContext } from "@/lib/server/actor-context";
import { normalizeTargets } from "@/lib/server/scans/normalize-targets";

const ACTIVE_SCAN_STATUSES = ["pending", "queued", "running", "processing"] as const;

function getRequestFingerprint(actor: ActorContext, request: CreateScanRequest, normalizedTargets: readonly string[]) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        workspaceId: actor.workspace.id,
        targets: normalizedTargets,
        profile: request.profile,
        options: request.options,
      }),
    )
    .digest("hex");
}

export async function createWorkspaceScan(actor: ActorContext, request: CreateScanRequest) {
  const normalizedTargets = normalizeTargets(request.targets);

  if (normalizedTargets.length === 0) {
    throw new Error("At least one valid public target is required.");
  }

  const requestFingerprint = getRequestFingerprint(
    actor,
    request,
    normalizedTargets.map((target) => target.normalizedTarget),
  );

  if (request.idempotencyKey) {
    const [existingByIdempotencyKey] = await db
      .select({ id: scans.id, status: scans.status })
      .from(scans)
      .where(and(eq(scans.workspaceId, actor.workspace.id), eq(scans.idempotencyKey, request.idempotencyKey)))
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

  const [existingActiveScan] = await db
    .select({ id: scans.id, status: scans.status })
    .from(scans)
    .where(
      and(
        eq(scans.workspaceId, actor.workspace.id),
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

  const createdScan = await db.transaction(async (tx) => {
    const [scan] = await tx
      .insert(scans)
      .values({
        workspaceId: actor.workspace.id,
        createdByUserId: actor.user.id,
        source: request.client.source,
        status: "queued",
        profile: request.profile,
        idempotencyKey: request.idempotencyKey,
        requestFingerprint,
        optionsJson: request.options,
        targetCount: normalizedTargets.length,
      })
      .returning();

    await tx
      .insert(canonicalTargets)
      .values(
        normalizedTargets.map((target) => ({
          workspaceId: actor.workspace.id,
          normalizedTarget: target.normalizedTarget,
          targetType: target.targetType,
        })),
      )
      .onConflictDoNothing();

    const canonicalRows = await tx
      .select()
      .from(canonicalTargets)
      .where(
        and(
          eq(canonicalTargets.workspaceId, actor.workspace.id),
          inArray(
            canonicalTargets.normalizedTarget,
            normalizedTargets.map((target) => target.normalizedTarget),
          ),
        ),
      );

    const canonicalTargetIdByNormalizedTarget = new Map(
      canonicalRows.map((row) => [row.normalizedTarget, row.id]),
    );

    await tx.insert(scanTargets).values(
      normalizedTargets.map((target, index) => ({
        scanId: scan.id,
        canonicalTargetId: canonicalTargetIdByNormalizedTarget.get(target.normalizedTarget) ?? null,
        inputTarget: target.inputTarget,
        normalizedTarget: target.normalizedTarget,
        sortOrder: index,
      })),
    );

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

    return scan;
  });

  return createScanResponseSchema.parse({
    scanId: createdScan.id,
    status: createdScan.status,
    reused: false,
  });
}
