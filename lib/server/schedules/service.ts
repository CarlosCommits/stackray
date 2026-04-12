import { and, desc, eq, inArray } from "drizzle-orm";

import {
  createScheduleResponseSchema,
  deleteScheduleResponseSchema,
  listSchedulesResponseSchema,
  type CreateScheduleRequest,
  type UpdateScheduleRequest,
  updateScheduleResponseSchema,
} from "@/lib/contracts/schedules";
import { db } from "@/lib/db/client";
import {
  canonicalTargets,
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

function buildLastRunLabel(run: typeof scanScheduleRuns.$inferSelect | undefined) {
  if (!run) {
    return null;
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

  return listSchedulesResponseSchema.parse({
    items: schedules.map((schedule) => {
      const latestRun = latestRunByScheduleId.get(schedule.id);
      const scheduleTargetsRows = (targetsByScheduleId.get(schedule.id) ?? []).sort((left, right) => left.sortOrder - right.sortOrder);

      return {
        scheduleId: schedule.id,
        targets: scheduleTargetsRows.map((target) => target.normalizedTarget),
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
        lastRunLabel: buildLastRunLabel(latestRun),
        createdAt: schedule.createdAt.toISOString(),
      };
    }),
  });
}

export async function createSchedule(actor: ActorContext, input: CreateScheduleRequest) {
  assertCanRunScans(actor);

  const normalizedTargets = normalizeTargets(input.targets);

  if (normalizedTargets.length === 0) {
    throw new Error("At least one valid public target is required.");
  }

  const timeOfDay = parseTimeOfDay(input.timeOfDay);

  if (!timeOfDay) {
    throw new Error("A valid schedule time is required.");
  }

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
  );

  const [createdSchedule] = await db.transaction(async (tx) => {
    const [schedule] = await tx
      .insert(scanSchedules)
      .values({
        createdByUserId: actor.user.id,
        frequency: input.frequency,
        hour: timeOfDay.hour,
        minute: timeOfDay.minute,
        weekday: input.frequency === "weekly" ? (input.weekday ?? null) : null,
        dayOfMonth: input.frequency === "monthly" ? (input.dayOfMonth ?? null) : null,
        timezone: input.timezone,
        enabled: true,
        optionsJson: input.options,
        targetCount: normalizedTargets.length,
        nextRunAt,
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

    await tx.insert(scanScheduleTargets).values(
      normalizedTargets.map((target, index) => ({
        scheduleId: schedule.id,
        canonicalTargetId: canonicalTargetIdByNormalizedTarget.get(target.normalizedTarget) ?? null,
        inputTarget: target.inputTarget,
        normalizedTarget: target.normalizedTarget,
        sortOrder: index,
      })),
    );

    return [schedule];
  });

  return createScheduleResponseSchema.parse({
    scheduleId: createdSchedule.id,
  });
}

export async function updateSchedule(actor: ActorContext, scheduleId: string, input: UpdateScheduleRequest) {
  const visibleFilter = getVisibleSchedulesFilter(actor);
  const [existingSchedule] = await db
    .select({ id: scanSchedules.id })
    .from(scanSchedules)
    .where(and(eq(scanSchedules.id, scheduleId), visibleFilter ?? eq(scanSchedules.id, scheduleId)))
    .limit(1);

  if (!existingSchedule) {
    throw new Error("The requested schedule could not be found.");
  }

  await db
    .update(scanSchedules)
    .set({
      enabled: input.enabled,
      updatedAt: new Date(),
    })
    .where(eq(scanSchedules.id, scheduleId));

  return updateScheduleResponseSchema.parse({
    scheduleId,
    enabled: input.enabled,
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
