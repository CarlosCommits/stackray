import type { TargetResultItem } from "@/lib/contracts/targets"
import { isValidTimeZone, parseDateBoundary } from "@/lib/time"

export const TARGET_LATEST_SCAN_LINK_LABEL = "Open latest scan"
export const TARGETS_DEFAULT_PAGE_LIMIT = 50

interface TargetRowLastScannedAt {
  iso: TargetResultItem["lastScannedAt"]
}

interface TargetRowLatestScan {
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
  screenshotUrl: TargetResultItem["screenshotUrl"]
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
  timeZone: string | null
  cursor: string | null
  limit: number
}

function normalizeTargetToken(value: string): string {
  return value.trim().toLowerCase()
}

function splitTargetParamValue(value: string): string[] {
  return value
    .split(",")
    .flatMap((part) => {
      const trimmed = part.trim()

      return trimmed.length > 0 ? [trimmed] : []
    })
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
  const normalizedValues = getTargetParamValues(searchParams, key).flatMap((value) => {
    const normalizedValue = normalizeTargetToken(value)

    return normalizedValue.length > 0 ? [normalizedValue] : []
  })

  return [...new Set(normalizedValues)]
}

function parseTargetStatusCodes(searchParams: TargetParamsInput | undefined): number[] {
  const parsedCodes = getTargetParamValues(searchParams, "statusCode").flatMap((value) => {
    const parsedCode = Number.parseInt(value, 10)

    return Number.isInteger(parsedCode) ? [parsedCode] : []
  })

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

export function parseTargetQuery(searchParams?: TargetParamsInput): TargetQuery {
  const timeZoneParam = getSingleTargetParam(searchParams, "timeZone")?.trim() ?? null
  const timeZone = timeZoneParam && isValidTimeZone(timeZoneParam) ? timeZoneParam : null

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
    from: parseDateBoundary(getSingleTargetParam(searchParams, "from"), "from", timeZone ?? undefined),
    to: parseDateBoundary(getSingleTargetParam(searchParams, "to"), "to", timeZone ?? undefined),
    timeZone,
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
    },
    latestScan: {
      scanId: item.latestScanId,
      href: getTargetScanDetailHref(item.latestScanId),
      label: TARGET_LATEST_SCAN_LINK_LABEL,
      ariaLabel: `${TARGET_LATEST_SCAN_LINK_LABEL} for ${item.normalizedTarget}`,
    },
    faviconUrl: item.faviconUrl,
    screenshotUrl: item.screenshotUrl,
  }
}

export function buildTargetRows(items: readonly TargetResultItem[]): TargetRow[] {
  return items.map((item) => buildTargetRow(item))
}
