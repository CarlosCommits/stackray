"use client"

import { useId, useMemo, useState, type ElementType, type ReactNode } from "react"
import {
  Ban,
  Check,
  ChevronDown,
  Circle,
  Clock3,
  Minus,
  X,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { LocalTime } from "@/components/ui/local-time"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScanCompleteIndicator } from "@/components/ui/scan-complete-indicator"
import { SquareLoader } from "@/components/ui/square-loader"
import type { GetScanResponse, ScanPhaseRun } from "@/lib/contracts/scans"
import { cn } from "@/lib/utils"

type ScanPhaseKind = ScanPhaseRun["phase"]
type PipelinePhaseStatus = ScanPhaseRun["status"] | "pending" | "not_run"

interface PipelinePhase {
  phase: ScanPhaseKind
  run: ScanPhaseRun | null
  status: PipelinePhaseStatus
}

interface PipelineStageDefinition {
  id: string
  label: string
  phases: readonly ScanPhaseKind[]
}

const pipelineStages = [
  { id: "probe", label: "Probe", phases: ["http_probe"] },
  { id: "collect", label: "Collect", phases: ["headless", "browser_fallback", "subfinder"] },
  { id: "enrich", label: "Enrich", phases: ["nuclei_dns", "nuclei_http", "ip_intel"] },
  { id: "finish", label: "Finish", phases: ["finalize"] },
] as const satisfies readonly PipelineStageDefinition[]

const pipelinePhaseOrder = pipelineStages.flatMap((stage) => stage.phases)

const scanPhaseLabels: Record<ScanPhaseKind, string> = {
  http_probe: "HTTP probe",
  headless: "Headless",
  browser_fallback: "Browser recovery",
  subfinder: "Subfinder",
  nuclei_dns: "Nuclei DNS",
  nuclei_http: "Nuclei HTTP",
  ip_intel: "IP intel",
  finalize: "Finalize",
}

const terminalPhaseStatuses = new Set<PipelinePhaseStatus>([
  "completed",
  "failed",
  "skipped",
  "cancelled",
])

const browserRecoveryReasonLabels: Record<string, string> = {
  headless_enrichment_failed: "Headless enrichment failed",
  headless_screenshot_missing: "Headless screenshot missing",
  confirmed_block: "Confirmed block",
  suspected_cloudflare: "Suspected Cloudflare challenge",
  suspected_akamai: "Suspected Akamai challenge",
  suspected_datadome: "Suspected DataDome challenge",
  suspected_perimeterx: "Suspected PerimeterX challenge",
}

const browserRecoveryOutcomeLabels: Record<string, string> = {
  recovered: "Recovered",
  confirmed_block: "Confirmed block",
  no_recovery: "No recovery",
  disabled: "Disabled",
}

const phaseStatusPresentation: Record<
  PipelinePhaseStatus,
  {
    label: string
    shellClassName: string
    textClassName: string
    segmentClassName: string
    icon: ElementType
  }
> = {
  pending: {
    label: "Waiting",
    shellClassName: "border-[var(--gray-border)]/55 bg-[var(--surface-dark)] text-[var(--text-dim)]",
    textClassName: "text-[var(--text-dim)]",
    segmentClassName: "bg-[var(--gray-border)]/35",
    icon: Circle,
  },
  not_run: {
    label: "Not run",
    shellClassName: "border-[var(--gray-border)]/45 bg-[var(--surface-dark)] text-[var(--text-dim)]",
    textClassName: "text-[var(--text-dim)]",
    segmentClassName: "bg-[var(--gray-border)]/25",
    icon: Circle,
  },
  queued: {
    label: "Queued",
    shellClassName: "border-[var(--gray-border)]/70 bg-[var(--surface-dark)] text-[var(--muted-foreground)]",
    textClassName: "text-[var(--muted-foreground)]",
    segmentClassName: "bg-[var(--gray-border)]/60",
    icon: Clock3,
  },
  running: {
    label: "Running",
    shellClassName: "border-[var(--accent)]/55 bg-[var(--accent)]/10 text-[var(--accent)]",
    textClassName: "text-[var(--accent)]",
    segmentClassName: "bg-[var(--accent)] shadow-[0_0_10px_rgba(251,191,36,0.35)]",
    icon: Clock3,
  },
  completed: {
    label: "Completed",
    shellClassName: "border-emerald-400/60 bg-emerald-400/10 text-emerald-300",
    textClassName: "text-emerald-300",
    segmentClassName: "bg-emerald-400/80",
    icon: Check,
  },
  failed: {
    label: "Failed",
    shellClassName: "border-red-400/65 bg-red-400/10 text-red-300",
    textClassName: "text-red-300",
    segmentClassName: "bg-red-400/85",
    icon: X,
  },
  skipped: {
    label: "Skipped",
    shellClassName: "border-[var(--gray-border)]/70 bg-[var(--surface-dark)] text-[var(--text-dim)]",
    textClassName: "text-[var(--text-dim)]",
    segmentClassName: "bg-[var(--gray-border)]/70",
    icon: Minus,
  },
  cancelled: {
    label: "Cancelled",
    shellClassName: "border-amber-400/65 bg-amber-400/10 text-amber-300",
    textClassName: "text-amber-300",
    segmentClassName: "bg-amber-400/80",
    icon: Ban,
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function formatBrowserRecoveryValue(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
}

function getBrowserRecoveryDetails(phase: ScanPhaseRun) {
  if (phase.phase !== "browser_fallback") {
    return null
  }

  const meta = isRecord(phase.meta) ? phase.meta : {}
  const decision = isRecord(meta.decision) ? meta.decision : {}
  const reason = typeof decision.reason === "string" ? decision.reason : null
  const outcome = typeof meta.outcome === "string" ? meta.outcome : null
  const recovered = meta.recovered === true

  if (!reason && !outcome && !recovered) {
    return null
  }

  return {
    rows: [
      reason
        ? {
            label: "Reason",
            value: browserRecoveryReasonLabels[reason] ?? formatBrowserRecoveryValue(reason),
          }
        : null,
      outcome
        ? {
            label: "Outcome",
            value: browserRecoveryOutcomeLabels[outcome] ?? formatBrowserRecoveryValue(outcome),
          }
        : recovered
          ? { label: "Outcome", value: "Recovered" }
          : null,
    ].filter((row): row is { label: string; value: string } => row !== null),
  }
}

function formatDuration(startedAt: string | null, completedAt: string | null) {
  if (!startedAt || !completedAt) {
    return null
  }

  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime()

  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return null
  }

  if (durationMs < 1_000) {
    return `${durationMs}ms`
  }

  const totalSeconds = Math.round(durationMs / 1_000)

  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

function buildPipelinePhases(
  phases: ScanPhaseRun[],
  scanStatus: GetScanResponse["status"],
): PipelinePhase[] {
  const phaseByKind = new Map(phases.map((phase) => [phase.phase, phase]))
  const scanIsTerminal = scanStatus === "completed" || scanStatus === "failed" || scanStatus === "cancelled"

  return pipelinePhaseOrder.map((phase) => {
    const run = phaseByKind.get(phase) ?? null
    return {
      phase,
      run,
      status: run?.status ?? (scanIsTerminal ? "not_run" : "pending"),
    }
  })
}

function joinSummaryParts(parts: Array<string | null>) {
  return parts.filter((part): part is string => Boolean(part)).join(" · ")
}

function getPipelineSummary({
  completedAt,
  hasPhaseHistory,
  phases,
  scanStatus,
  submittedAt,
}: {
  completedAt: string | null
  hasPhaseHistory: boolean
  phases: PipelinePhase[]
  scanStatus: GetScanResponse["status"]
  submittedAt: string
}) {
  const completedCount = phases.filter((phase) => phase.status === "completed").length
  const skippedCount = phases.filter((phase) => phase.status === "skipped").length
  const failedPhases = phases.filter((phase) => phase.status === "failed")
  const cancelledCount = phases.filter((phase) => phase.status === "cancelled").length
  const runningPhases = phases.filter((phase) => phase.status === "running")
  const queuedCount = phases.filter((phase) => phase.status === "queued").length
  const terminalCount = phases.filter((phase) => terminalPhaseStatuses.has(phase.status)).length
  const duration = formatDuration(submittedAt, completedAt)

  if (scanStatus === "completed") {
    return {
      badge: null,
      detail: hasPhaseHistory
        ? joinSummaryParts([
            `${completedCount} completed`,
            skippedCount > 0 ? `${skippedCount} skipped` : null,
            duration,
          ])
        : joinSummaryParts(["Phase history unavailable", duration]),
      icon: null,
      title: "Scan complete",
      toneClassName: null,
      terminalCount,
    }
  }

  if (scanStatus === "failed") {
    const failedLabels = failedPhases.map((phase) => scanPhaseLabels[phase.phase]).join(", ")
    return {
      badge: "Failed",
      detail: joinSummaryParts([
        failedLabels ? `Failed at ${failedLabels}` : "Scan could not finish",
        `${terminalCount}/${phases.length} finished`,
        duration,
      ]),
      icon: XCircle,
      title: "Scan failed",
      toneClassName: "border-red-400/35 bg-red-400/8 text-red-300",
      terminalCount,
    }
  }

  if (scanStatus === "cancelled") {
    return {
      badge: "Cancelled",
      detail: joinSummaryParts([
        `${completedCount} completed`,
        cancelledCount > 0 ? `${cancelledCount} cancelled` : null,
        `${phases.length - terminalCount} not run`,
        duration,
      ]),
      icon: Ban,
      title: "Scan cancelled",
      toneClassName: "border-amber-400/35 bg-amber-400/8 text-amber-300",
      terminalCount,
    }
  }

  if (runningPhases.length > 0) {
    const activeLabels = runningPhases.map((phase) => scanPhaseLabels[phase.phase]).join(", ")
    return {
      badge: null,
      detail: joinSummaryParts([
        `${terminalCount}/${phases.length} finished`,
        `${runningPhases.length} active: ${activeLabels}`,
      ]),
      icon: null,
      title: "Scan in progress",
      toneClassName: null,
      terminalCount,
    }
  }

  return {
    badge: scanStatus === "pending" || scanStatus === "queued" ? "Queued" : "Preparing",
    detail: joinSummaryParts([
      `${terminalCount}/${phases.length} finished`,
      queuedCount > 0 ? `${queuedCount} queued` : "Pipeline initializing",
    ]),
    icon: Clock3,
    title: scanStatus === "pending" || scanStatus === "queued" ? "Scan queued" : "Preparing scan",
    toneClassName: "border-[var(--gray-border)]/55 bg-[var(--surface-mid)]/25 text-[var(--muted-foreground)]",
    terminalCount,
  }
}

function ScanPhaseDetails({ phase, children }: { phase: ScanPhaseRun; children: ReactNode }) {
  const presentation = phaseStatusPresentation[phase.status]
  const recoveryDetails = getBrowserRecoveryDetails(phase)

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-72 gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{scanPhaseLabels[phase.phase]}</p>
            <p className={cn("mt-0.5 text-xs font-semibold", presentation.textClassName)}>
              {presentation.label}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 rounded-md text-[10px] uppercase tracking-[0.12em]">
            Phase
          </Badge>
        </div>
        <div className="grid gap-1.5 text-xs text-[var(--muted-foreground)]">
          <div className="flex items-start justify-between gap-3">
            <span>Queued</span>
            <span className="text-right text-[var(--foreground)]">
              <LocalTime value={phase.queuedAt} preset="shortDateTimeWithZone" />
            </span>
          </div>
          {phase.startedAt ? (
            <div className="flex items-start justify-between gap-3">
              <span>Started</span>
              <span className="text-right text-[var(--foreground)]">
                <LocalTime value={phase.startedAt} preset="shortDateTimeWithZone" />
              </span>
            </div>
          ) : null}
          {phase.completedAt ? (
            <div className="flex items-start justify-between gap-3">
              <span>Finished</span>
              <span className="text-right text-[var(--foreground)]">
                <LocalTime value={phase.completedAt} preset="shortDateTimeWithZone" />
              </span>
            </div>
          ) : null}
        </div>
        {recoveryDetails ? (
          <div className="border-t border-[var(--gray-border)]/35 pt-2">
            <div className="grid gap-1.5 text-xs text-[var(--muted-foreground)]">
              {recoveryDetails.rows.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3">
                  <span>{row.label}</span>
                  <span className="text-right text-[var(--foreground)]">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {phase.errorMessage ? (
          <p className="border-t border-[var(--gray-border)]/35 pt-2 text-xs leading-relaxed text-red-300">
            {phase.errorMessage}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function PhaseStatusIcon({ phase }: { phase: PipelinePhase }) {
  const presentation = phaseStatusPresentation[phase.status]

  if (phase.status === "running") {
    return (
      <SquareLoader
        decorative
        label={`${scanPhaseLabels[phase.phase]} running`}
        color="var(--accent)"
        className="size-6"
        trackOpacity={0.18}
      />
    )
  }

  const StatusIcon = presentation.icon
  return <StatusIcon aria-hidden="true" className="size-3.5" strokeWidth={2.25} />
}

function PhaseRowContent({ phase }: { phase: PipelinePhase }) {
  const presentation = phaseStatusPresentation[phase.status]
  const duration = phase.run ? formatDuration(phase.run.startedAt, phase.run.completedAt) : null

  return (
    <>
      {phase.status === "completed" ? (
        <ScanCompleteIndicator decorative />
      ) : phase.status === "running" ? (
        <PhaseStatusIcon phase={phase} />
      ) : (
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md border",
            presentation.shellClassName,
          )}
        >
          <PhaseStatusIcon phase={phase} />
        </span>
      )}
      <span className="min-w-0 flex-1 text-left xl:flex-none">
        <span className="block truncate text-xs font-semibold text-[var(--foreground)] xl:line-clamp-2 xl:whitespace-normal xl:leading-tight">
          {scanPhaseLabels[phase.phase]}
        </span>
        <span className={cn("mt-0.5 block truncate text-[10px] font-medium", presentation.textClassName)}>
          {duration ?? presentation.label}
        </span>
      </span>
    </>
  )
}

function PhaseRow({ phase }: { phase: PipelinePhase }) {
  const presentation = phaseStatusPresentation[phase.status]
  const className = cn(
    "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-md border border-transparent px-2 py-1.5 xl:h-full xl:min-h-[5.25rem] xl:flex-col xl:items-start xl:justify-center xl:gap-2 xl:rounded-none xl:border-0 xl:px-2.5 xl:py-3",
    phase.run
      ? "transition-[background-color,border-color,transform] duration-200 hover:border-[var(--gray-border)]/55 hover:bg-[var(--surface-mid)]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/65 active:translate-y-px"
      : "cursor-default opacity-70",
    phase.status === "running" && "border-[var(--accent)]/20 bg-[var(--accent)]/5",
    phase.status === "failed" && "border-red-400/20 bg-red-400/5",
  )

  if (!phase.run) {
    return (
      <div className={className} data-phase={phase.phase} data-status={phase.status}>
        <PhaseRowContent phase={phase} />
      </div>
    )
  }

  const row = (
    <button
      type="button"
      className={className}
      data-phase={phase.phase}
      data-status={phase.status}
      aria-current={phase.status === "running" ? "step" : undefined}
      aria-label={`${scanPhaseLabels[phase.phase]} ${presentation.label.toLowerCase()}`}
      title={phase.run.errorMessage ?? undefined}
    >
      <PhaseRowContent phase={phase} />
    </button>
  )

  return <ScanPhaseDetails phase={phase.run}>{row}</ScanPhaseDetails>
}

function PipelineStageGrid({ phases, className, id }: { phases: PipelinePhase[]; className?: string; id?: string }) {
  const phaseByKind = new Map(phases.map((phase) => [phase.phase, phase]))

  return (
    <ol id={id} aria-label="Scan pipeline stages" className={cn("gap-2", className)}>
      {pipelineStages.map((stage) => {
        const stagePhases = stage.phases.map((phase) => phaseByKind.get(phase)).filter((phase): phase is PipelinePhase => Boolean(phase))
        const finishedCount = stagePhases.filter((phase) => terminalPhaseStatuses.has(phase.status)).length
        const stageColumnClassName = stagePhases.length === 1 ? "xl:col-span-1" : "xl:col-span-3"
        const phaseGridClassName = stagePhases.length === 1 ? "xl:grid-cols-1" : "xl:grid-cols-3"

        return (
          <li
            key={stage.id}
            data-pipeline-stage={stage.id}
            className={cn(
              "overflow-hidden rounded-lg border border-[var(--gray-border)]/40 bg-[var(--surface-mid)]/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]",
              "xl:grid xl:grid-rows-[auto_1fr] xl:rounded-none xl:border-0 xl:bg-transparent xl:shadow-none",
              stageColumnClassName,
              stage.id !== "finish" && "xl:border-r xl:border-[var(--gray-border)]/45",
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--gray-border)]/35 px-3 py-2">
              <span className="font-heading text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                {stage.label}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-[var(--text-dim)]">
                {finishedCount}/{stagePhases.length}
              </span>
            </div>
            <ul className={cn("grid gap-0.5 p-1.5 xl:h-full xl:gap-0 xl:p-0", phaseGridClassName)}>
              {stagePhases.map((phase, phaseIndex) => (
                <li
                  key={phase.phase}
                  className={cn(
                    "min-w-0",
                    phaseIndex < stagePhases.length - 1 && "xl:border-r xl:border-[var(--gray-border)]/40",
                  )}
                >
                  <PhaseRow phase={phase} />
                </li>
              ))}
            </ul>
          </li>
        )
      })}
    </ol>
  )
}

function PipelineSegments({ phases, terminalCount, summary }: { phases: PipelinePhase[]; terminalCount: number; summary: string }) {
  return (
    <div
      role="progressbar"
      aria-label="Scan pipeline progress"
      aria-valuemin={0}
      aria-valuemax={phases.length}
      aria-valuenow={terminalCount}
      aria-valuetext={summary}
      className="grid grid-cols-8 gap-1"
      data-slot="scan-pipeline-segments"
    >
      {phases.map((phase) => (
        <span
          key={phase.phase}
          aria-hidden="true"
          title={`${scanPhaseLabels[phase.phase]}: ${phaseStatusPresentation[phase.status].label}`}
          className={cn("h-1.5 rounded-sm", phaseStatusPresentation[phase.status].segmentClassName)}
        />
      ))}
    </div>
  )
}

export function ScanProgressPipeline({
  completedAt,
  phases,
  scanStatus,
  submittedAt,
}: {
  completedAt: string | null
  phases: ScanPhaseRun[]
  scanStatus: GetScanResponse["status"]
  submittedAt: string
}) {
  const detailsId = useId()
  const [detailsPreference, setDetailsPreference] = useState<"auto" | "closed" | "open">("auto")
  const pipelinePhases = useMemo(() => buildPipelinePhases(phases, scanStatus), [phases, scanStatus])
  const summary = getPipelineSummary({
    completedAt,
    hasPhaseHistory: phases.length > 0,
    phases: pipelinePhases,
    scanStatus,
    submittedAt,
  })
  const SummaryIcon = summary.icon
  const shouldAutoOpen = scanStatus === "failed" || scanStatus === "cancelled"
  const detailsOpen = detailsPreference === "open" || (detailsPreference === "auto" && shouldAutoOpen)

  return (
    <section aria-labelledby={`${detailsId}-title`} data-slot="scan-progress-pipeline">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {scanStatus === "completed" ? (
            <ScanCompleteIndicator decorative className="mt-0.5 size-8" iconClassName="size-7" />
          ) : SummaryIcon ? (
            <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border", summary.toneClassName)}>
              <SummaryIcon aria-hidden="true" className="size-4" strokeWidth={2.15} />
            </span>
          ) : (
            <SquareLoader
              decorative
              label="Scan in progress"
              color="var(--accent)"
              className="mt-0.5 size-8"
              trackOpacity={0.18}
            />
          )}
          <div className="min-w-0">
            <h2 id={`${detailsId}-title`} className="font-heading text-sm font-semibold text-[var(--foreground)]">
              {summary.title}
            </h2>
            <p aria-live="polite" className="mt-0.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
              {summary.detail}
            </p>
          </div>
        </div>
        {summary.badge ? (
          <span
            data-slot="scan-pipeline-status-badge"
            className={cn(
              "inline-flex shrink-0 items-center rounded-md border px-2 py-1 font-heading text-[9px] font-semibold uppercase tracking-[0.14em]",
              summary.toneClassName,
            )}
          >
            {summary.badge}
          </span>
        ) : null}
      </div>

      <div className="mt-3 md:hidden">
        <PipelineSegments phases={pipelinePhases} terminalCount={summary.terminalCount} summary={summary.detail} />
        <button
          type="button"
          aria-expanded={detailsOpen}
          aria-controls={detailsId}
          data-slot="scan-pipeline-disclosure"
          className="mt-2 flex min-h-11 w-full items-center justify-between rounded-md px-1 text-xs font-semibold text-[var(--muted-foreground)] transition-[color,background-color] hover:bg-[var(--surface-mid)]/25 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/65 active:bg-[var(--surface-mid)]/40"
          onClick={() => setDetailsPreference(detailsOpen ? "closed" : "open")}
        >
          <span>{detailsOpen ? "Hide phase details" : "View all 8 phases"}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", detailsOpen && "rotate-180")}
          />
        </button>
      </div>

      <PipelineStageGrid
        id={detailsId}
        phases={pipelinePhases}
        className={cn(
          "mt-3 grid-cols-1 md:mt-4 md:grid-cols-2 xl:grid-cols-8 xl:gap-0 xl:overflow-hidden xl:rounded-lg xl:border xl:border-[var(--gray-border)]/45 xl:bg-[var(--surface-mid)]/12",
          detailsOpen ? "grid" : "hidden md:grid",
        )}
      />
    </section>
  )
}
