import { createHash } from "node:crypto";

import { and, asc, eq, inArray, lte } from "drizzle-orm";

import {
  canonicalTargets,
  scanEvents,
  scanScheduleRuns,
  scanSchedules,
  scanScheduleTargets,
  scanTargets,
  scans,
  users,
} from "../drizzle/schema.ts";
import { enqueueGraphileJob } from "../lib/server/jobs/graphile.ts";
import { normalizeTargets } from "../lib/server/scans/normalize-targets.ts";
import {
  getCollapsedDueScheduleSlot,
  type ScheduleRecurrenceInput,
} from "../lib/server/schedules/recurrence.ts";
import { db } from "./db.ts";

const ACTIVE_SCAN_STATUSES = ["pending", "queued", "running", "processing"] as const;
const DEFAULT_DISPATCH_BATCH_SIZE = 25;
const DEFAULT_SCAN_PROFILE = "stack-deep";

type WorkerTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function toRecurrenceInput(schedule: {
  frequency: ScheduleRecurrenceInput["frequency"];
  hour: number;
  minute: number;
  weekday: number | null;
  dayOfMonth: number | null;
  timezone: string;
}): ScheduleRecurrenceInput {
  return {
    frequency: schedule.frequency,
    hour: schedule.hour,
    minute: schedule.minute,
    weekday: schedule.weekday,
    dayOfMonth: schedule.dayOfMonth,
    timezone: schedule.timezone,
  };
}

function getRequestFingerprint(
  userId: string,
  targets: readonly string[],
  options: Record<string, unknown>,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        userId,
        targets,
        options,
      }),
    )
    .digest("hex");
}

async function createScheduledScan(
  tx: WorkerTransaction,
  ownerUserId: string,
  scheduleId: string,
  scheduledForAt: Date,
  inputTargets: readonly string[],
  options: Record<string, unknown>,
) {
  const idempotencyKey = `schedule:${scheduleId}:${scheduledForAt.toISOString()}`;
  const normalizedTargets = normalizeTargets(inputTargets);

  if (normalizedTargets.length === 0) {
    throw new Error("Scheduled scans require at least one valid public target.");
  }

  const requestFingerprint = getRequestFingerprint(
    ownerUserId,
    normalizedTargets.map((target) => target.normalizedTarget),
    options,
  );

  const [existingScan] = await tx
    .select({ id: scans.id, status: scans.status })
    .from(scans)
    .where(and(eq(scans.scheduleId, scheduleId), eq(scans.scheduledForAt, scheduledForAt)))
    .limit(1);

  if (existingScan) {
    return existingScan;
  }

  const [existingByIdempotencyKey] = await tx
    .select({ id: scans.id, status: scans.status })
    .from(scans)
    .where(eq(scans.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existingByIdempotencyKey) {
    return existingByIdempotencyKey;
  }

  const [scan] = await tx
    .insert(scans)
    .values({
      createdByUserId: ownerUserId,
      createdByTokenId: null,
      scheduleId,
      source: "system",
      status: "queued",
      profile: DEFAULT_SCAN_PROFILE,
      idempotencyKey,
      requestFingerprint,
      optionsJson: options,
      targetCount: normalizedTargets.length,
      scheduledForAt,
    })
    .returning();

  await tx
    .insert(canonicalTargets)
    .values(
      normalizedTargets.map((target) => ({
        normalizedTarget: target.normalizedTarget,
        targetType: target.targetType,
      })),
    )
    .onConflictDoNothing();

  const canonicalRows = await tx
    .select()
    .from(canonicalTargets)
    .where(
      inArray(
        canonicalTargets.normalizedTarget,
        normalizedTargets.map((target) => target.normalizedTarget),
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

  await enqueueGraphileJob(
    tx,
    "run_scan",
    { scanId: scan.id },
    {
      jobKey: `scan:${scan.id}`,
      jobKeyMode: "preserve_run_at",
    },
  );

  return {
    id: scan.id,
    status: scan.status,
  };
}

async function processOneDueSchedule(now: Date) {
  return db.transaction(async (tx) => {
    const [schedule] = await tx
      .select({
        id: scanSchedules.id,
        createdByUserId: scanSchedules.createdByUserId,
        frequency: scanSchedules.frequency,
        hour: scanSchedules.hour,
        minute: scanSchedules.minute,
        weekday: scanSchedules.weekday,
        dayOfMonth: scanSchedules.dayOfMonth,
        timezone: scanSchedules.timezone,
        nextRunAt: scanSchedules.nextRunAt,
        optionsJson: scanSchedules.optionsJson,
      })
      .from(scanSchedules)
      .where(and(eq(scanSchedules.enabled, true), lte(scanSchedules.nextRunAt, now)))
      .orderBy(asc(scanSchedules.nextRunAt))
      .limit(1)
      .for("update", { skipLocked: true });

    if (!schedule) {
      return false;
    }

    const collapsed = getCollapsedDueScheduleSlot(
      toRecurrenceInput({
        frequency: schedule.frequency,
        hour: schedule.hour,
        minute: schedule.minute,
        weekday: schedule.weekday,
        dayOfMonth: schedule.dayOfMonth,
        timezone: schedule.timezone,
      }),
      schedule.nextRunAt,
      now,
    );

    if (!collapsed) {
      return false;
    }

    const [owner] = await tx
      .select({
        id: users.id,
        role: users.role,
        banned: users.banned,
        deactivatedAt: users.deactivatedAt,
      })
      .from(users)
      .where(eq(users.id, schedule.createdByUserId))
      .limit(1);

    const targets = await tx
      .select()
      .from(scanScheduleTargets)
      .where(eq(scanScheduleTargets.scheduleId, schedule.id));

    const finalize = async (
      values:
        | {
            scanId: string;
            status: "queued";
            queuedAt: Date;
            skipReason?: null;
            errorMessage?: null;
          }
        | {
            scanId?: null;
            status: "skipped";
            queuedAt?: null;
            skipReason: string;
            errorMessage?: null;
          }
        | {
            scanId?: null;
            status: "failed";
            queuedAt?: null;
            skipReason?: null;
            errorMessage: string;
          },
    ) => {
      await tx
        .insert(scanScheduleRuns)
        .values({
          scheduleId: schedule.id,
          scanId: values.scanId ?? null,
          status: values.status,
          scheduledForAt: collapsed.scheduledForAt,
          queuedAt: values.queuedAt ?? null,
          skipReason: values.skipReason ?? null,
          errorMessage: values.errorMessage ?? null,
        })
        .onConflictDoNothing();

      await tx
        .update(scanSchedules)
        .set({
          nextRunAt: collapsed.nextRunAt,
          updatedAt: now,
        })
        .where(eq(scanSchedules.id, schedule.id));
    };

    if (!owner || owner.banned || owner.deactivatedAt || owner.role === "viewer") {
      await finalize({
        status: "failed",
        errorMessage: "The schedule owner could not be resolved.",
      });
      return true;
    }

    if (targets.length === 0) {
      await finalize({
        status: "failed",
        errorMessage: "The schedule definition has no targets.",
      });
      return true;
    }

    const [activeScan] = await tx
      .select({ id: scans.id })
      .from(scans)
      .where(and(eq(scans.scheduleId, schedule.id), inArray(scans.status, [...ACTIVE_SCAN_STATUSES])))
      .limit(1);

    if (activeScan) {
      await finalize({
        status: "skipped",
        skipReason: "Skipped because a previous scheduled scan is still active.",
      });
      return true;
    }

    try {
      const scan = await createScheduledScan(
        tx,
        owner.id,
        schedule.id,
        collapsed.scheduledForAt,
        [...targets].sort((left, right) => left.sortOrder - right.sortOrder).map((target) => target.inputTarget),
        schedule.optionsJson as Record<string, unknown>,
      );

      await finalize({
        scanId: scan.id,
        status: "queued",
        queuedAt: now,
      });
      return true;
    } catch (error) {
      await finalize({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Failed to create the scheduled scan.",
      });
      return true;
    }
  });
}

export async function dispatchDueSchedules(now = new Date()) {
  let processed = 0;

  while (processed < DEFAULT_DISPATCH_BATCH_SIZE) {
    const didProcess = await processOneDueSchedule(now);

    if (!didProcess) {
      break;
    }

    processed += 1;
  }

  return processed;
}
