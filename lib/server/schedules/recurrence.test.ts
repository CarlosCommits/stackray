import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCHEDULE_TIMEZONE,
  advanceScheduleOccurrence,
  getCollapsedDueScheduleSlot,
  getNextScheduleRunAt,
  isValidScheduleTimezone,
  parseTimeOfDay,
} from "@/lib/server/schedules/recurrence";

function getParts(date: Date, timeZone = DEFAULT_SCHEDULE_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const values = new Map(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    weekday: values.get("weekday"),
    year: Number.parseInt(values.get("year") ?? "0", 10),
    month: Number.parseInt(values.get("month") ?? "0", 10),
    day: Number.parseInt(values.get("day") ?? "0", 10),
    hour: Number.parseInt(values.get("hour") ?? "0", 10),
    minute: Number.parseInt(values.get("minute") ?? "0", 10),
  };
}

describe("schedule recurrence helpers", () => {
  it("parses valid times of day", () => {
    expect(parseTimeOfDay("09:30")).toEqual({ hour: 9, minute: 30 });
    expect(parseTimeOfDay("23:59")).toEqual({ hour: 23, minute: 59 });
    expect(parseTimeOfDay("24:00")).toBeNull();
    expect(parseTimeOfDay("9:30")).toBeNull();
  });

  it("validates IANA timezones", () => {
    expect(isValidScheduleTimezone(DEFAULT_SCHEDULE_TIMEZONE)).toBe(true);
    expect(isValidScheduleTimezone("Mars/Olympus_Mons")).toBe(false);
  });

  it("computes the next daily run after the reference instant", () => {
    const nextRun = getNextScheduleRunAt(
      {
        frequency: "daily",
        hour: 9,
        minute: 30,
        weekday: null,
        dayOfMonth: null,
        timezone: DEFAULT_SCHEDULE_TIMEZONE,
      },
      new Date("2026-04-11T15:00:00.000Z"),
    );

    expect(getParts(nextRun)).toMatchObject({
      hour: 9,
      minute: 30,
      month: 4,
      day: 12,
    });
  });

  it("advances weekly schedules by one week in local time", () => {
    const nextRun = advanceScheduleOccurrence(
      {
        frequency: "weekly",
        hour: 10,
        minute: 15,
        weekday: 1,
        dayOfMonth: null,
        timezone: DEFAULT_SCHEDULE_TIMEZONE,
      },
      new Date("2026-04-13T14:15:00.000Z"),
    );

    expect(getParts(nextRun)).toMatchObject({
      weekday: "Mon",
      hour: 10,
      minute: 15,
    });
  });

  it("collapses multiple missed runs into a single catch-up slot", () => {
    const slot = getCollapsedDueScheduleSlot(
      {
        frequency: "daily",
        hour: 9,
        minute: 0,
        weekday: null,
        dayOfMonth: null,
        timezone: DEFAULT_SCHEDULE_TIMEZONE,
      },
      new Date("2026-04-08T13:00:00.000Z"),
      new Date("2026-04-11T18:00:00.000Z"),
    );

    expect(slot).not.toBeNull();
    expect(getParts(slot!.scheduledForAt)).toMatchObject({ month: 4, day: 11, hour: 9, minute: 0 });
    expect(getParts(slot!.nextRunAt)).toMatchObject({ month: 4, day: 12, hour: 9, minute: 0 });
  });

  it("clamps monthly schedules to the end of shorter months", () => {
    const nextRun = advanceScheduleOccurrence(
      {
        frequency: "monthly",
        hour: 8,
        minute: 45,
        weekday: null,
        dayOfMonth: 31,
        timezone: DEFAULT_SCHEDULE_TIMEZONE,
      },
      new Date("2026-01-31T13:45:00.000Z"),
    );

    expect(getParts(nextRun)).toMatchObject({ month: 2, day: 28, hour: 8, minute: 45 });
  });

  it("keeps daily schedules on local wall time across spring DST changes", () => {
    const nextRun = advanceScheduleOccurrence(
      {
        frequency: "daily",
        hour: 9,
        minute: 0,
        weekday: null,
        dayOfMonth: null,
        timezone: DEFAULT_SCHEDULE_TIMEZONE,
      },
      new Date("2026-03-07T14:00:00.000Z"),
    );

    expect(getParts(nextRun)).toMatchObject({ month: 3, day: 8, hour: 9, minute: 0 });
    expect(nextRun.toISOString()).toBe("2026-03-08T13:00:00.000Z");
  });

  it("keeps daily schedules on local wall time across fall DST changes", () => {
    const nextRun = advanceScheduleOccurrence(
      {
        frequency: "daily",
        hour: 9,
        minute: 0,
        weekday: null,
        dayOfMonth: null,
        timezone: DEFAULT_SCHEDULE_TIMEZONE,
      },
      new Date("2026-10-31T13:00:00.000Z"),
    );

    expect(getParts(nextRun)).toMatchObject({ month: 11, day: 1, hour: 9, minute: 0 });
    expect(nextRun.toISOString()).toBe("2026-11-01T14:00:00.000Z");
  });
});
