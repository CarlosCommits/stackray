"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import type * as React from "react"
import {
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe,
  MapPin,
  MinusCircle,
  Server,
  Shield,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { LocalTime } from "@/components/ui/local-time"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ScanPhaseRun } from "@/lib/contracts/scans"
import type { ContentSignalsSection, OverviewSection } from "@/lib/server/scans/scan-detail-view-model"
import { cn } from "@/lib/utils"

import {
  CompactKPI,
  FaviconImage,
  type FaviconPreview,
  MetricValue,
  SummaryMetricTile,
  compactPanelClass,
  getHttpStatusColor,
  getHttpStatusSummary,
  surfacePanelClass,
} from "./shared"

const scanPhaseLabels: Record<ScanPhaseRun["phase"], string> = {
  http_probe: "HTTP probe",
  headless: "Headless",
  browser_fallback: "Browser recovery",
  subfinder: "Subfinder",
  nuclei_dns: "Nuclei DNS",
  nuclei_http: "Nuclei HTTP",
  ip_intel: "IP intel",
  finalize: "Finalize",
}


const scanPhaseStatusPresentation: Record<
  ScanPhaseRun["status"],
  { textClassName: string; dotClassName: string; lineClassName: string; icon: React.ElementType }
> = {
  queued: {
    textClassName: "text-[var(--muted-foreground)]",
    dotClassName: "border-[var(--gray-border)] bg-[var(--surface-dark)] text-[var(--muted-foreground)]",
    lineClassName: "bg-[var(--gray-border)]/35",
    icon: Clock,
  },
  running: {
    textClassName: "text-[var(--accent)]",
    dotClassName: "border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--accent)]",
    lineClassName: "bg-[var(--accent)]/65",
    icon: Clock,
  },
  completed: {
    textClassName: "text-emerald-400",
    dotClassName: "border-emerald-400/70 bg-emerald-400/10 text-emerald-300",
    lineClassName: "bg-emerald-400/60",
    icon: CheckCircle2,
  },
  failed: {
    textClassName: "text-red-400",
    dotClassName: "border-red-400/70 bg-red-400/10 text-red-300",
    lineClassName: "bg-red-400/60",
    icon: XCircle,
  },
  skipped: {
    textClassName: "text-[var(--text-dim)]",
    dotClassName: "border-[var(--gray-border)] bg-[var(--surface-dark)] text-[var(--text-dim)]",
    lineClassName: "bg-[var(--gray-border)]/35",
    icon: MinusCircle,
  },
  cancelled: {
    textClassName: "text-amber-400",
    dotClassName: "border-amber-400/70 bg-amber-400/10 text-amber-300",
    lineClassName: "bg-amber-400/60",
    icon: MinusCircle,
  },
}

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
          ? {
              label: "Outcome",
              value: "Recovered",
            }
          : null,
    ].filter((row): row is { label: string; value: string } => row !== null),
  }
}

export function getScanPhaseConnectorClassName(previousPhase: ScanPhaseRun, currentPhase: ScanPhaseRun) {
  if (previousPhase.status === "failed" || currentPhase.status === "failed") {
    return scanPhaseStatusPresentation.failed.lineClassName
  }

  if (previousPhase.status === "cancelled" || currentPhase.status === "cancelled") {
    return scanPhaseStatusPresentation.cancelled.lineClassName
  }

  if (previousPhase.status === "running" || currentPhase.status === "running") {
    return scanPhaseStatusPresentation.running.lineClassName
  }

  if (previousPhase.status === "completed" || previousPhase.status === "skipped") {
    return scanPhaseStatusPresentation.completed.lineClassName
  }

  return scanPhaseStatusPresentation[previousPhase.status].lineClassName
}

export function ScanProgressTimeline({ phases }: { phases: ScanPhaseRun[] }) {
  if (phases.length === 0) {
    return null
  }

  return (
    <section className={`${surfacePanelClass} px-4 py-3`}>
      <ScanProgressTimelineTrack phases={phases} />
    </section>
  )
}

function ScanProgressTimelineTrack({ phases }: { phases: ScanPhaseRun[] }) {
  const terminalStatuses = new Set<ScanPhaseRun["status"]>(["completed", "failed", "skipped", "cancelled"])
  const completedCount = phases.filter((phase) => phase.status === "completed").length
  const terminalCount = phases.filter((phase) => terminalStatuses.has(phase.status)).length
  const activePhase =
    phases.find((phase) => phase.status === "running")
    ?? phases.find((phase) => phase.status === "queued")
    ?? phases.find((phase) => phase.status === "failed" || phase.status === "cancelled")
    ?? null
  const mobileSummary = activePhase
    ? `${activePhase.status === "running" ? "Running" : activePhase.status === "queued" ? "Queued" : activePhase.status}: ${scanPhaseLabels[activePhase.phase]}`
    : completedCount === phases.length
      ? `${completedCount}/${phases.length} completed`
      : `${terminalCount}/${phases.length} finished`

  return (
    <>
      <div className="md:hidden">
        <div className="grid px-1" style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}>
          {phases.map((phase, phaseIndex) => {
            const presentation = scanPhaseStatusPresentation[phase.status]
            const StatusIcon = presentation.icon
            const previousPhase = phases[phaseIndex - 1]
            const lineClassName = previousPhase ? getScanPhaseConnectorClassName(previousPhase, phase) : presentation.lineClassName

            return (
              <div key={phase.phaseId} className="relative flex min-w-0 justify-center py-1.5">
                {phaseIndex > 0 && (
                  <span
                    aria-hidden="true"
                    className={cn("absolute left-[-50%] right-1/2 top-1/2 h-px -translate-y-1/2", lineClassName)}
                  />
                )}
                <ScanPhasePopover phase={phase}>
                  <button
                    type="button"
                    className={cn(
                      "relative z-10 flex size-7 items-center justify-center rounded-full border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/70 active:scale-95",
                      presentation.dotClassName,
                      phase.status === "running" && "animate-pulse",
                    )}
                    aria-label={`${scanPhaseLabels[phase.phase]} ${phase.status}`}
                  >
                    <StatusIcon className="size-4" />
                  </button>
                </ScanPhasePopover>
              </div>
            )
          })}
        </div>
        <p className="mt-2 truncate text-center text-xs font-semibold text-[var(--muted-foreground)]">{mobileSummary}</p>
      </div>

      <div className="hidden pb-1 md:block">
        <div className="grid min-w-0" style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(74px, 1fr))` }}>
          {phases.map((phase, phaseIndex) => {
            const presentation = scanPhaseStatusPresentation[phase.status]
            const StatusIcon = presentation.icon
            const previousPhase = phases[phaseIndex - 1]
            const lineClassName = previousPhase ? getScanPhaseConnectorClassName(previousPhase, phase) : presentation.lineClassName

            return (
              <div key={phase.phaseId} className="relative flex min-w-0 flex-col items-center pt-2 text-center">
                {phaseIndex > 0 && (
                  <span
                    aria-hidden="true"
                    className={cn("absolute left-[-50%] right-1/2 top-[18px] h-px", lineClassName)}
                  />
                )}
                <ScanPhasePopover phase={phase}>
                  <button
                    type="button"
                    className={cn(
                      "relative z-10 flex size-5 items-center justify-center rounded-full border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/70 active:scale-95",
                      presentation.dotClassName,
                      phase.status === "running" && "animate-pulse",
                    )}
                    title={phase.errorMessage ?? undefined}
                    aria-label={`${scanPhaseLabels[phase.phase]} ${phase.status}`}
                  >
                    <StatusIcon className="size-3.5" />
                  </button>
                </ScanPhasePopover>
                <span className="mt-2 text-xs font-semibold text-[var(--foreground)] sm:text-sm">{scanPhaseLabels[phase.phase]}</span>
                <span className={cn("mt-0.5 text-xs font-semibold uppercase tracking-[0.08em]", presentation.textClassName)}>{phase.status}</span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function ScanPhasePopover({
  phase,
  children,
}: {
  phase: ScanPhaseRun
  children: React.ReactNode
}) {
  const presentation = scanPhaseStatusPresentation[phase.status]
  const recoveryDetails = getBrowserRecoveryDetails(phase)

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-72 gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{scanPhaseLabels[phase.phase]}</p>
            <p className={cn("mt-0.5 text-xs font-semibold capitalize", presentation.textClassName)}>{phase.status}</p>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px] uppercase tracking-[0.12em]">
            Step
          </Badge>
        </div>
        <div className="grid gap-1.5 text-xs text-[var(--muted-foreground)]">
          <div className="flex items-start justify-between gap-3">
            <span>Queued</span>
            <span className="text-right text-[var(--foreground)]">
              <LocalTime value={phase.queuedAt} preset="shortDateTimeWithZone" />
            </span>
          </div>
          {phase.startedAt && (
            <div className="flex items-start justify-between gap-3">
              <span>Started</span>
              <span className="text-right text-[var(--foreground)]">
                <LocalTime value={phase.startedAt} preset="shortDateTimeWithZone" />
              </span>
            </div>
          )}
          {phase.completedAt && (
            <div className="flex items-start justify-between gap-3">
              <span>Completed</span>
              <span className="text-right text-[var(--foreground)]">
                <LocalTime value={phase.completedAt} preset="shortDateTimeWithZone" />
              </span>
            </div>
          )}
        </div>
        {recoveryDetails ? (
          <div className="border-t border-[var(--gray-border)]/20 pt-2">
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
        {phase.errorMessage && (
          <p className="border-t border-[var(--gray-border)]/20 pt-2 text-xs leading-relaxed text-red-300">
            {phase.errorMessage}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function ScanOverviewBand({
  content,
  target,
  overview,
  phases,
}: {
  content: ContentSignalsSection | null
  target: string
  overview?: OverviewSection | null
  phases: ScanPhaseRun[]
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--gray-border)]/45 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-dark)_92%,transparent)_0%,color-mix(in_srgb,var(--surface-dark)_70%,transparent)_100%)] ring-1 ring-white/5">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_430px] xl:grid-cols-[minmax(0,1fr)_480px]">
        <div className="flex min-w-0 flex-col justify-center px-4 py-5 sm:px-5 lg:pl-7 xl:pl-8">
          <ResponseMetricStrip overview={overview} />
          {phases.length > 0 ? (
            <div className="relative mt-6 pt-5 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--gray-border)]/24">
              <ScanProgressTimelineTrack phases={phases} />
            </div>
          ) : null}
        </div>
        <div className="relative flex items-center before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-[var(--gray-border)]/24 lg:before:inset-y-4 lg:before:left-0 lg:before:h-auto lg:before:w-px">
          {content ? <ScreenshotFrame content={content} target={target} /> : <ScreenshotPlaceholder />}
        </div>
      </div>
    </section>
  )
}

export function MainScreenshotPreview({ content, target }: { content: ContentSignalsSection; target: string }) {
  return (
    <section className={`${compactPanelClass} overflow-hidden p-3`}>
      <ScreenshotFrame content={content} target={target} />
    </section>
  )
}

function ResponseMetricStrip({ overview }: { overview?: OverviewSection | null }) {
  const statusValue = overview?.statusText
    ? `${overview.statusCode} ${overview.statusText}`
    : overview?.statusCode
      ? String(overview.statusCode)
      : "N/A"
  const hostedProvider = getHostedProviderDisplay(overview?.server ?? null)

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-x-0 lg:grid-cols-4 [&>*:not(:first-child)]:sm:border-l-2 [&>*:not(:first-child)]:sm:border-[var(--gray-border)]/70">
      <ScreenshotMetricItem
        icon={Shield}
        label="Status"
        value={statusValue}
        subValue={overview ? getHttpStatusSummary(overview.statusCode) : undefined}
        color={overview ? getHttpStatusColor(overview.statusCode) : "accent"}
      />
      <ScreenshotMetricItem
        icon={ArrowLeftRight}
        label="Redirects"
        value={overview?.redirectCount ?? "N/A"}
        subValue={overview ? (overview.redirectCount === 1 ? "1 hop" : `${overview.redirectCount} hops`) : undefined}
        color="accent"
      />
      <ScreenshotMetricItem
        icon={Server}
        label="Hosted On"
        value={hostedProvider.value}
        fullValue={hostedProvider.fullValue}
        subValue={overview?.cdnName}
        color="accent"
      />
      <ScreenshotMetricItem
        icon={MapPin}
        label="Host IP"
        value={overview?.hostIp ?? "N/A"}
        subValue={overview?.asnOrg ?? undefined}
        color="accent"
      />
    </div>
  )
}

function ScreenshotFrame({ content, target }: { content: ContentSignalsSection; target: string }) {
  const { screenshot } = content
  const [imageAspectRatio, setImageAspectRatio] = useState<string | null>(null)

  if (!screenshot.available || !screenshot.path) {
    return <ScreenshotPlaceholder />
  }

  function handleScreenshotLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = event.currentTarget

    if (naturalWidth > 0 && naturalHeight > 0) {
      setImageAspectRatio(`${naturalWidth} / ${naturalHeight}`)
    }
  }

  return (
    <div
      className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-[var(--surface-mid)]"
      style={imageAspectRatio ? { aspectRatio: imageAspectRatio } : undefined}
    >
      <Image
        src={screenshot.path}
        alt={`Homepage screenshot for ${target}`}
        fill
        unoptimized
        priority
        sizes="(max-width: 1024px) 100vw, 400px"
        className="object-contain"
        onLoad={handleScreenshotLoad}
      />
    </div>
  )
}

function ScreenshotPlaceholder() {
  return (
    <div className="flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[var(--surface-mid)] to-[var(--surface-dark)]">
      <div className="text-center">
        <Globe className="mx-auto mb-3 size-12 text-[var(--muted-foreground)]" />
        <p className="text-sm text-[var(--muted-foreground)]">Screenshot not available</p>
      </div>
    </div>
  )
}

function ScreenshotMetricItem({
  icon: Icon,
  label,
  value,
  fullValue,
  subValue,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  fullValue?: string
  subValue?: string
  color: "accent" | "emerald" | "amber" | "orange" | "red"
}) {
  const colorClasses = {
    accent: "text-[var(--accent)]",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    orange: "text-orange-400",
    red: "text-red-400",
  }

  return (
    <div className="py-2 pr-4 sm:first:pl-0 [&:not(:first-child)]:sm:pl-5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon className={cn("size-3.5 shrink-0", colorClasses[color])} />
        <span className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
          {label}
        </span>
      </div>
      <MetricValue value={value} fullValue={fullValue} className={cn(colorClasses[color], "text-lg leading-tight")} />
      {subValue ? (
        <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]" title={subValue}>
          {subValue}
        </p>
      ) : null}
    </div>
  )
}

// ScanAttemptFallbackPill: a compact, tappable pill that summarizes a
// fallback reason. The full reason text is often a long sentence (e.g.
// "Received authoritative 429 after Baseline."), so we show a short label
// and reveal the full text via a popover that works on both touch and
// desktop.
function ScanAttemptFallbackPill({ fallbackReason }: { fallbackReason: string }) {
  const summary = summarizeFallbackReason(fallbackReason)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-full shrink-0 cursor-pointer items-center gap-1.5 border border-amber-400/30 bg-amber-400/5 px-2 py-0.5 text-xs text-amber-400 transition-colors hover:border-amber-400/50 hover:bg-amber-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
          aria-label={`Fallback reason: ${fallbackReason}`}
        >
          <ArrowLeftRight className="size-3 shrink-0" />
          <span className="truncate">{summary}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="z-[80] w-72 gap-1 border border-amber-400/25 bg-[#10161d] p-3 text-xs leading-relaxed text-[var(--foreground)] shadow-[0_26px_70px_-26px_rgba(0,0,0,0.95)] ring-1 ring-white/8"
      >
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400">
          Fallback reason
        </p>
        <p>{fallbackReason}</p>
      </PopoverContent>
    </Popover>
  )
}

function summarizeFallbackReason(reason: string): string {
  // Worker-generated reasons look like:
  //   "Received authoritative 429 after Baseline."
  //   "Received degraded text/html result after Browser Headers."
  // Pull out the status code / content type for a compact pill label.
  const statusCodeMatch = reason.match(/authoritative\s+(\d{3})/i)
  if (statusCodeMatch) {
    return `HTTP ${statusCodeMatch[1]} fallback`
  }

  const degradedMatch = reason.match(/degraded\s+(\S+)/i)
  if (degradedMatch) {
    return `Degraded ${degradedMatch[1]}`
  }

  // Generic fallback: truncate to a reasonable length.
  return reason.length > 32 ? `${reason.slice(0, 30)}…` : reason
}

// Header Component
export function ScanDetailHeader({
  target,
  status,
  submittedAt,
  currentAttempt,
  attemptHistory,
  favicon,
  pageTitle,
  finalUrl,
}: {
  target: string
  status: "completed" | "running" | "failed" | "cancelled"
  submittedAt: string
  currentAttempt: { attemptNumber: number; requestProfile: string; fallbackReason: string | null } | null
  attemptHistory: Array<{ attemptNumber: number; status: string; requestProfile: string; fallbackReason: string | null }>
  favicon?: FaviconPreview | null
  pageTitle?: string | null
  finalUrl?: string | null
}) {
  const targetHref = target.startsWith("http") ? target : `https://${target}`
  const hasPageContext = Boolean(pageTitle || finalUrl)

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--gray-border)]/45 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-dark)_92%,transparent)_0%,color-mix(in_srgb,var(--surface-dark)_72%,transparent)_100%)] ring-1 ring-white/5">
      <div
        className={cn(
          "grid gap-0 px-4 py-4 sm:px-5",
          hasPageContext && "xl:min-h-24 xl:grid-cols-[minmax(390px,0.95fr)_minmax(0,1.08fr)_minmax(300px,0.8fr)] xl:items-center",
        )}
      >
        <div className={cn("min-w-0", hasPageContext && "xl:pr-7")}>
          <div className="flex min-w-0 items-center gap-3">
            {favicon ? (
              <FaviconImage
                favicon={favicon}
                alt=""
                imageSize={40}
                className="size-11 shrink-0 rounded-lg border border-[var(--gray-border)]/45 ring-1 ring-white/5"
              />
            ) : null}
            <TruncatedTargetTitle href={targetHref} target={target} />
            {status !== "completed" ? (
              <Badge
                variant="outline"
                className={cn(
                  "ml-1 shrink-0 px-3 py-1",
                  status === "failed"
                    ? "border-red-400/30 text-red-400"
                    : status === "cancelled"
                      ? "border-amber-400/30 text-amber-400"
                    : "border-[var(--accent)]/30 text-[var(--accent)]",
                )}
              >
                <div
                  className={cn(
                    "mr-1.5 size-2 rounded-full",
                    status === "failed"
                      ? "bg-red-400"
                      : status === "cancelled"
                        ? "bg-amber-400"
                        : "bg-[var(--accent)] animate-pulse",
                  )}
                />
                {status}
              </Badge>
            ) : null}
          </div>

          <div className="mt-3 flex min-w-0 flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-3">
            <div className="flex min-w-0 items-center gap-2 text-[var(--muted-foreground)]">
              <CalendarDays className="size-4 shrink-0" />
              <span>
                Submitted{" "}
                <LocalTime value={submittedAt} preset="fullDateTimeWithZone" />
              </span>
            </div>
            {currentAttempt && attemptHistory.length > 1 ? (
              <>
                <span className="hidden text-[var(--gray-border)] sm:inline">|</span>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="shrink-0 text-[var(--muted-foreground)]">Attempt {currentAttempt.attemptNumber}</span>
                  {currentAttempt.fallbackReason ? (
                    <ScanAttemptFallbackPill fallbackReason={currentAttempt.fallbackReason} />
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
        {pageTitle ? (
          <HeaderContextColumn
            label="Page title"
            className="relative mt-4 pt-4 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--gray-border)]/24 xl:mt-0 xl:px-8 xl:py-1 xl:before:inset-y-0 xl:before:left-0 xl:before:h-auto xl:before:w-0.5 xl:before:bg-[var(--gray-border)]/70"
          >
            <p className="truncate text-base font-medium leading-snug text-[var(--foreground)] xl:text-lg" title={pageTitle}>
              {pageTitle}
            </p>
          </HeaderContextColumn>
        ) : null}
        {finalUrl ? (
          <HeaderContextColumn
            label="Final URL"
            className="relative mt-4 pt-4 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--gray-border)]/24 xl:mt-0 xl:py-1 xl:pl-8 xl:pr-2 xl:before:inset-y-0 xl:before:left-0 xl:before:h-auto xl:before:w-0.5 xl:before:bg-[var(--gray-border)]/70"
          >
            <a
              href={finalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block min-w-0 truncate font-mono text-sm text-[var(--foreground)] transition-colors hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55 xl:text-base"
              title={finalUrl}
            >
              {finalUrl}
            </a>
          </HeaderContextColumn>
        ) : null}
      </div>
    </section>
  )
}

function HeaderContextColumn({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="mb-2 font-heading text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        {label}
      </p>
      {children}
    </div>
  )
}

function TruncatedTargetTitle({ href, target }: { href: string; target: string }) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const displayTarget = target.replace(/^https?:\/\//, "")
  const [tooltipState, setTooltipState] = useState({ displayTarget, open: false })

  if (tooltipState.displayTarget !== displayTarget) {
    setTooltipState({ displayTarget, open: false })
  }

  const tooltipOpen = tooltipState.displayTarget === displayTarget && tooltipState.open

  const updateTruncation = useCallback(() => {
    const title = titleRef.current
    const nextIsTruncated = title ? title.scrollWidth > title.clientWidth + 1 : false

    if (!nextIsTruncated) {
      setTooltipState((current) => (current.open ? { ...current, open: false } : current))
    }

    return nextIsTruncated
  }, [])

  const handleTooltipOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setTooltipState((current) => (current.open ? { ...current, open: false } : current))
        return
      }

      const canOpen = updateTruncation()
      setTooltipState((current) => (current.open === canOpen ? current : { ...current, open: canOpen }))
    },
    [updateTruncation]
  )

  useEffect(() => {
    const title = titleRef.current
    const link = title?.parentElement

    if (!title || !link) {
      return
    }

    let frameId: number | null = null
    let disposed = false
    const timeoutIds: number[] = []

    const scheduleUpdate = () => {
      if (disposed) {
        return
      }

      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }

      if (typeof requestAnimationFrame === "function") {
        frameId = requestAnimationFrame(updateTruncation)
        return
      }

      updateTruncation()
    }

    scheduleUpdate()
    document.fonts?.ready.then(scheduleUpdate).catch(() => {})
    timeoutIds.push(window.setTimeout(scheduleUpdate, 80))
    timeoutIds.push(window.setTimeout(scheduleUpdate, 250))
    timeoutIds.push(window.setTimeout(scheduleUpdate, 600))

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", scheduleUpdate)

      return () => {
        disposed = true
        if (frameId !== null) {
          cancelAnimationFrame(frameId)
        }
        timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
        window.removeEventListener("resize", scheduleUpdate)
      }
    }

    const resizeObserver = new ResizeObserver(scheduleUpdate)
    resizeObserver.observe(title)
    resizeObserver.observe(link)

    return () => {
      disposed = true
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
      resizeObserver.disconnect()
    }
  }, [updateTruncation])

  const titleLink = (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onFocus={updateTruncation}
      onPointerEnter={updateTruncation}
      className="group block min-w-0 flex-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55"
    >
      <h1
        ref={titleRef}
        className="block max-w-full truncate whitespace-nowrap text-3xl font-semibold leading-tight tracking-tight transition-colors group-hover:text-[var(--accent)] md:text-4xl"
      >
        {displayTarget}
      </h1>
    </a>
  )

  return (
    <Tooltip open={tooltipOpen} onOpenChange={handleTooltipOpenChange}>
      <TooltipTrigger asChild>{titleLink}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm break-all font-mono text-xs leading-relaxed">
        {href}
      </TooltipContent>
    </Tooltip>
  )
}

function getHostedProviderDisplay(provider: string | null): { value: string; fullValue?: string } {
  if (!provider) {
    return { value: "Unknown" }
  }

  const normalizedProvider = provider.trim().toLowerCase()
  const abbreviation =
    normalizedProvider === "amazon web services" || normalizedProvider === "aws"
      ? "AWS"
      : normalizedProvider === "google cloud platform" || normalizedProvider === "google cloud"
        ? "GCP"
        : normalizedProvider === "microsoft azure"
          ? "Azure"
          : normalizedProvider === "amazon cloudfront"
            ? "CloudFront"
            : null

  return abbreviation && abbreviation !== provider
    ? { value: abbreviation, fullValue: provider }
    : { value: provider }
}


export function OverviewMetrics({ overview }: { overview: OverviewSection }) {
  return (
    <section className="grid overflow-hidden rounded-lg border border-[var(--gray-border)]/45 bg-[var(--surface-dark)]/68 ring-1 ring-white/5 sm:grid-cols-2 lg:grid-cols-[0.85fr_0.85fr_1.15fr_1.35fr]">
      <CompactKPI
        icon={Shield}
        label="Status"
        value={overview.statusCode}
        subValue={overview.statusText}
        color={getHttpStatusColor(overview.statusCode)}
      />
      <CompactKPI
        icon={ArrowLeftRight}
        label="Redirects"
        value={overview.redirectCount}
        subValue={overview.redirectCount === 1 ? "1 hop" : `${overview.redirectCount} hops`}
      />
      <CompactKPI icon={Server} label="Hosted On" value={overview.server ?? "Unknown"} subValue={overview.cdnName} />
      <CompactKPI icon={MapPin} label="Host IP" value={overview.hostIp ?? "N/A"} subValue={overview.asnOrg ?? undefined} />
    </section>
  )
}

export function ScanSummaryPanel({ overview }: { overview: OverviewSection }) {
  return (
    <section className={`${compactPanelClass} p-3`}>
      <div className="grid grid-cols-2 gap-2">
        <SummaryMetricTile
          icon={Shield}
          label="Status"
          value={overview.statusCode}
          subValue={overview.statusText}
          color={getHttpStatusColor(overview.statusCode)}
        />
        <SummaryMetricTile
          icon={ArrowLeftRight}
          label="Redirects"
          value={overview.redirectCount}
          subValue={overview.redirectCount === 1 ? "1 hop" : `${overview.redirectCount} hops`}
        />
        <SummaryMetricTile
          icon={Server}
          label="Hosted On"
          value={overview.server ?? "Unknown"}
          subValue={overview.cdnName}
        />
        <SummaryMetricTile
          icon={MapPin}
          label="Host IP"
          value={overview.hostIp ?? "N/A"}
          subValue={overview.asnOrg ?? undefined}
        />
      </div>
    </section>
  )
}

// Reusable favicon source resolver - returns safe preview source or null

export function PageTitleCard({
  title,
  finalUrl,
}: {
  title: string
  finalUrl: string
}) {
  return (
    <section className={`${compactPanelClass} grid gap-0 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]`}>
      <div className="relative px-3 py-3 after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[var(--gray-border)]/24 md:after:inset-y-3 md:after:left-auto md:after:right-0 md:after:h-auto md:after:w-px sm:px-4">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Page Title</p>
        <p className="text-base font-medium leading-snug text-[var(--foreground)] md:text-lg">{title}</p>
      </div>
      <div className="px-3 py-3 sm:px-4">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Final URL</p>
        <div className="flex items-center gap-3">
          <p className="break-all font-mono text-sm text-[var(--foreground)]">{finalUrl}</p>
        </div>
      </div>
    </section>
  )
}
