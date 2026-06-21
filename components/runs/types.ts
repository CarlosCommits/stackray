import type { ScanListItem } from "@/lib/contracts/scans"

export const RUNS_COLUMNS = [
  { key: "submittedAt", label: "Submitted at" },
  { key: "targetUrls", label: "Targets" },
  { key: "status", label: "Status" },
  { key: "source", label: "Source" },
  { key: "createdBy", label: "Created by" },
  { key: "duration", label: "Duration" },
  { key: "topTechnologies", label: "Top technologies" },
] as const

export const RUNS_UNAVAILABLE_LABEL = "--"
const RUNS_TOP_TECHNOLOGIES_VISIBLE_LIMIT = 3

export type RunsSourceValue = ScanListItem["source"]
export type RunsStatusValue = "queued" | "running" | "completed" | "failed" | "cancelled"
export type RunsPhaseKind = "http_probe" | "headless" | "browser_fallback" | "subfinder" | "nuclei_dns" | "nuclei_http" | "ip_intel" | "finalize"
export type RunsPhaseStatus = "queued" | "running" | "completed" | "failed" | "skipped" | "cancelled"
type RunsCreatedByKind = "user" | "apiKey" | "system" | "unknown"

export const RUNS_STATUS_NORMALIZATION = {
  pending: "queued",
  queued: "queued",
  running: "running",
  processing: "running",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
} as const satisfies Record<ScanListItem["status"], RunsStatusValue>

export const RUNS_STATUS_LABELS = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
} as const satisfies Record<RunsStatusValue, string>

export const RUNS_SOURCE_LABELS = {
  ui: "UI",
  cli: "CLI",
  api: "API",
  system: "System",
} as const satisfies Record<RunsSourceValue, string>

export const RUNS_PHASE_LABELS = {
  http_probe: "HTTP probe",
  headless: "Headless",
  browser_fallback: "Browser recovery",
  subfinder: "Subfinder",
  nuclei_dns: "Nuclei DNS",
  nuclei_http: "Nuclei HTTP",
  ip_intel: "IP intel",
  finalize: "Finalize",
} as const satisfies Record<RunsPhaseKind, string>

interface RunsRowSubmittedAt {
  iso: string
  label: string
}

interface RunsRowTargetCount {
  value: number
  label: string
}

interface RunsRowStatus {
  rawValue: ScanListItem["status"]
  value: RunsStatusValue
  label: string
}

interface RunsRowSource {
  value: RunsSourceValue
  label: string
}

export interface RunsRowCreatedBy {
  label: string
  kind: RunsCreatedByKind
  userId: string | null
  apiKeyId: string | null
}

export interface RunsRowDuration {
  label: string
  milliseconds: number | null
  submittedAtIso: string
  completedAtIso: string | null
}

export interface RunsRowTopTechnologies {
  visibleItems: string[]
  totalCount: number
  hiddenCount: number
  truncated: boolean
  overflowLabel: string | null
  searchTokens: string[]
}

export interface RunsRowPhase {
  phase: RunsPhaseKind
  status: RunsPhaseStatus
  label: string
}

export interface RunsRowPhases {
  activeLabel: string | null
  items: RunsRowPhase[]
}

interface RunsRowFilters {
  hiddenTargets: string[]
}

export interface RunsRow {
  scanId: string
  href: string
  submittedAt: RunsRowSubmittedAt
  targetCount: RunsRowTargetCount
  targetUrls: string[]
  hiddenTargetCount: number
  faviconUrl: string | null
  status: RunsRowStatus
  source: RunsRowSource
  createdBy: RunsRowCreatedBy
  duration: RunsRowDuration
  phases: RunsRowPhases
  topTechnologies: RunsRowTopTechnologies
  filters: RunsRowFilters
}

export function normalizeRunsStatus(status: ScanListItem["status"]): RunsStatusValue {
  return RUNS_STATUS_NORMALIZATION[status]
}

export function getRunsStatusLabel(status: RunsStatusValue): string {
  return RUNS_STATUS_LABELS[status]
}

export function getRunsSourceLabel(source: RunsSourceValue): string {
  return RUNS_SOURCE_LABELS[source]
}

export function getRunsPhaseLabel(phase: RunsPhaseKind): string {
  return RUNS_PHASE_LABELS[phase]
}

export function formatRunsTargetCount(targetCount: number): string {
  return `${targetCount} target${targetCount === 1 ? "" : "s"}`
}

function formatRunsDuration(milliseconds: number): string {
  if (milliseconds < 1_000) {
    return `${milliseconds}ms`
  }

  return `${(milliseconds / 1_000).toFixed(1)}s`
}

export function deriveRunsDuration(
  submittedAtIso: string,
  completedAtIso: string | null,
): RunsRowDuration {
  if (!completedAtIso) {
    return {
      label: RUNS_UNAVAILABLE_LABEL,
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
    label: milliseconds === null ? RUNS_UNAVAILABLE_LABEL : formatRunsDuration(milliseconds),
    milliseconds,
    submittedAtIso,
    completedAtIso,
  }
}

export function summarizeRunsTopTechnologies(
  technologies: string[],
  limit = RUNS_TOP_TECHNOLOGIES_VISIBLE_LIMIT,
): RunsRowTopTechnologies {
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

export function getRunsScanDetailHref(scanId: string): string {
  return `/scans/${scanId}`
}
