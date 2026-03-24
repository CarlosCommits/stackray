import type { ScanListItem } from "@/lib/contracts/scans"

export const HISTORY_COLUMNS = [
  { key: "submittedAt", label: "Submitted at" },
  { key: "targetCount", label: "Target count" },
  { key: "status", label: "Status" },
  { key: "source", label: "Source" },
  { key: "createdBy", label: "Created by" },
  { key: "duration", label: "Duration" },
  { key: "topTechnologies", label: "Top technologies" },
] as const

export const HISTORY_UNAVAILABLE_LABEL = "--"
export const HISTORY_TOP_TECHNOLOGIES_VISIBLE_LIMIT = 3

export type HistoryColumnKey = (typeof HISTORY_COLUMNS)[number]["key"]
export type HistorySourceValue = ScanListItem["source"]
export type HistoryStatusValue = "queued" | "running" | "completed" | "failed" | "cancelled"
export type HistoryCreatedByKind = "user" | "token" | "system" | "unknown"

export const HISTORY_STATUS_NORMALIZATION = {
  pending: "queued",
  queued: "queued",
  running: "running",
  processing: "running",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
} as const satisfies Record<ScanListItem["status"], HistoryStatusValue>

export const HISTORY_STATUS_LABELS = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
} as const satisfies Record<HistoryStatusValue, string>

export const HISTORY_SOURCE_LABELS = {
  ui: "UI",
  cli: "CLI",
  api: "API",
  system: "System",
} as const satisfies Record<HistorySourceValue, string>

export const HISTORY_PROFILE_VALUES = ["stack-deep"] as const
export type HistoryProfileValue = (typeof HISTORY_PROFILE_VALUES)[number]

export interface HistoryRowSubmittedAt {
  iso: string
  label: string
}

export interface HistoryRowTargetCount {
  value: number
  label: string
}

export interface HistoryRowStatus {
  rawValue: ScanListItem["status"]
  value: HistoryStatusValue
  label: string
}

export interface HistoryRowSource {
  value: HistorySourceValue
  label: string
}

export interface HistoryRowCreatedBy {
  label: string
  kind: HistoryCreatedByKind
  userId: string | null
  tokenId: string | null
}

export interface HistoryRowDuration {
  label: string
  milliseconds: number | null
  submittedAtIso: string
  completedAtIso: string | null
}

export interface HistoryRowTopTechnologies {
  visibleItems: string[]
  totalCount: number
  hiddenCount: number
  truncated: boolean
  overflowLabel: string | null
  searchTokens: string[]
}

export interface HistoryRowFilters {
  profile: ScanListItem["profile"]
  hiddenTargets: string[]
}

export interface HistoryRow {
  scanId: string
  href: string
  submittedAt: HistoryRowSubmittedAt
  targetCount: HistoryRowTargetCount
  status: HistoryRowStatus
  source: HistoryRowSource
  createdBy: HistoryRowCreatedBy
  duration: HistoryRowDuration
  topTechnologies: HistoryRowTopTechnologies
  filters: HistoryRowFilters
}

export function normalizeHistoryStatus(status: ScanListItem["status"]): HistoryStatusValue {
  return HISTORY_STATUS_NORMALIZATION[status]
}

export function getHistoryStatusLabel(status: HistoryStatusValue): string {
  return HISTORY_STATUS_LABELS[status]
}

export function getHistorySourceLabel(source: HistorySourceValue): string {
  return HISTORY_SOURCE_LABELS[source]
}

export function formatHistoryTargetCount(targetCount: number): string {
  return `${targetCount} target${targetCount === 1 ? "" : "s"}`
}

export function formatHistoryDuration(milliseconds: number): string {
  if (milliseconds < 1_000) {
    return `${milliseconds}ms`
  }

  return `${(milliseconds / 1_000).toFixed(1)}s`
}

export function deriveHistoryDuration(
  submittedAtIso: string,
  completedAtIso: string | null,
): HistoryRowDuration {
  if (!completedAtIso) {
    return {
      label: HISTORY_UNAVAILABLE_LABEL,
      milliseconds: null,
      submittedAtIso,
      completedAtIso,
    }
  }

  const submittedAt = new Date(submittedAtIso).getTime()
  const completedAt = new Date(completedAtIso).getTime()
  const rawDuration = completedAt - submittedAt
  const milliseconds = Number.isFinite(rawDuration) ? Math.max(0, rawDuration) : null

  return {
    label: milliseconds === null ? HISTORY_UNAVAILABLE_LABEL : formatHistoryDuration(milliseconds),
    milliseconds,
    submittedAtIso,
    completedAtIso,
  }
}

export function summarizeHistoryTopTechnologies(
  technologies: string[],
  limit = HISTORY_TOP_TECHNOLOGIES_VISIBLE_LIMIT,
): HistoryRowTopTechnologies {
  const visibleItems = technologies.slice(0, limit)
  const hiddenCount = Math.max(technologies.length - visibleItems.length, 0)

  return {
    visibleItems,
    totalCount: technologies.length,
    hiddenCount,
    truncated: hiddenCount > 0,
    overflowLabel: hiddenCount > 0 ? `+${hiddenCount} more` : null,
    searchTokens: [...technologies],
  }
}

export function getHistoryScanDetailHref(scanId: string): string {
  return `/scans/${scanId}`
}
