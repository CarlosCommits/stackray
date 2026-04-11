import {
  targetResultItemSchema,
  type TargetResultItem,
} from "@/lib/contracts/targets"

const TARGET_MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

export const TARGET_LATEST_SCAN_LINK_LABEL = "Open latest scan"
export const TARGETS_DEFAULT_PAGE_LIMIT = 50

export interface TargetRowLastScannedAt {
  iso: TargetResultItem["lastScannedAt"]
  label: string
}

export interface TargetRowLatestScan {
  scanId: TargetResultItem["latestScanId"]
  href: string
  label: string
  ariaLabel: string
}

export interface TargetRow {
  canonicalTargetId: TargetResultItem["canonicalTargetId"]
  target: TargetResultItem["normalizedTarget"]
  title: TargetResultItem["title"]
  technologies: TargetResultItem["technologies"]
  lastScannedAt: TargetRowLastScannedAt
  latestScan: TargetRowLatestScan
  faviconUrl: TargetResultItem["faviconUrl"]
}

export function getTargetScanDetailHref(scanId: string): string {
  return `/scans/${scanId}`
}

export type TargetParamsInput = URLSearchParams | Record<string, string | string[] | undefined>

export interface TargetQuery {
  q: string | null
  technology: string[]
  cdn: string[]
  server: string[]
  plugin: string[]
  theme: string[]
  cpe: string[]
  statusCode: number[]
  from: string | null
  to: string | null
  cursor: string | null
  limit: number
}

function normalizeTargetToken(value: string): string {
  return value.trim().toLowerCase()
}

function splitTargetParamValue(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

function isTargetParamsRecord(
  searchParams: TargetParamsInput,
): searchParams is Record<string, string | string[] | undefined> {
  return !(searchParams instanceof URLSearchParams)
}

function getTargetParamValues(searchParams: TargetParamsInput | undefined, key: string): string[] {
  if (!searchParams) {
    return []
  }

  if (isTargetParamsRecord(searchParams)) {
    const value = searchParams[key]

    if (typeof value === "string") {
      return splitTargetParamValue(value)
    }

    if (Array.isArray(value)) {
      return value.flatMap((item) => splitTargetParamValue(item))
    }

    return []
  }

  return searchParams.getAll(key).flatMap((value) => splitTargetParamValue(value))
}

function getSingleTargetParam(searchParams: TargetParamsInput | undefined, key: string): string | null {
  const values = getTargetParamValues(searchParams, key)

  return values[0] ?? null
}

function parseTargetTokenList(searchParams: TargetParamsInput | undefined, key: string): string[] {
  const normalizedValues = getTargetParamValues(searchParams, key).map(normalizeTargetToken)

  return [...new Set(normalizedValues.filter((value) => value.length > 0))]
}

function parseTargetStatusCodes(searchParams: TargetParamsInput | undefined): number[] {
  const parsedCodes = getTargetParamValues(searchParams, "statusCode")
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value))

  return [...new Set(parsedCodes)]
}

function parseTargetLimit(searchParams: TargetParamsInput | undefined): number {
  const limit = getSingleTargetParam(searchParams, "limit")

  if (!limit) {
    return TARGETS_DEFAULT_PAGE_LIMIT
  }

  const parsedLimit = Number.parseInt(limit, 10)

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return TARGETS_DEFAULT_PAGE_LIMIT
  }

  return parsedLimit
}

function parseTargetCursor(searchParams: TargetParamsInput | undefined): string | null {
  const cursor = getSingleTargetParam(searchParams, "cursor")

  return cursor?.trim() || null
}

function parseTargetDateBoundary(value: string | null, boundary: "from" | "to"): string | null {
  if (!value) {
    return null
  }

  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)
  const parsedDate = new Date(
    isDateOnly
      ? `${trimmedValue}T${boundary === "from" ? "00:00:00.000" : "23:59:59.999"}Z`
      : trimmedValue,
  )

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  return parsedDate.toISOString()
}

function formatTargetLastScannedAtLabel(scannedAtIso: string): string {
  const scannedAt = new Date(scannedAtIso)

  if (Number.isNaN(scannedAt.getTime())) {
    return "--"
  }

  const month = TARGET_MONTH_LABELS[scannedAt.getUTCMonth()]
  const day = scannedAt.getUTCDate()
  const year = scannedAt.getUTCFullYear()
  const hours = scannedAt.getUTCHours()
  const minutes = scannedAt.getUTCMinutes().toString().padStart(2, "0")
  const meridiem = hours >= 12 ? "PM" : "AM"
  const twelveHour = hours % 12 || 12

  return `${month} ${day}, ${year}, ${twelveHour}:${minutes} ${meridiem} UTC`
}

export function parseTargetQuery(searchParams?: TargetParamsInput): TargetQuery {
  return {
    q: (() => {
      const rawQuery = getSingleTargetParam(searchParams, "q")

      if (!rawQuery) {
        return null
      }

      const normalizedQuery = normalizeTargetToken(rawQuery)

      return normalizedQuery || null
    })(),
    technology: parseTargetTokenList(searchParams, "technology"),
    cdn: parseTargetTokenList(searchParams, "cdn"),
    server: parseTargetTokenList(searchParams, "server"),
    plugin: parseTargetTokenList(searchParams, "plugin"),
    theme: parseTargetTokenList(searchParams, "theme"),
    cpe: parseTargetTokenList(searchParams, "cpe"),
    statusCode: parseTargetStatusCodes(searchParams),
    from: parseTargetDateBoundary(getSingleTargetParam(searchParams, "from"), "from"),
    to: parseTargetDateBoundary(getSingleTargetParam(searchParams, "to"), "to"),
    cursor: parseTargetCursor(searchParams),
    limit: parseTargetLimit(searchParams),
  }
}

export function buildTargetRow(item: TargetResultItem): TargetRow {
  return {
    canonicalTargetId: item.canonicalTargetId,
    target: item.normalizedTarget,
    title: item.title,
    technologies: [...item.technologies],
    lastScannedAt: {
      iso: item.lastScannedAt,
      label: formatTargetLastScannedAtLabel(item.lastScannedAt),
    },
    latestScan: {
      scanId: item.latestScanId,
      href: getTargetScanDetailHref(item.latestScanId),
      label: TARGET_LATEST_SCAN_LINK_LABEL,
      ariaLabel: `${TARGET_LATEST_SCAN_LINK_LABEL} for ${item.normalizedTarget}`,
    },
    faviconUrl: item.faviconUrl,
  }
}

export function buildTargetRows(items: readonly TargetResultItem[]): TargetRow[] {
  return items.map((item) => buildTargetRow(item))
}
