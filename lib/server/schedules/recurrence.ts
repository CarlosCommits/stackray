const WEEKDAY_NAME_TO_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
} as const;

export { DEFAULT_SCHEDULE_TIMEZONE } from "@/lib/schedules/timezones";

type WeekdayName = keyof typeof WEEKDAY_NAME_TO_INDEX;

export type ScheduleFrequency = "daily" | "weekly" | "monthly";

export type ScheduleRecurrenceInput = {
  frequency: ScheduleFrequency;
  hour: number;
  minute: number;
  weekday: number | null;
  dayOfMonth: number | null;
  timezone: string;
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string) {
  let formatter = formatterCache.get(timeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, formatter);
  }

  return formatter;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = getFormatter(timeZone).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const weekdayName = values.get("weekday") as WeekdayName | undefined;

  if (!weekdayName) {
    throw new Error(`Unable to resolve weekday for timezone ${timeZone}.`);
  }

  return {
    year: Number.parseInt(values.get("year") ?? "0", 10),
    month: Number.parseInt(values.get("month") ?? "0", 10),
    day: Number.parseInt(values.get("day") ?? "0", 10),
    hour: Number.parseInt(values.get("hour") ?? "0", 10),
    minute: Number.parseInt(values.get("minute") ?? "0", 10),
    second: Number.parseInt(values.get("second") ?? "0", 10),
    weekday: WEEKDAY_NAME_TO_INDEX[weekdayName],
  };
}

function toLocalEpoch(parts: Pick<ZonedParts, "year" | "month" | "day" | "hour" | "minute" | "second">) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function clampDayOfMonth(year: number, month: number, dayOfMonth: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.min(dayOfMonth, lastDay);
}

function addDays(year: number, month: number, day: number, increment: number) {
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + increment);

  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function addMonths(year: number, month: number, increment: number) {
  const value = new Date(Date.UTC(year, month - 1, 1));
  value.setUTCMonth(value.getUTCMonth() + increment);

  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
  };
}

function toUtcDate(
  parts: Pick<ZonedParts, "year" | "month" | "day" | "hour" | "minute">,
  timeZone: string,
) {
  const target = { ...parts, second: 0 };
  let guess = new Date(Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, 0));

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const actual = getZonedParts(guess, timeZone);
    const diffMilliseconds = toLocalEpoch(actual) - toLocalEpoch(target);

    if (diffMilliseconds === 0) {
      return guess;
    }

    guess = new Date(guess.getTime() - diffMilliseconds);
  }

  for (let minuteOffset = 0; minuteOffset <= 180; minuteOffset += 1) {
    const candidate = new Date(guess.getTime() + minuteOffset * 60_000);
    const actual = getZonedParts(candidate, timeZone);

    if (toLocalEpoch(actual) >= toLocalEpoch(target)) {
      return candidate;
    }
  }

  return guess;
}

function buildOccurrenceForLocalDate(
  recurrence: ScheduleRecurrenceInput,
  date: Pick<ZonedParts, "year" | "month" | "day">,
) {
  return toUtcDate(
    {
      ...date,
      hour: recurrence.hour,
      minute: recurrence.minute,
    },
    recurrence.timezone,
  );
}

function getInitialOccurrence(recurrence: ScheduleRecurrenceInput, reference: Date) {
  const localReference = getZonedParts(reference, recurrence.timezone);

  switch (recurrence.frequency) {
    case "daily": {
      const sameDay = buildOccurrenceForLocalDate(recurrence, localReference);
      if (sameDay > reference) {
        return sameDay;
      }

      const nextDate = addDays(localReference.year, localReference.month, localReference.day, 1);
      return buildOccurrenceForLocalDate(recurrence, nextDate);
    }
    case "weekly": {
      const targetWeekday = recurrence.weekday ?? localReference.weekday;
      const daysUntil = (targetWeekday - localReference.weekday + 7) % 7;
      const sameWeekDate = addDays(localReference.year, localReference.month, localReference.day, daysUntil);
      const sameWeekOccurrence = buildOccurrenceForLocalDate(recurrence, sameWeekDate);

      if (sameWeekOccurrence > reference) {
        return sameWeekOccurrence;
      }

      const nextWeekDate = addDays(sameWeekDate.year, sameWeekDate.month, sameWeekDate.day, 7);
      return buildOccurrenceForLocalDate(recurrence, nextWeekDate);
    }
    case "monthly": {
      const targetDayOfMonth = clampDayOfMonth(
        localReference.year,
        localReference.month,
        recurrence.dayOfMonth ?? localReference.day,
      );
      const sameMonthOccurrence = buildOccurrenceForLocalDate(recurrence, {
        year: localReference.year,
        month: localReference.month,
        day: targetDayOfMonth,
      });

      if (sameMonthOccurrence > reference) {
        return sameMonthOccurrence;
      }

      const nextMonth = addMonths(localReference.year, localReference.month, 1);
      return buildOccurrenceForLocalDate(recurrence, {
        year: nextMonth.year,
        month: nextMonth.month,
        day: clampDayOfMonth(nextMonth.year, nextMonth.month, recurrence.dayOfMonth ?? localReference.day),
      });
    }
  }
}

export function advanceScheduleOccurrence(recurrence: ScheduleRecurrenceInput, occurrence: Date) {
  const localOccurrence = getZonedParts(occurrence, recurrence.timezone);

  switch (recurrence.frequency) {
    case "daily": {
      const nextDate = addDays(localOccurrence.year, localOccurrence.month, localOccurrence.day, 1);
      return buildOccurrenceForLocalDate(recurrence, nextDate);
    }
    case "weekly": {
      const nextDate = addDays(localOccurrence.year, localOccurrence.month, localOccurrence.day, 7);
      return buildOccurrenceForLocalDate(recurrence, nextDate);
    }
    case "monthly": {
      const nextMonth = addMonths(localOccurrence.year, localOccurrence.month, 1);
      return buildOccurrenceForLocalDate(recurrence, {
        year: nextMonth.year,
        month: nextMonth.month,
        day: clampDayOfMonth(nextMonth.year, nextMonth.month, recurrence.dayOfMonth ?? localOccurrence.day),
      });
    }
  }
}

export function getNextScheduleRunAt(recurrence: ScheduleRecurrenceInput, reference: Date) {
  return getInitialOccurrence(recurrence, reference);
}

export function getCollapsedDueScheduleSlot(
  recurrence: ScheduleRecurrenceInput,
  nextRunAt: Date,
  now: Date,
) {
  if (nextRunAt > now) {
    return null;
  }

  let scheduledForAt = nextRunAt;
  let followingRunAt = advanceScheduleOccurrence(recurrence, scheduledForAt);

  while (followingRunAt <= now) {
    scheduledForAt = followingRunAt;
    followingRunAt = advanceScheduleOccurrence(recurrence, scheduledForAt);
  }

  return {
    scheduledForAt,
    nextRunAt: followingRunAt,
  };
}

export function isValidScheduleTimezone(timeZone: string) {
  try {
    getFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function parseTimeOfDay(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());

  if (!match) {
    return null;
  }

  return {
    hour: Number.parseInt(match[1] ?? "0", 10),
    minute: Number.parseInt(match[2] ?? "0", 10),
  };
}

export function formatTimeOfDay(hour: number, minute: number) {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}
