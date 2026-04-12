import { and, desc, eq, inArray } from "drizzle-orm";

import {
  createScheduleResponseSchema,
  deleteScheduleResponseSchema,
  listSchedulesResponseSchema,
  type CreateScheduleRequest,
  type UpdateScheduleContentRequest,
  type UpdateScheduleRequest,
  updateScheduleResponseSchema,
} from "@/lib/contracts/schedules";
import { db } from "@/lib/db/client";
import {
  canonicalTargets,
  scans,
  scanScheduleRuns,
  scanSchedules,
  scanScheduleTargets,
} from "@/lib/db/schema";
import type { ActorContext } from "@/lib/session/actor-context";
import { isAdmin } from "@/lib/authorization/authz";
import { assertCanRunScans } from "@/lib/server/scans/access";
import { normalizeTargets } from "@/lib/server/scans/normalize-targets";
import { getNextScheduleRunAt, parseTimeOfDay } from "@/lib/server/schedules/recurrence";

function getVisibleSchedulesFilter(actor: ActorContext) {
  assertCanRunScans(actor);

  if (isAdmin(actor)) {
    return undefined;
  }

  return eq(scanSchedules.createdByUserId, actor.user.id);
}

const SCAN_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  queued: "Queued",
  running: "Running",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
}

export function buildLastRunLabel(
  run: typeof scanScheduleRuns.$inferSelect | undefined,
  scanStatus?: typeof scans.$inferSelect["status"] | null,
) {
  if (!run) {
    return null;
  }

  if (run.scanId && scanStatus) {
    return SCAN_STATUS_LABELS[scanStatus] ?? scanStatus
  }

  switch (run.status) {
    case "queued":
      return "Queued";
    case "skipped":
      return run.skipReason ?? "Skipped";
    case "failed":
      return run.errorMessage ?? "Failed";
  }
}

function normalizeScheduleOptions(options: Record<string, unknown> | null | undefined) {
  return {
    followRedirects: options?.followRedirects !== false,
  }
}

function isScheduleContentUpdate(input: UpdateScheduleRequest): input is UpdateScheduleContentRequest {
  return "targets" in input
}

async function replaceScheduleTargets(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  scheduleId: string,
  input: Pick<CreateScheduleRequest, "targets">,
) {
  const normalizedTargets = normalizeTargets(input.targets)

  if (normalizedTargets.length === 0) {
    throw new Error("At least one valid public target is required.")
  }

  await tx
    .insert(canonicalTargets)
    .values(
      normalizedTargets.map((target) => ({
        normalizedTarget: target.normalizedTarget,
        targetType: target.targetType,
      })),
    )
    .onConflictDoNothing()

  const canonicalRows = await tx
    .select()
    .from(canonicalTargets)
    .where(
      inArray(
        canonicalTargets.normalizedTarget,
        normalizedTargets.map((target) => target.normalizedTarget),
      ),
    )

  const canonicalTargetIdByNormalizedTarget = new Map(
    canonicalRows.map((row) => [row.normalizedTarget, row.id]),
  )

  await tx.delete(scanScheduleTargets).where(eq(scanScheduleTargets.scheduleId, scheduleId))

  await tx.insert(scanScheduleTargets).values(
    normalizedTargets.map((target, index) => ({
      scheduleId,
      canonicalTargetId: canonicalTargetIdByNormalizedTarget.get(target.normalizedTarget) ?? null,
      inputTarget: target.inputTarget,
      normalizedTarget: target.normalizedTarget,
      sortOrder: index,
    })),
  )

  return normalizedTargets.length
}

async function writeScheduleDefinition(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  scheduleId: string,
  ownerUserId: string,
  input: CreateScheduleRequest | UpdateScheduleContentRequest,
  enabled: boolean,
) {
  const timeOfDay = parseTimeOfDay(input.timeOfDay)

  if (!timeOfDay) {
    throw new Error("A valid schedule time is required.")
  }

  const targetCount = await replaceScheduleTargets(tx, scheduleId, input)

  const nextRunAt = getNextScheduleRunAt(
    {
      frequency: input.frequency,
      hour: timeOfDay.hour,
      minute: timeOfDay.minute,
      weekday: input.weekday ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
      timezone: input.timezone,
    },
    new Date(),
  )

  await tx
    .update(scanSchedules)
    .set({
      createdByUserId: ownerUserId,
      frequency: input.frequency,
      hour: timeOfDay.hour,
      minute: timeOfDay.minute,
      weekday: input.frequency === "weekly" ? (input.weekday ?? null) : null,
      dayOfMonth: input.frequency === "monthly" ? (input.dayOfMonth ?? null) : null,
      timezone: input.timezone,
      enabled,
      optionsJson: normalizeScheduleOptions(input.options),
      targetCount,
      nextRunAt,
      updatedAt: new Date(),
    })
    .where(eq(scanSchedules.id, scheduleId))
}

export async function listSchedules(actor: ActorContext) {
  const visibleFilter = getVisibleSchedulesFilter(actor);
  const schedules = await db
    .select()
    .from(scanSchedules)
    .where(visibleFilter)
    .orderBy(desc(scanSchedules.createdAt));

  const scheduleIds = schedules.map((schedule) => schedule.id);
  const [targets, runs] = await Promise.all([
    scheduleIds.length > 0
      ? db
          .select()
          .from(scanScheduleTargets)
          .where(inArray(scanScheduleTargets.scheduleId, scheduleIds))
      : Promise.resolve([]),
    scheduleIds.length > 0
      ? db
          .select()
          .from(scanScheduleRuns)
          .where(inArray(scanScheduleRuns.scheduleId, scheduleIds))
          .orderBy(desc(scanScheduleRuns.createdAt))
      : Promise.resolve([]),
  ]);

  const targetsByScheduleId = new Map<string, Array<typeof scanScheduleTargets.$inferSelect>>();
  for (const target of targets) {
    const entries = targetsByScheduleId.get(target.scheduleId) ?? [];
    entries.push(target);
    targetsByScheduleId.set(target.scheduleId, entries);
  }

  const latestRunByScheduleId = new Map<string, typeof scanScheduleRuns.$inferSelect>();
  for (const run of runs) {
    if (!latestRunByScheduleId.has(run.scheduleId)) {
      latestRunByScheduleId.set(run.scheduleId, run);
    }
  }

  const latestRunScanIds = [...latestRunByScheduleId.values()]
    .map((run) => run.scanId)
    .filter((scanId): scanId is string => Boolean(scanId))

  const linkedScans = latestRunScanIds.length > 0
    ? await db
        .select({ id: scans.id, status: scans.status })
        .from(scans)
        .where(inArray(scans.id, latestRunScanIds))
    : []

  const linkedScanStatusById = new Map(linkedScans.map((scan) => [scan.id, scan.status]))

  return listSchedulesResponseSchema.parse({
    items: schedules.map((schedule) => {
      const latestRun = latestRunByScheduleId.get(schedule.id);
      const scheduleTargetsRows = (targetsByScheduleId.get(schedule.id) ?? []).sort((left, right) => left.sortOrder - right.sortOrder);

      return {
        scheduleId: schedule.id,
        targets: scheduleTargetsRows.map((target) => target.normalizedTarget),
        options: normalizeScheduleOptions(schedule.optionsJson),
        frequency: schedule.frequency,
        timeOfDay: `${schedule.hour.toString().padStart(2, "0")}:${schedule.minute.toString().padStart(2, "0")}`,
        weekday: schedule.weekday ?? null,
        dayOfMonth: schedule.dayOfMonth ?? null,
        timezone: schedule.timezone,
        enabled: schedule.enabled,
        nextRunAt: schedule.nextRunAt.toISOString(),
        lastScheduledForAt: latestRun?.scheduledForAt.toISOString() ?? null,
        lastScanId: latestRun?.scanId ?? null,
        lastRunStatus: latestRun?.status ?? null,
        lastRunLabel: buildLastRunLabel(latestRun, latestRun?.scanId ? linkedScanStatusById.get(latestRun.scanId) : null),
        createdAt: schedule.createdAt.toISOString(),
      };
    }),
  });
}

export async function createSchedule(actor: ActorContext, input: CreateScheduleRequest) {
  assertCanRunScans(actor);

  const [createdSchedule] = await db.transaction(async (tx) => {
    const [schedule] = await tx
      .insert(scanSchedules)
      .values({
        createdByUserId: actor.user.id,
        enabled: true,
        frequency: "daily",
        hour: 9,
        minute: 0,
        weekday: null,
        dayOfMonth: null,
        timezone: input.timezone,
        optionsJson: normalizeScheduleOptions(input.options),
        targetCount: 0,
        nextRunAt: new Date(),
      })
      .returning()

    await writeScheduleDefinition(tx, schedule.id, actor.user.id, input, true)

    return [schedule]
  })

  return createScheduleResponseSchema.parse({
    scheduleId: createdSchedule.id,
  });
}

export async function updateSchedule(actor: ActorContext, scheduleId: string, input: UpdateScheduleRequest) {
  const visibleFilter = getVisibleSchedulesFilter(actor);
  const [existingSchedule] = await db
    .select({ id: scanSchedules.id, enabled: scanSchedules.enabled, createdByUserId: scanSchedules.createdByUserId })
    .from(scanSchedules)
    .where(and(eq(scanSchedules.id, scheduleId), visibleFilter ?? eq(scanSchedules.id, scheduleId)))
    .limit(1);

  if (!existingSchedule) {
    throw new Error("The requested schedule could not be found.");
  }

  if (isScheduleContentUpdate(input)) {
    await db.transaction(async (tx) => {
      await writeScheduleDefinition(
        tx,
        scheduleId,
        existingSchedule.createdByUserId,
        input,
        input.enabled ?? existingSchedule.enabled,
      )
    })
  } else {
    await db
      .update(scanSchedules)
      .set({
        enabled: input.enabled,
        updatedAt: new Date(),
      })
      .where(eq(scanSchedules.id, scheduleId))
  }

  return updateScheduleResponseSchema.parse({
    scheduleId,
    enabled: isScheduleContentUpdate(input) ? (input.enabled ?? existingSchedule.enabled) : input.enabled,
  });
}

export async function deleteSchedule(actor: ActorContext, scheduleId: string) {
  const visibleFilter = getVisibleSchedulesFilter(actor);
  const [existingSchedule] = await db
    .select({ id: scanSchedules.id })
    .from(scanSchedules)
    .where(and(eq(scanSchedules.id, scheduleId), visibleFilter ?? eq(scanSchedules.id, scheduleId)))
    .limit(1);

  if (!existingSchedule) {
    throw new Error("The requested schedule could not be found.");
  }

  await db.delete(scanSchedules).where(eq(scanSchedules.id, scheduleId));

  return deleteScheduleResponseSchema.parse({
    deletedScheduleId: scheduleId,
  });
}
