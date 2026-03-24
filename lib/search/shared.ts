import { z } from "zod"

import {
  searchModeSchema,
  searchResultItemSchema,
  type SearchResultItem,
} from "@/lib/contracts/search"

const SEARCH_MONTH_LABELS = [
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

export type SearchMode = z.infer<typeof searchModeSchema>

export const SEARCH_LATEST_SCAN_LINK_LABEL = "Open latest scan"

export interface SearchRowLastScannedAt {
  iso: SearchResultItem["lastScannedAt"]
  label: string
}

export interface SearchRowLatestScan {
  scanId: SearchResultItem["latestScanId"]
  href: string
  label: string
  ariaLabel: string
}

export interface SearchRow {
  canonicalTargetId: SearchResultItem["canonicalTargetId"]
  target: SearchResultItem["normalizedTarget"]
  title: SearchResultItem["title"]
  technologies: SearchResultItem["technologies"]
  lastScannedAt: SearchRowLastScannedAt
  latestScan: SearchRowLatestScan
}

export function getSearchScanDetailHref(scanId: string): string {
  return `/scans/${scanId}`
}

export type SearchParamsInput = URLSearchParams | Record<string, string | string[] | undefined>

export interface SearchQuery {
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
  limit: number | null
  mode: SearchMode
}

function normalizeSearchToken(value: string): string {
  return value.trim().toLowerCase()
}

function splitSearchParamValue(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

function isSearchParamsRecord(
  searchParams: SearchParamsInput,
): searchParams is Record<string, string | string[] | undefined> {
  return !(searchParams instanceof URLSearchParams)
}

function getSearchParamValues(searchParams: SearchParamsInput | undefined, key: string): string[] {
  if (!searchParams) {
    return []
  }

  if (isSearchParamsRecord(searchParams)) {
    const value = searchParams[key]

    if (typeof value === "string") {
      return splitSearchParamValue(value)
    }

    if (Array.isArray(value)) {
      return value.flatMap((item) => splitSearchParamValue(item))
    }

    return []
  }

  return searchParams.getAll(key).flatMap((value) => splitSearchParamValue(value))
}

function getSingleSearchParam(searchParams: SearchParamsInput | undefined, key: string): string | null {
  const values = getSearchParamValues(searchParams, key)

  return values[0] ?? null
}

function parseSearchTokenList(searchParams: SearchParamsInput | undefined, key: string): string[] {
  const normalizedValues = getSearchParamValues(searchParams, key).map(normalizeSearchToken)

  return [...new Set(normalizedValues.filter((value) => value.length > 0))]
}

function parseSearchStatusCodes(searchParams: SearchParamsInput | undefined): number[] {
  const parsedCodes = getSearchParamValues(searchParams, "statusCode")
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value))

  return [...new Set(parsedCodes)]
}

function parseSearchLimit(searchParams: SearchParamsInput | undefined): number | null {
  const limit = getSingleSearchParam(searchParams, "limit")

  if (!limit) {
    return null
  }

  const parsedLimit = Number.parseInt(limit, 10)

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return null
  }

  return parsedLimit
}

function parseSearchCursor(searchParams: SearchParamsInput | undefined): string | null {
  const cursor = getSingleSearchParam(searchParams, "cursor")

  return cursor?.trim() || null
}

function parseSearchDateBoundary(value: string | null, boundary: "from" | "to"): string | null {
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

function parseSearchMode(mode: string | null): SearchMode {
  const parsedMode = searchModeSchema.safeParse(mode)

  return parsedMode.success ? parsedMode.data : "latest"
}

function formatSearchLastScannedAtLabel(scannedAtIso: string): string {
  const scannedAt = new Date(scannedAtIso)

  if (Number.isNaN(scannedAt.getTime())) {
    return "--"
  }

  const month = SEARCH_MONTH_LABELS[scannedAt.getUTCMonth()]
  const day = scannedAt.getUTCDate()
  const year = scannedAt.getUTCFullYear()
  const hours = scannedAt.getUTCHours()
  const minutes = scannedAt.getUTCMinutes().toString().padStart(2, "0")
  const meridiem = hours >= 12 ? "PM" : "AM"
  const twelveHour = hours % 12 || 12

  return `${month} ${day}, ${year}, ${twelveHour}:${minutes} ${meridiem} UTC`
}

export function parseSearchQuery(searchParams?: SearchParamsInput): SearchQuery {
  return {
    q: (() => {
      const rawQuery = getSingleSearchParam(searchParams, "q")

      if (!rawQuery) {
        return null
      }

      const normalizedQuery = normalizeSearchToken(rawQuery)

      return normalizedQuery || null
    })(),
    technology: parseSearchTokenList(searchParams, "technology"),
    cdn: parseSearchTokenList(searchParams, "cdn"),
    server: parseSearchTokenList(searchParams, "server"),
    plugin: parseSearchTokenList(searchParams, "plugin"),
    theme: parseSearchTokenList(searchParams, "theme"),
    cpe: parseSearchTokenList(searchParams, "cpe"),
    statusCode: parseSearchStatusCodes(searchParams),
    from: parseSearchDateBoundary(getSingleSearchParam(searchParams, "from"), "from"),
    to: parseSearchDateBoundary(getSingleSearchParam(searchParams, "to"), "to"),
    cursor: parseSearchCursor(searchParams),
    limit: parseSearchLimit(searchParams),
    mode: parseSearchMode(getSingleSearchParam(searchParams, "mode")),
  }
}

export function buildSearchResultItem(item: SearchResultItem): SearchResultItem {
  return searchResultItemSchema.parse(item)
}

export function buildSearchRow(item: SearchResultItem): SearchRow {
  return {
    canonicalTargetId: item.canonicalTargetId,
    target: item.normalizedTarget,
    title: item.title,
    technologies: [...item.technologies],
    lastScannedAt: {
      iso: item.lastScannedAt,
      label: formatSearchLastScannedAtLabel(item.lastScannedAt),
    },
    latestScan: {
      scanId: item.latestScanId,
      href: getSearchScanDetailHref(item.latestScanId),
      label: SEARCH_LATEST_SCAN_LINK_LABEL,
      ariaLabel: `${SEARCH_LATEST_SCAN_LINK_LABEL} for ${item.normalizedTarget}`,
    },
  }
}

export function buildSearchRows(items: readonly SearchResultItem[]): SearchRow[] {
  return items.map((item) => buildSearchRow(item))
}
