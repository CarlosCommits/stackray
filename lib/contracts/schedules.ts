import { z } from "zod";

import { isoDateSchema } from "@/lib/contracts/common";
import { DEFAULT_SCHEDULE_TIMEZONE, isValidScheduleTimezone } from "@/lib/server/schedules/recurrence";

const scheduleFrequencySchema = z.enum(["daily", "weekly", "monthly"]);

const scheduleTimeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

const scheduleOptionsSchema = z.object({
  followRedirects: z.boolean().default(true),
}).strict();

const baseScheduleRequestSchema = z.object({
  targets: z.array(z.string().min(1)).min(1),
  options: scheduleOptionsSchema.default({
    followRedirects: true,
  }),
  frequency: scheduleFrequencySchema,
  timeOfDay: scheduleTimeOfDaySchema,
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  timezone: z.string().refine(isValidScheduleTimezone, {
    message: "A valid IANA timezone is required.",
  }).default(DEFAULT_SCHEDULE_TIMEZONE),
}).strict();

function validateScheduleRecurrence(value: z.infer<typeof baseScheduleRequestSchema>, ctx: z.RefinementCtx) {
  if (value.frequency === "weekly" && value.weekday == null) {
    ctx.addIssue({
      code: "custom",
      message: "weekday is required for weekly schedules.",
      path: ["weekday"],
    });
  }

  if (value.frequency === "monthly" && value.dayOfMonth == null) {
    ctx.addIssue({
      code: "custom",
      message: "dayOfMonth is required for monthly schedules.",
      path: ["dayOfMonth"],
    });
  }
}

export const createScheduleRequestSchema = baseScheduleRequestSchema.superRefine(validateScheduleRecurrence);

const updateScheduleEnabledRequestSchema = z.object({
  enabled: z.boolean(),
}).strict();

const updateScheduleContentRequestSchema = baseScheduleRequestSchema.extend({
  enabled: z.boolean().optional(),
}).superRefine(validateScheduleRecurrence);

export const updateScheduleRequestSchema = z.union([
  updateScheduleEnabledRequestSchema,
  updateScheduleContentRequestSchema,
]);

const scheduleListItemSchema = z.object({
  scheduleId: z.string(),
  targets: z.array(z.string()),
  options: scheduleOptionsSchema,
  frequency: scheduleFrequencySchema,
  timeOfDay: scheduleTimeOfDaySchema,
  weekday: z.number().int().min(0).max(6).nullable(),
  dayOfMonth: z.number().int().min(1).max(31).nullable(),
  timezone: z.string(),
  enabled: z.boolean(),
  nextRunAt: isoDateSchema,
  lastScheduledForAt: isoDateSchema.nullable(),
  lastScanId: z.string().nullable(),
  lastRunStatus: z.enum(["queued", "skipped", "failed"]).nullable(),
  lastRunLabel: z.string().nullable(),
  createdAt: isoDateSchema,
});

export const listSchedulesResponseSchema = z.object({
  items: z.array(scheduleListItemSchema),
});

export const createScheduleResponseSchema = z.object({
  scheduleId: z.string(),
});

export const updateScheduleResponseSchema = z.object({
  scheduleId: z.string(),
  enabled: z.boolean(),
});

export const deleteScheduleResponseSchema = z.object({
  deletedScheduleId: z.string(),
});

export type CreateScheduleRequest = z.infer<typeof createScheduleRequestSchema>;
export type UpdateScheduleRequest = z.infer<typeof updateScheduleRequestSchema>;
export type UpdateScheduleContentRequest = z.infer<typeof updateScheduleContentRequestSchema>;
export type ScheduleListItem = z.infer<typeof scheduleListItemSchema>;
