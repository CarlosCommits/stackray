export const DEFAULT_TIME_LOCALE = "en-US"
export const UTC_TIME_ZONE = "UTC"
export const BROWSER_TIME_ZONE_COOKIE_NAME = "stackray-time-zone"
export const BROWSER_TIME_ZONE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export type TimeFormatPreset =
  | "compactDate"
  | "compactDateTimeWithZone"
  | "shortDateTimeWithZone"
  | "fullDateTime"
  | "fullDateTimeWithZone"
  | "fullDateTimeSecondsWithZone"
  | "shortTime"
  | "shortTimeWithZone"

const FORMAT_OPTIONS = {
  compactDate: {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  },
  compactDateTimeWithZone: {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  },
  shortDateTimeWithZone: {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  },
  fullDateTime: {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
  fullDateTimeWithZone: {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  },
  fullDateTimeSecondsWithZone: {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  },
  shortTime: {
    hour: "numeric",
    minute: "2-digit",
  },
  shortTimeWithZone: {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  },
} as const satisfies Record<TimeFormatPreset, Intl.DateTimeFormatOptions>

export function toDate(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

export function toInstantIso(value: Date | string | null | undefined) {
  return toDate(value)?.toISOString() ?? null
}

export function formatInstant(
  value: Date | string | null | undefined,
  preset: TimeFormatPreset = "fullDateTimeWithZone",
  options: {
    locale?: string
    timeZone?: string
    unavailableLabel?: string
  } = {},
) {
  const date = toDate(value)

  if (!date) {
    return options.unavailableLabel ?? "--"
  }

  return new Intl.DateTimeFormat(options.locale ?? DEFAULT_TIME_LOCALE, {
    ...FORMAT_OPTIONS[preset],
    timeZone: options.timeZone,
  }).format(date)
}

export function formatUtcInstant(
  value: Date | string | null | undefined,
  preset: TimeFormatPreset = "fullDateTimeWithZone",
  unavailableLabel?: string,
) {
  return formatInstant(value, preset, {
    timeZone: UTC_TIME_ZONE,
    unavailableLabel,
  })
}

export function formatBrowserInstant(
  value: Date | string | null | undefined,
  preset: TimeFormatPreset = "fullDateTimeWithZone",
  unavailableLabel?: string,
) {
  return formatInstant(value, preset, {
    unavailableLabel,
  })
}

type ZonedDateTimeParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function getZonedParts(date: Date, timeZone: string): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat(DEFAULT_TIME_LOCALE, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
  const values = new Map(formatter.formatToParts(date).map((part) => [part.type, part.value]))

  return {
    year: Number.parseInt(values.get("year") ?? "0", 10),
    month: Number.parseInt(values.get("month") ?? "0", 10),
    day: Number.parseInt(values.get("day") ?? "0", 10),
    hour: Number.parseInt(values.get("hour") ?? "0", 10),
    minute: Number.parseInt(values.get("minute") ?? "0", 10),
    second: Number.parseInt(values.get("second") ?? "0", 10),
  }
}

function toLocalEpoch(parts: ZonedDateTimeParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
}

function addUtcDays(year: number, month: number, day: number, increment: number) {
  const value = new Date(Date.UTC(year, month - 1, day))
  value.setUTCDate(value.getUTCDate() + increment)

  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  }
}

function formatDatePart(value: number, length: number) {
  return String(value).padStart(length, "0")
}

export function isValidTimeZone(timeZone: string) {
  try {
    Intl.DateTimeFormat(DEFAULT_TIME_LOCALE, { timeZone }).format(new Date(0))
    return true
  } catch {
    return false
  }
}

export function formatDateOnlyInTimeZone(
  value: Date | string | null | undefined,
  timeZone = UTC_TIME_ZONE,
) {
  const date = toDate(value)

  if (!date) {
    return null
  }

  const validTimeZone = isValidTimeZone(timeZone) ? timeZone : UTC_TIME_ZONE
  const parts = getZonedParts(date, validTimeZone)

  return [
    formatDatePart(parts.year, 4),
    formatDatePart(parts.month, 2),
    formatDatePart(parts.day, 2),
  ].join("-")
}

export function zonedDateTimeToUtcDate(parts: ZonedDateTimeParts, timeZone: string) {
  let guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second))

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const actual = getZonedParts(guess, timeZone)
    const diffMilliseconds = toLocalEpoch(actual) - toLocalEpoch(parts)

    if (diffMilliseconds === 0) {
      return guess
    }

    guess = new Date(guess.getTime() - diffMilliseconds)
  }

  return guess
}

export function parseDateBoundary(
  value: string | null | undefined,
  boundary: "from" | "to",
  timeZone = UTC_TIME_ZONE,
) {
  if (!value) {
    return null
  }

  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue)

  if (dateOnlyMatch) {
    const year = Number.parseInt(dateOnlyMatch[1] ?? "0", 10)
    const month = Number.parseInt(dateOnlyMatch[2] ?? "0", 10)
    const day = Number.parseInt(dateOnlyMatch[3] ?? "0", 10)
    const normalizedDate = new Date(Date.UTC(year, month - 1, day))

    if (
      normalizedDate.getUTCFullYear() !== year ||
      normalizedDate.getUTCMonth() + 1 !== month ||
      normalizedDate.getUTCDate() !== day
    ) {
      return null
    }

    const validTimeZone = isValidTimeZone(timeZone) ? timeZone : UTC_TIME_ZONE

    if (boundary === "from") {
      return zonedDateTimeToUtcDate({ year, month, day, hour: 0, minute: 0, second: 0 }, validTimeZone).toISOString()
    }

    const nextDay = addUtcDays(year, month, day, 1)
    return new Date(
      zonedDateTimeToUtcDate({ ...nextDay, hour: 0, minute: 0, second: 0 }, validTimeZone).getTime() - 1,
    ).toISOString()
  }

  return toInstantIso(trimmedValue)
}
