"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { LocalTime } from "@/components/ui/local-time"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CheckCircle2,
  Clock,
  Globe,
  Server,
  Shield,
  ArrowLeftRight,
  MapPin,
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Fingerprint,
  Network,
  Lock,
  Globe2,
  FileText,
  Wifi,
  Eye,
  CalendarDays,
  History,
  ExternalLink as LinkIcon,
  Plus,
  XCircle,
  MinusCircle,
  Search,
  Boxes,
  Cpu,
  Briefcase,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { ScanPhaseRun, ScanSubdomainItem } from "@/lib/contracts/scans"
import type {
  OverviewSection,
  TechnologySection,
  DeliveryRedirectsSection,
  DnsInfrastructureSection,
  NetworkIntelligenceSection,
  SubdomainsSection,
  TlsFingerprintsSection,
  DomainIntelligenceSection,
  ContentSignalsSection,
  RawEvidenceSection,
  HistorySection,
  DomainMetadata,
  DomainProvenance,
} from "@/lib/server/scans/scan-detail-view-model"
import { RawEvidenceSummaryCards, RawEvidenceTabs } from "./raw-evidence-tabs"

const scanPhaseLabels: Record<ScanPhaseRun["phase"], string> = {
  http_probe: "HTTP probe",
  headless: "Headless",
  subfinder: "Subfinder",
  nuclei_dns: "Nuclei DNS",
  nuclei_http: "Nuclei HTTP",
  ip_intel: "IP intel",
  finalize: "Finalize",
}

const surfacePanelClass =
  "rounded-lg border border-[var(--gray-border)]/45 bg-[var(--surface-dark)]/72 shadow-none ring-1 ring-white/5"

const compactPanelClass =
  "rounded-lg border border-[var(--gray-border)]/45 bg-[var(--surface-dark)]/62 shadow-none ring-1 ring-white/5"

const insetPanelClass =
  "overflow-hidden rounded-lg border border-[var(--gray-border)]/24 bg-[var(--surface-mid)]/14 ring-1 ring-white/4"

const insetRowDividerClass =
  "relative after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[var(--gray-border)]/18 last:after:hidden"

const insetHeaderDividerClass =
  "relative after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[var(--gray-border)]/20"

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

// Compact KPI Component
function CompactKPI({
  icon: Icon,
  label,
  value,
  subValue,
  color = "accent",
}: {
  icon: React.ElementType
  label: string
  value: string | number
  subValue?: string
  color?: "accent" | "emerald" | "amber" | "orange" | "red"
}) {
  const colorClasses = {
    accent: "text-[var(--accent)]",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    orange: "text-orange-400",
    red: "text-red-400",
  }

  return (
    <div className="relative grid min-h-24 grid-cols-[auto_minmax(0,1fr)] gap-x-3 px-3 py-3 after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[var(--gray-border)]/24 last:after:hidden sm:border-r sm:border-[var(--gray-border)]/28 sm:after:hidden sm:last:border-r-0 lg:px-4">
      <Icon className={`mt-1 size-4 ${colorClasses[color]}`} />
      <div className="min-w-0">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{label}</span>
        <p className={`mt-1 break-words font-mono text-base font-semibold leading-tight md:text-lg 2xl:text-xl ${colorClasses[color]}`}>
          {value}
        </p>
        {subValue && <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">{subValue}</p>}
      </div>
    </div>
  )
}

function getHttpStatusColor(code: number): "emerald" | "amber" | "orange" | "red" {
  if (code >= 200 && code < 300) return "emerald"
  if (code >= 300 && code < 400) return "amber"
  if (code >= 400 && code < 500) return "orange"
  return "red"
}

function getHttpStatusSummary(code: number): string {
  if (code >= 200 && code < 300) return "Success"
  if (code >= 300 && code < 400) return "Redirect"
  if (code >= 400 && code < 500) return "Client error"
  if (code >= 500) return "Server error"
  return "HTTP response"
}

function SummaryMetricTile({
  icon: Icon,
  label,
  value,
  subValue,
  color = "accent",
}: {
  icon: React.ElementType
  label: string
  value: string | number
  subValue?: string
  color?: "accent" | "emerald" | "amber" | "orange" | "red"
}) {
  const colorClasses = {
    accent: "text-[var(--accent)]",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    orange: "text-orange-400",
    red: "text-red-400",
  }

  return (
    <div className="min-h-24 rounded-lg border border-[var(--gray-border)]/40 bg-[var(--surface-mid)]/10 p-3 ring-1 ring-white/5">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn("size-4", colorClasses[color])} />
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          {label}
        </span>
      </div>
      <p className={cn("break-words font-mono text-sm font-semibold leading-tight sm:text-base", colorClasses[color])}>
        {value}
      </p>
      {subValue && (
        <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]" title={subValue}>
          {subValue}
        </p>
      )}
    </div>
  )
}

// Static Section Panel Component
function SectionPanel({
  title,
  icon: Icon,
  children,
  badge,
  description,
  actions,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  badge?: string | number
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <section className="relative overflow-hidden rounded-lg border border-[var(--gray-border)]/45 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-dark)_92%,transparent)_0%,color-mix(in_srgb,var(--surface-dark)_70%,transparent)_100%)] ring-1 ring-white/5">
      <div className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-3 after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-[var(--gray-border)]/28 sm:flex-nowrap sm:px-5 sm:after:inset-x-5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[var(--accent)]/25 bg-[var(--accent)]/8 text-[var(--accent)]">
            <Icon className="size-3.5" />
          </span>
          <h2 className="min-w-0 truncate font-heading text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)] sm:text-[13px] sm:tracking-[0.14em]">
            {title}
          </h2>
          {badge !== undefined && badge !== "" ? (
            <Badge variant="outline" className="shrink-0 border-[var(--gray-border)]/40 text-[10px] font-medium tracking-wide text-[var(--muted-foreground)]">
              {badge}
            </Badge>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>
      {description ? (
        <p className="relative bg-[var(--background)]/30 px-4 py-2 text-xs leading-relaxed text-[var(--muted-foreground)] after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-[var(--gray-border)]/18 sm:px-5 sm:after:inset-x-5">
          {description}
        </p>
      ) : null}
      <div className="space-y-5 p-4 sm:p-5">{children}</div>
    </section>
  )
}

// Target Context Badge for showing provenance
function TargetContextBadge({ provenance }: { provenance: DomainProvenance }) {
  const configs = {
    original: { label: "Original Domain", className: "border-blue-400/30 text-blue-400" },
    final: { label: "Final Domain", className: "border-emerald-400/30 text-emerald-400" },
    url: { label: "URL Target", className: "border-purple-400/30 text-purple-400" },
    unknown: { label: "Unknown", className: "border-[var(--gray-border)] text-[var(--muted-foreground)]" },
  }

  const config = configs[provenance]

  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  )
}

type FaviconPreview = {
  url: string | null
  path: string | null
}

function FaviconImage({
  favicon,
  alt,
  className,
  imageSize = 32,
}: {
  favicon: FaviconPreview
  alt: string
  className?: string
  imageSize?: number
}) {
  const faviconPreviewSrc = resolveFaviconPreviewSrc(favicon)

  if (!faviconPreviewSrc) {
    return (
      <div className={cn("flex items-center justify-center bg-[var(--surface-mid)] text-[var(--muted-foreground)]", className)}>
        <Globe className="size-4" />
      </div>
    )
  }

  return (
    <div className={cn("flex items-center justify-center overflow-hidden bg-[var(--surface-mid)]", className)}>
      {isLocalImagePath(faviconPreviewSrc) ? (
        <Image
          src={faviconPreviewSrc}
          alt={alt}
          width={imageSize}
          height={imageSize}
          className="object-contain"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization
        <img
          src={faviconPreviewSrc}
          alt={alt}
          width={imageSize}
          height={imageSize}
          className="object-contain"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.style.display = "none"
          }}
        />
      )}
    </div>
  )
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
            const previousPresentation = previousPhase ? scanPhaseStatusPresentation[previousPhase.status] : null
            const lineClassName = previousPresentation?.lineClassName ?? presentation.lineClassName

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
            const previousPresentation = previousPhase ? scanPhaseStatusPresentation[previousPhase.status] : null
            const lineClassName = previousPresentation?.lineClassName ?? presentation.lineClassName

            return (
              <div key={phase.phaseId} className="relative flex min-w-0 flex-col items-center pt-2 text-center">
                {phaseIndex > 0 && (
                  <span
                    aria-hidden="true"
                    className={cn("absolute left-[-50%] right-1/2 top-[18px] h-px", lineClassName)}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 flex size-5 items-center justify-center rounded-full border",
                    presentation.dotClassName,
                    phase.status === "running" && "animate-pulse",
                  )}
                  title={phase.errorMessage ?? undefined}
                >
                  <StatusIcon className="size-3.5" />
                </span>
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

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-64 gap-3">
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
        <div className="relative before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-[var(--gray-border)]/24 lg:before:inset-y-4 lg:before:left-0 lg:before:h-auto lg:before:w-px">
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

  if (!screenshot.available || !screenshot.path) {
    return <ScreenshotPlaceholder />
  }

  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-[var(--surface-mid)]">
      <Image
        src={screenshot.path}
        alt={`Homepage screenshot for ${target}`}
        fill
        unoptimized
        priority
        sizes="(max-width: 1024px) 100vw, 400px"
        className="object-contain"
      />
    </div>
  )
}

function ScreenshotPlaceholder() {
  return (
    <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-[var(--surface-mid)] to-[var(--surface-dark)]">
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
              <Badge variant="outline" className="ml-1 shrink-0 border-[var(--accent)]/30 px-3 py-1 text-[var(--accent)]">
                <div className="mr-1.5 size-2 rounded-full bg-[var(--accent)] animate-pulse" />
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
  const [isTruncated, setIsTruncated] = useState(false)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const displayTarget = target.replace(/^https?:\/\//, "")

  const updateTruncation = () => {
    const title = titleRef.current
    const nextIsTruncated = title ? title.scrollWidth > title.clientWidth + 1 : false
    setIsTruncated(nextIsTruncated)

    if (!nextIsTruncated) {
      setTooltipOpen(false)
    }

    return nextIsTruncated
  }

  useEffect(() => {
    const title = titleRef.current
    const link = title?.parentElement

    if (!title || !link) {
      return
    }

    let frameId: number | null = null
    const timeoutIds: number[] = []

    const scheduleUpdate = () => {
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
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
      resizeObserver.disconnect()
    }
  }, [displayTarget])

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
    <Tooltip open={isTruncated && tooltipOpen} onOpenChange={setTooltipOpen}>
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

function MetricValue({
  value,
  fullValue,
  className,
}: {
  value: string | number
  fullValue?: string
  className?: string
}) {
  const valueElement = (
    <p
      className={cn("mt-1 truncate font-mono text-base font-semibold leading-tight", className)}
      title={fullValue ?? String(value)}
    >
      {value}
    </p>
  )

  if (!fullValue || fullValue === String(value)) {
    return valueElement
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{valueElement}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {fullValue}
      </TooltipContent>
    </Tooltip>
  )
}

// Overview Metrics Component
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
export function resolveFaviconPreviewSrc(favicon: {
  url: string | null
  path: string | null
}): string | null {
  return isLocalImagePath(favicon.url)
    ? favicon.url
    : isAbsoluteHttpUrl(favicon.url)
      ? favicon.url
      : isLocalImagePath(favicon.path)
        ? favicon.path
        : isAbsoluteHttpUrl(favicon.path)
          ? favicon.path
          : null
}

// Page Title Card
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

export type ScanDetailSectionTabItem = {
  value: string
  label: string
  content: React.ReactNode
}

const scanDetailSectionTabIcons: Record<string, React.ElementType> = {
  technologies: Layers,
  dnsInfrastructure: Network,
  ipIntelligence: MapPin,
  subdomains: Globe2,
  tlsCertificate: Lock,
  fingerprints: Fingerprint,
  domainInfo: FileText,
  rawEvidence: FileText,
  scanInfo: Info,
}

export function ScanDetailSectionTabs({ items }: { items: ScanDetailSectionTabItem[] }) {
  const defaultValue = items[0]?.value
  const [activeValue, setActiveValue] = useState(defaultValue)
  const tabListRef = useRef<HTMLDivElement | null>(null)
  const tabsRootRef = useRef<HTMLDivElement | null>(null)
  const [tabScrollState, setTabScrollState] = useState({ canScrollLeft: false, canScrollRight: false })

  useEffect(() => {
    // Keep activeValue in sync with the first available tab when items change
    // (e.g. scan detail loaded without a result, then result arrives).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveValue((prev) => (prev === defaultValue ? prev : defaultValue))
  }, [defaultValue])

  useEffect(() => {
    const tabList = tabListRef.current

    if (!tabList) {
      return
    }

    const list = tabList

    function updateScrollState() {
      const maxScrollLeft = list.scrollWidth - list.clientWidth

      setTabScrollState({
        canScrollLeft: list.scrollLeft > 1,
        canScrollRight: list.scrollLeft < maxScrollLeft - 1,
      })
    }

    updateScrollState()
    list.addEventListener("scroll", updateScrollState, { passive: true })
    window.addEventListener("resize", updateScrollState)

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScrollState)
    resizeObserver?.observe(list)

    return () => {
      list.removeEventListener("scroll", updateScrollState)
      window.removeEventListener("resize", updateScrollState)
      resizeObserver?.disconnect()
    }
  }, [items.length])

  function handleTabChange(nextValue: string) {
    setActiveValue(nextValue)

    if (typeof window === "undefined") {
      return
    }

    // Defer to next paint so Radix has swapped the TabsContent before we
    // measure the scroll position.
    requestAnimationFrame(() => {
      const scroller = document.querySelector<HTMLElement>("[data-app-scroll-container='true']")
      const tabsRoot = tabsRootRef.current
      if (!scroller || !tabsRoot) {
        return
      }

      // Compute the scroll position where the tabs root sits at the top of
      // the scroll container. The tabs root itself is NOT sticky (only the
      // inner tab bar div is), so its bounding rect reflects its real
      // position in the document flow.
      const scrollerRect = scroller.getBoundingClientRect()
      const tabsRect = tabsRoot.getBoundingClientRect()
      const tabsRootTopInScroller = scroller.scrollTop + (tabsRect.top - scrollerRect.top)

      // Only scroll UP to the tabs root — never scroll down. This prevents
      // the jolt when the user is near the top of the page (no scroll happens)
      // but resets the view when they've scrolled into the previous tab's
      // content and the new tab should start from the top.
      if (scroller.scrollTop > tabsRootTopInScroller) {
        scroller.scrollTop = tabsRootTopInScroller
      }
    })
  }

  function centerTabHorizontally(tab: HTMLElement) {
    const list = tabListRef.current

    if (!list) {
      return
    }

    const tabRect = tab.getBoundingClientRect()
    const listRect = list.getBoundingClientRect()
    const tabCenter = tabRect.left + tabRect.width / 2
    const listCenter = listRect.left + list.clientWidth / 2
    const maxScrollLeft = list.scrollWidth - list.clientWidth
    const targetScroll = Math.max(
      0,
      Math.min(maxScrollLeft, list.scrollLeft + (tabCenter - listCenter)),
    )

    if (Math.abs(targetScroll - list.scrollLeft) < 1) {
      return
    }

    list.scrollTo({ left: targetScroll, behavior: "smooth" })
  }

  if (!defaultValue) {
    return null
  }

  return (
    <Tabs
      ref={tabsRootRef}
      value={activeValue}
      onValueChange={handleTabChange}
      className="gap-0 overflow-visible"
    >
      <div className="sticky top-0 z-20 border-y border-[var(--gray-border)]/30 bg-[var(--surface-dark)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface-dark)]/85">
        <TabsList
          ref={tabListRef}
          variant="line"
          aria-label="Scan detail sections"
          className="flex !h-auto min-h-10 w-full justify-start gap-0 overflow-x-auto overflow-y-hidden rounded-none px-2 py-0 pr-12 [-ms-overflow-style:none] [scrollbar-width:none] sm:min-h-11 sm:py-0 sm:pr-2 [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => {
            const Icon = scanDetailSectionTabIcons[item.value] ?? FileText

            return (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="!h-9 flex-none cursor-pointer gap-1.5 rounded-none border-0 px-2.5 py-0 font-heading text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--muted-foreground)] after:!bottom-[-1px] after:bg-[var(--accent)] after:transition-all hover:text-[var(--foreground)] aria-selected:bg-transparent aria-selected:!text-[var(--accent)] data-active:text-[var(--accent)] data-[state=active]:text-[var(--accent)] sm:!h-10 sm:text-[11px]"
                onClick={(event) => {
                  centerTabHorizontally(event.currentTarget)
                }}
              >
                <Icon className="size-3.5 text-current sm:size-4" />
                <span>{item.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center bg-gradient-to-r from-[var(--surface-dark)] via-[var(--surface-dark)]/92 to-transparent pl-2 transition-opacity duration-200 lg:hidden",
            tabScrollState.canScrollLeft ? "opacity-100" : "opacity-0",
          )}
        >
          <span className="flex size-6 items-center justify-center border border-[var(--gray-border)]/25 bg-[var(--surface-mid)]/50 text-[var(--accent)] shadow-[0_8px_24px_-16px_rgba(0,0,0,0.95)]">
            <ChevronLeft className="size-3.5" />
          </span>
        </div>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 flex w-16 items-center justify-end bg-gradient-to-l from-[var(--surface-dark)] via-[var(--surface-dark)]/92 to-transparent pr-2 transition-opacity duration-200 lg:hidden",
            tabScrollState.canScrollRight ? "opacity-100" : "opacity-0",
          )}
        >
          <span className="flex size-6 items-center justify-center border border-[var(--accent)]/35 bg-[var(--surface-mid)]/65 text-[var(--accent)] shadow-[0_8px_24px_-16px_rgba(0,0,0,0.95)]">
            <ChevronRight className="size-3.5" />
          </span>
        </div>
      </div>

      <div className="min-w-0 pt-4">
        {items.map((item) => (
          <TabsContent
            key={item.value}
            value={item.value}
            className="m-0 p-0 [&>section]:border-0 [&>section]:bg-transparent [&>section]:shadow-none [&>section]:ring-0"
          >
            {item.content}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  )
}

const technologyBucketPresentation: Record<
  TechnologySection["buckets"][number]["id"],
  { icon: React.ElementType; accentClassName: string; surfaceClassName: string; borderClassName: string }
> = {
  platform: {
    icon: Layers,
    accentClassName: "text-[var(--accent)]",
    surfaceClassName: "bg-[var(--accent)]/12",
    borderClassName: "border-[var(--accent)]/20",
  },
  framework: {
    icon: Network,
    accentClassName: "text-sky-300",
    surfaceClassName: "bg-sky-400/10",
    borderClassName: "border-sky-400/18",
  },
  infrastructure: {
    icon: Server,
    accentClassName: "text-emerald-300",
    surfaceClassName: "bg-emerald-400/10",
    borderClassName: "border-emerald-400/18",
  },
  business: {
    icon: Briefcase,
    accentClassName: "text-amber-300",
    surfaceClassName: "bg-amber-400/10",
    borderClassName: "border-amber-400/18",
  },
  security: {
    icon: Shield,
    accentClassName: "text-red-300",
    surfaceClassName: "bg-red-400/10",
    borderClassName: "border-red-400/18",
  },
  ecosystem: {
    icon: Fingerprint,
    accentClassName: "text-purple-300",
    surfaceClassName: "bg-purple-400/10",
    borderClassName: "border-purple-400/18",
  },
  other: {
    icon: Boxes,
    accentClassName: "text-[var(--muted-foreground)]",
    surfaceClassName: "bg-[var(--surface-mid)]/45",
    borderClassName: "border-[var(--gray-border)]/18",
  },
}

const cpeTechnologyPresentation = {
  icon: Cpu,
  accentClassName: "text-cyan-300",
  surfaceClassName: "bg-cyan-400/10",
  borderClassName: "border-cyan-400/18",
} satisfies { icon: React.ElementType; accentClassName: string; surfaceClassName: string; borderClassName: string }

type TechnologyTableRow =
  | {
      id: string
      category: string
      categoryId: TechnologySection["buckets"][number]["id"]
      name: string
      version: string | null
      type: string
      sources: readonly string[]
      iconUrl: string | null
      inferred: boolean
      categories: readonly string[]
      description: string | null
      website: string | null
    }
  | {
      id: string
      category: string
      categoryId: "other"
      name: string
      version: string | null
      type: string
      sources: readonly string[]
      iconUrl: null
      inferred: boolean
      categories: readonly string[]
      description: string | null
      website: string | null
      cpe: string
    }

type TechnologyTableGroup = {
  category: string
  categoryId: TechnologySection["buckets"][number]["id"]
  rows: TechnologyTableRow[]
}

function buildTechnologyTableRows(technology: TechnologySection): TechnologyTableRow[] {
  const technologyRows = technology.buckets.flatMap((bucket) =>
    bucket.items.map((tech) => ({
      id: `${bucket.id}-${tech.name}-${tech.version ?? "none"}`,
      category: bucket.label,
      categoryId: bucket.id,
      name: tech.name,
      version: tech.version,
      type: tech.primaryCategory ?? tech.categories[0] ?? "Technology",
      sources: tech.sources,
      iconUrl: tech.iconUrl,
      inferred: tech.inferred,
      categories: tech.categories,
      description: tech.description,
      website: tech.website,
    })),
  )

  const cpeRows = technology.cpeEntries.map((entry) => ({
    id: `cpe-${entry.cpe}`,
    category: "CPE",
    categoryId: "other" as const,
    name: entry.vendor && entry.product
      ? `${entry.vendor} ${entry.product}`
      : entry.vendor || entry.product || "Unknown product",
    version: entry.version,
    type: "CPE",
    sources: ["cpe"],
    iconUrl: null,
    inferred: false,
    categories: ["CPE"],
    description: null,
    website: null,
    cpe: entry.cpe,
  }))

  return [...technologyRows, ...cpeRows]
}

function groupTechnologyTableRows(rows: readonly TechnologyTableRow[]): TechnologyTableGroup[] {
  const groups = new Map<string, TechnologyTableGroup>()

  for (const row of rows) {
    const key = `${row.categoryId}-${row.category}`
    const existing = groups.get(key)

    if (existing) {
      existing.rows.push(row)
      continue
    }

    groups.set(key, {
      category: row.category,
      categoryId: row.categoryId,
      rows: [row],
    })
  }

  return [...groups.values()]
}

function formatTechnologySource(source: string) {
  switch (source) {
    case "wappalyzer":
      return "Wappalyzer"
    case "wordpress":
      return "WordPress"
    case "cpe":
      return "CPE"
    case "derived":
      return "Derived"
    case "nuclei":
      return "Nuclei"
    default:
      return source
  }
}

function TechnologyIcon({ iconUrl }: { iconUrl: string | null }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden border border-[var(--gray-border)]/25 bg-[var(--surface-mid)]/45 ring-1 ring-white/5">
      {iconUrl ? (
        <span className="flex size-full items-center justify-center bg-[radial-gradient(circle,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.82)_58%,rgba(255,255,255,0.18)_100%)] p-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote Wappalyzer icons are rendered directly in technology rows */}
          <img
            src={iconUrl}
            alt=""
            width={22}
            height={22}
            className="size-[22px] object-contain"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.style.display = "none"
            }}
          />
        </span>
      ) : (
        <Globe className="size-4 text-[var(--muted-foreground)]" aria-hidden="true" />
      )}
    </span>
  )
}

function TechnologyBlockRow({ row }: { row: TechnologyTableRow }) {
  const [metadataOpen, setMetadataOpen] = useState(false)
  const [metadataAnchor, setMetadataAnchor] = useState<{ x: number; y: number } | null>(null)
  const sourceLabel = row.sources.map(formatTechnologySource).join(", ")

  return (
    <Popover open={metadataOpen} onOpenChange={setMetadataOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "grid w-full min-w-0 cursor-pointer grid-cols-1 items-start gap-1.5 py-2 text-left transition-colors hover:bg-[var(--surface-mid)]/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 active:bg-[var(--surface-mid)]/18 sm:grid-cols-[minmax(0,1fr)_minmax(6rem,0.45fr)] sm:items-center sm:gap-3",
            insetRowDividerClass,
          )}
          aria-label={`${row.name} technology details`}
          onClick={(event) => {
            setMetadataAnchor({ x: event.clientX, y: event.clientY })
          }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <TechnologyIcon iconUrl={row.iconUrl} />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold text-[var(--foreground)]">{row.name}</span>
                {row.version && (
                  <span className="shrink-0 font-mono text-xs text-[var(--muted-foreground)]">{row.version}</span>
                )}
              </div>
              {"cpe" in row && (
                <code className="mt-1 block truncate font-mono text-xs text-[var(--muted-foreground)]" title={row.cpe}>
                  {row.cpe}
                </code>
              )}
            </div>
          </div>
          <span className="ml-[2.375rem] min-w-0 text-sm leading-5 text-[var(--muted-foreground)] sm:ml-0 sm:truncate sm:text-right">
            {row.type}
          </span>
        </button>
      </PopoverTrigger>
      {metadataAnchor && (
        <PopoverAnchor asChild>
          <span
            aria-hidden="true"
            className="pointer-events-none fixed size-px"
            style={{ left: metadataAnchor.x, top: metadataAnchor.y }}
          />
        </PopoverAnchor>
      )}
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={10}
        className="z-[80] w-80 gap-3 border border-[var(--gray-border)]/35 bg-[#10161d] p-3 shadow-[0_26px_70px_-26px_rgba(0,0,0,0.95)] ring-1 ring-white/8"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center border border-[var(--gray-border)]/25 bg-[var(--surface-mid)]/45 ring-1 ring-white/5">
            {row.iconUrl ? (
              <span className="flex size-full items-center justify-center bg-[radial-gradient(circle,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.82)_58%,rgba(255,255,255,0.18)_100%)] p-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- remote Wappalyzer icons are rendered directly in hover cards */}
                <img
                  src={row.iconUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 object-contain"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              </span>
            ) : (
              <Globe className="size-[22px] text-[var(--muted-foreground)]" aria-hidden="true" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium text-[var(--foreground)]">{row.name}</span>
              {row.version && (
                <span className="shrink-0 font-mono text-xs text-[var(--muted-foreground)]">{row.version}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs">
                {row.category}
              </Badge>
              {row.categories.map((category) => (
                <Badge key={`${row.id}-${category}`} variant="outline" className="text-xs">
                  {category}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <p className="text-sm leading-6 text-[var(--muted-foreground)]">
          {row.description ?? "No Wappalyzer description available."}
        </p>
        <div className="grid gap-2 text-xs text-[var(--muted-foreground)]">
          <div className="flex items-start justify-between gap-3">
            <span>Source</span>
            <span className="text-right text-[var(--foreground)]">{sourceLabel || "Unknown"}</span>
          </div>
          {"cpe" in row && (
            <div className="flex items-start justify-between gap-3">
              <span>CPE</span>
              <code className="max-w-48 break-all text-right text-[var(--foreground)]">{row.cpe}</code>
            </div>
          )}
        </div>
        {row.website ? (
          <a
            href={row.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline"
          >
            <LinkIcon className="size-3" />
            Official site
          </a>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function TechnologyCategoryBlock({ group }: { group: TechnologyTableGroup }) {
  const presentation = group.category === "CPE" ? cpeTechnologyPresentation : technologyBucketPresentation[group.categoryId]
  const Icon = presentation.icon

  return (
    <section className={cn("mb-3 inline-block w-full break-inside-avoid overflow-hidden rounded-lg border bg-[var(--surface-dark)]/36 align-top ring-1 ring-white/5", presentation.borderClassName)}>
      <div className={cn("flex items-center gap-3 px-3 py-2.5", insetHeaderDividerClass)}>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", presentation.surfaceClassName)}>
          <Icon className={cn("size-4", presentation.accentClassName)} />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">{group.category}</h3>
          <Badge variant="outline" className="h-6 px-2 text-xs">
            {group.rows.length}
          </Badge>
          <span className="h-px min-w-6 flex-1 bg-[var(--gray-border)]/18" />
        </div>
      </div>
      <div className={cn("grid gap-x-8 px-3 py-2", group.rows.length > 5 && "lg:grid-cols-2")}>
        {group.rows.map((row) => (
          <TechnologyBlockRow key={row.id} row={row} />
        ))}
      </div>
    </section>
  )
}

// Technologies Section
export function TechnologiesSection({ technology }: { technology: TechnologySection }) {
  const [query, setQuery] = useState("")
  const rows = useMemo(() => buildTechnologyTableRows(technology), [technology])
  const normalizedQuery = query.trim().toLowerCase()
  const visibleRows = normalizedQuery
    ? rows.filter((row) => {
        const searchable = [
          row.category,
          row.name,
          row.type,
          row.version,
          ...row.sources,
          "cpe" in row ? row.cpe : null,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()

        return searchable.includes(normalizedQuery)
      })
    : rows
  const visibleGroups = useMemo(() => groupTechnologyTableRows(visibleRows), [visibleRows])

  return (
    <section className={`${compactPanelClass} overflow-hidden`}>
      <div className="flex justify-start px-4 py-3 sm:px-5">
        <label className="relative block w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search technologies..."
            className="h-9 w-full rounded-lg border border-[var(--gray-border)]/40 bg-[var(--surface-dark)]/80 pl-9 pr-3 text-sm text-[var(--foreground)] outline-none ring-1 ring-white/5 transition-colors placeholder:text-[var(--muted-foreground)] hover:border-[var(--gray-border)]/55 focus:border-[var(--accent)]/60"
          />
        </label>
      </div>

      <div className="relative p-4 [column-gap:0.75rem] before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-[var(--gray-border)]/24 sm:p-5 sm:before:inset-x-5 xl:columns-2">
        {visibleGroups.map((group) => (
          <TechnologyCategoryBlock key={`${group.categoryId}-${group.category}`} group={group} />
        ))}
        {visibleRows.length === 0 && (
          <div className={cn(insetPanelClass, "px-4 py-8 text-center text-sm text-[var(--muted-foreground)]")}>
            No technologies match the current search.
          </div>
        )}
      </div>
    </section>
  )
}

// DNS & Network Section Component
export function DnsInfrastructureCard({ dns }: { dns: DnsInfrastructureSection }) {
  const hasCname = dns.cname.length > 0
  const hasAsnRange = dns.asn.range && dns.asn.range.length > 0
  const totalTxtRecords = dns.txtRecords.reduce((acc, t) => acc + t.records.length, 0)

  const capabilityItems = [
    { key: "http2", label: "HTTP/2", enabled: dns.capabilities.http2 },
    { key: "websocket", label: "WebSocket", enabled: dns.capabilities.websocket },
    { key: "pipeline", label: "Pipeline", enabled: dns.capabilities.pipeline },
    { key: "vhost", label: "VHost", enabled: dns.capabilities.vhost },
  ]
  const hasAnyCapability = capabilityItems.some((cap) => cap.enabled)
  const hasNetworkBlock = Boolean(dns.asn.asNumber || dns.asn.org || hasAsnRange)

  return (
    <SectionPanel
      title="DNS & Network"
      icon={Network}
      description="Authoritative DNS resolution, network routing, and any DNS service fingerprints surfaced by the scan."
    >
      <div className="space-y-5">
        {/* Capabilities */}
        {hasAnyCapability && (
          <div className="space-y-3">
            <SubSectionLabel label="Protocol Capabilities" />
            <div className={cn(insetPanelClass, "p-3")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {capabilityItems.map((cap) => (
                  <div
                    key={cap.key}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md border px-3 py-2 transition-colors",
                      cap.enabled
                        ? "border-[var(--accent)]/30 bg-[var(--accent)]/5"
                        : "border-[var(--gray-border)]/20 bg-[var(--background)]/40",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[11px] font-medium uppercase tracking-[0.12em]",
                        cap.enabled ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]/70",
                      )}
                    >
                      {cap.label}
                    </span>
                    {cap.enabled ? (
                      <CheckCircle2 className="size-3.5 text-[var(--accent)]" />
                    ) : (
                      <XCircle className="size-3.5 text-[var(--muted-foreground)]/40" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DNS Records + Network + Nameservers: stacked on mobile, 3-col on lg */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* DNS Records */}
          <div className="space-y-3">
            <SubSectionLabel label="DNS Records" />
            <div className={insetPanelClass}>
              <div className="flex flex-col">
                <DnsRecordRow label="A" value={dns.a.join(", ") || dns.hostIp || null} />
                <DnsRecordRow label="AAAA" value={dns.aaaa.join(", ") || null} />
                <DnsRecordRow label="Resolvers" value={dns.resolvers.join(", ") || null} />
                {hasCname && <DnsRecordRow label="CNAME" value={dns.cname.join(", ")} />}
              </div>
            </div>
          </div>

          {/* ASN */}
          {hasNetworkBlock ? (
            <div className="space-y-3">
              <SubSectionLabel label="Network (ASN)" />
              <div className={cn(insetPanelClass, "p-3")}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-base font-semibold tracking-tight text-[var(--accent)]">
                    {dns.asn.asNumber || "—"}
                  </span>
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {dns.asn.org || "Unknown organization"}
                  </span>
                  {dns.asn.country ? (
                    <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                      {dns.asn.country}
                    </span>
                  ) : null}
                </div>
                {hasAsnRange ? (
                  <div className="relative mt-3 flex flex-wrap gap-1.5 pt-3 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--gray-border)]/28">
                    {dns.asn.range!.map((r) => (
                      <span
                        key={r}
                        className="rounded border border-[var(--gray-border)]/35 bg-[var(--surface-mid)]/30 px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted-foreground)]"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Nameservers */}
          {dns.nameservers.length > 0 ? (
            <div className="space-y-3">
              <SubSectionLabel label="Nameservers" count={dns.nameservers.length} />
              <div className={cn(insetPanelClass, "p-3")}>
                <div className="flex flex-wrap gap-1.5">
                  {dns.nameservers.map((ns) => (
                    <span
                      key={ns}
                      className="rounded border border-[var(--gray-border)]/35 bg-[var(--background)]/40 px-2 py-1 font-mono text-xs text-[var(--foreground)]"
                    >
                      {ns}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* DNS Services from Nuclei */}
        {dns.dnsServices.length > 0 ? (
          <div className="space-y-3">
            <SubSectionLabel label="Detected DNS Services" count={dns.dnsServices.length} />
            <div className="grid gap-2 sm:grid-cols-2">
              {groupDnsServicesBySubject(dns.dnsServices).map(({ subject, provenance, services }) => (
                <div
                  key={`${subject}-${provenance}-${services[0]?.serviceName ?? ""}`}
                  className={insetPanelClass}
                >
                  <div className={cn("flex items-center justify-between gap-2 px-3 py-2", insetRowDividerClass)}>
                    <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      {subject || "Unknown subject"}
                    </span>
                    <TargetContextBadge provenance={provenance} />
                  </div>
                  <div className="grid grid-cols-1 gap-1 p-3 sm:grid-cols-2">
                    {services.map((service) => (
                      <div
                        key={`${service.serviceName}-${service.subject}`}
                        className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-[var(--background)]/35"
                      >
                        <Wifi className="size-3.5 shrink-0 text-[var(--accent)]" />
                        <span className="truncate text-sm font-medium text-[var(--foreground)]">
                          {service.serviceName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* TXT Records - full width so long records don't wrap unnecessarily on desktop */}
        {totalTxtRecords > 0 && (
          <div className="space-y-3">
            <SubSectionLabel label="TXT Records" count={totalTxtRecords} />
            <div className="space-y-2">
              {dns.txtRecords.map((txt) => (
                <div
                  key={`${txt.subject}-${txt.records[0]?.slice(0, 20)}`}
                  className={insetPanelClass}
                >
                  <div className={cn("flex items-center justify-between gap-2 px-3 py-2", insetRowDividerClass)}>
                    <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      {txt.subject || "TXT"}
                    </span>
                    <TargetContextBadge provenance={txt.provenance} />
                  </div>
                  <div className="space-y-0.5 p-3 font-mono text-xs leading-relaxed text-[var(--foreground)]">
                    {txt.records.map((record) => (
                      <p key={record.slice(0, 50)} className="rounded-md px-1 py-0.5 break-all">
                        {record}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionPanel>
  )
}

function DnsRecordRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="relative flex flex-col gap-1 px-3 py-2.5 after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[var(--gray-border)]/28 last:after:hidden sm:flex-row sm:items-baseline sm:gap-3">
      <span className="w-20 shrink-0 font-heading text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)] sm:text-[11px]">
        {label}
      </span>
      <p className="min-w-0 break-all font-mono text-[13px] leading-snug text-[var(--foreground)]">
        {value || <span className="text-[var(--muted-foreground)]/50">N/A</span>}
      </p>
    </div>
  )
}

// InfoPopover: a tappable info icon that opens a Popover with explanatory
// text. Works on both touch (mobile) and click (desktop) unlike Tooltip,
// which is hover/focus only.
function InfoPopover({ label, description }: { label: string; description: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex size-4 cursor-pointer items-center justify-center text-[var(--muted-foreground)]/60 transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55"
          aria-label={`${label} explanation`}
        >
          <Info className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="z-[80] w-72 gap-1 border border-[var(--gray-border)]/35 bg-[#10161d] p-3 text-xs leading-relaxed text-[var(--foreground)] shadow-[0_26px_70px_-26px_rgba(0,0,0,0.95)] ring-1 ring-white/8"
      >
        {description}
      </PopoverContent>
    </Popover>
  )
}

// SubSectionLabel: a section heading with an accent bar on the left, used
// inside data-dense panels (DNS, IP intelligence) to mark off sub-blocks.
function SubSectionLabel({
  label,
  description,
  count,
}: {
  label: string
  description?: string
  count?: number | string
}) {
  return (
    <div className="relative flex items-center gap-2 pl-3">
      <span
        aria-hidden="true"
        className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 bg-[var(--accent)]/60"
      />
      <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]">
        {label}
      </p>
      {description && <InfoPopover label={label} description={description} />}
      {count !== undefined ? (
        <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] tabular-nums text-[var(--muted-foreground)]">
          {count}
        </Badge>
      ) : null}
    </div>
  )
}

// SectionTitle: a section heading with a left accent border, used for
// sub-sections inside TLS / Fingerprints / Domain info cards.
function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-2 border-l-2 border-[var(--accent)]/60 pl-2.5">
      <h4 className="font-heading text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]">
        {children}
      </h4>
      {count !== undefined && count > 0 && (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] tabular-nums">
          {count.toLocaleString()}
        </Badge>
      )}
    </div>
  )
}

// SummaryTile: a single cell in a summary strip (icon + label + value).
// Used at the top of IP intelligence, TLS, Fingerprints, Subdomains panels.
function SummaryTile({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  valueClassName?: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-3 py-3">
      <Icon className="size-4 shrink-0 text-[var(--accent)]" />
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          {label}
        </p>
        <p className={cn("truncate font-mono text-sm font-semibold text-[var(--foreground)]", valueClassName)}>
          {value}
        </p>
      </div>
    </div>
  )
}

// SummaryStrip: a single bordered row of SummaryTile cells, divided by
// hairline borders. Collapses to a vertical stack on mobile.
function SummaryStrip({
  tiles,
  variant = "framed",
}: {
  tiles: Array<{ icon: React.ElementType; label: string; value: string | number; valueClassName?: string }>
  variant?: "framed" | "soft"
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        variant === "framed" ? insetPanelClass : "rounded-lg bg-[var(--surface-mid)]/10 ring-1 ring-white/5",
      )}
    >
      {tiles.map((tile, index) => (
        <div
          key={tile.label}
          className={cn(
            index < tiles.length - 1
              && "relative max-sm:after:absolute max-sm:after:inset-x-3 max-sm:after:bottom-0 max-sm:after:h-px max-sm:after:bg-[var(--gray-border)]/18",
            [0, 1].includes(index) && tiles.length > 2 && "sm:after:absolute sm:after:inset-x-3 sm:after:bottom-0 sm:after:h-px sm:after:bg-[var(--gray-border)]/18",
            [0, 2].includes(index) && (variant === "framed" ? "sm:border-r" : "sm:border-r sm:border-[var(--gray-border)]/18"),
            index < tiles.length - 1 && tiles.length >= 4 && (variant === "framed" ? "lg:border-r" : "lg:border-r lg:border-[var(--gray-border)]/18"),
            "lg:border-b-0 lg:after:hidden",
          )}
        >
          <SummaryTile icon={tile.icon} label={tile.label} value={tile.value} valueClassName={tile.valueClassName} />
        </div>
      ))}
    </div>
  )
}

function groupDnsServicesBySubject(
  services: DnsInfrastructureSection["dnsServices"],
): Array<{
  subject: string
  provenance: DomainProvenance
  services: DnsInfrastructureSection["dnsServices"]
}> {
  const groups = new Map<string, { subject: string; provenance: DomainProvenance; services: DnsInfrastructureSection["dnsServices"] }>()

  for (const service of services) {
    const subject = service.subject ?? ""
    const key = `${subject}::${service.provenance}`
    const existing = groups.get(key)
    if (existing) {
      existing.services.push(service)
      continue
    }
    groups.set(key, {
      subject,
      provenance: service.provenance,
      services: [service],
    })
  }

  return [...groups.values()]
}

function DetailRow({
  label,
  value,
  description,
  mono = true,
  align = "right",
}: {
  label: string
  value: string | null | undefined | React.ReactNode
  description?: string
  mono?: boolean
  align?: "right" | "left"
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-x-3 px-3 py-1.5 sm:grid-cols-[minmax(6.5rem,0.4fr)_minmax(0,1fr)] sm:gap-x-4 sm:py-2", insetRowDividerClass)}>
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--muted-foreground)] sm:text-xs">
        {label}
        {description ? <InfoPopover label={label} description={description} /> : null}
      </span>
      <span
        className={cn(
          "min-w-0 text-[12.5px] leading-snug text-[var(--foreground)] break-words sm:text-[13px]",
          mono && "font-mono",
          align === "right" ? "text-left sm:text-right" : "text-left",
        )}
      >
        {value === null || value === undefined || value === "" ? (
          <span className="text-[var(--muted-foreground)]/60">N/A</span>
        ) : (
          value
        )}
      </span>
    </div>
  )
}

type InternalCoHost = NetworkIntelligenceSection["internalMatches"][number]

function groupInternalCoHosts(matches: readonly InternalCoHost[]) {
  const groups = new Map<string, { key: string; target: string; title: string; matches: InternalCoHost[] }>()

  for (const match of matches) {
    const key = match.target.trim().toLowerCase()
    const existing = groups.get(key)

    if (existing) {
      existing.matches.push(match)
      if (!existing.title && match.title) {
        existing.title = match.title
      }
      continue
    }

    groups.set(key, {
      key,
      target: match.target,
      title: match.title,
      matches: [match],
    })
  }

  return [...groups.values()]
}

function getReverseDomainRows(domains: readonly string[]) {
  return domains.map((domain, index) => {
    const labels = domain.split(".").filter(Boolean)
    const baseDomain = labels.length > 1 ? labels.slice(-2).join(".") : domain
    const prefix = labels.length > 2 ? labels.slice(0, -2).join(".") : "@"

    return {
      id: `${domain}-${index}`,
      domain,
      baseDomain,
      prefix,
    }
  })
}

export function NetworkIntelligenceCard({ network }: { network: NetworkIntelligenceSection }) {
  const internalMatches = network.internalMatches
  const externalDomains = network.reverseIp.domains
  const coHostGroups = groupInternalCoHosts(internalMatches)
  const reverseDomainRows = getReverseDomainRows(externalDomains)
  const [expandedCoHostKeys, setExpandedCoHostKeys] = useState<Set<string>>(() => new Set())
  const cidr = network.rdap.cidrs[0] ?? network.bgp.prefix ?? null
  const hasErrors = Object.keys(network.errors).length > 0 || Boolean(network.reverseIp.error)

  const summaryTiles = [
    { icon: MapPin, label: "IP", value: network.ip },
    { icon: Server, label: "Provider", value: network.providerName ?? "Unknown" },
    { icon: Globe, label: "Source", value: network.providerSource?.toUpperCase() ?? "BGP" },
    { icon: Network, label: "CIDR", value: cidr ?? "N/A" },
  ]

  function toggleCoHostGroup(key: string) {
    setExpandedCoHostKeys((current) => {
      const next = new Set(current)

      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }

      return next
    })
  }

  return (
    <SectionPanel
      title="IP Intelligence"
      icon={Network}
      badge={network.providerName ?? externalDomains.length}
      description="RDAP registration, BGP routing, and reverse-IP observations stitched together for the scanned host."
    >
      <div className="space-y-5">
        {/* Summary strip */}
        <SummaryStrip tiles={summaryTiles} />

        {/* RDAP + BGP Origin - side by side on desktop */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <SubSectionLabel
              label="RDAP"
              description="Registration Data Access Protocol data from the regional internet registry. Contact addresses here belong to the person or entity registered to the IP assignment and do not necessarily show the physical server location."
            />
            <div className={cn(insetPanelClass, "p-3")}>
              <DetailRow
                label="RDAP Registry"
                value={network.rdap.registry?.toUpperCase() ?? null}
                description="The registry inferred from the returned RDAP object itself, such as its port43 server or RDAP links. This is the best registry label for the specific assignment."
              />
              <DetailRow
                label="IANA Bootstrap"
                value={network.rdap.bootstrapRegistry?.toUpperCase() ?? null}
                description="The registry IANA's RDAP bootstrap selected as the starting lookup endpoint for the broader address block. More-specific assignments can point to a different RDAP registry."
              />
              <DetailRow label="Network" value={network.rdap.name} mono={false} />
              <DetailRow label="Handle" value={network.rdap.handle} />
              <DetailRow label="Parent Handle" value={network.rdap.parentHandle} />
              <DetailRow label="Type" value={network.rdap.type} mono={false} />
              <DetailRow label="Status" value={network.rdap.status.join(", ") || null} mono={false} />
              <DetailRow label="Country" value={network.rdap.country} mono={false} />
              <DetailRow
                label="Range"
                value={network.rdap.startAddress && network.rdap.endAddress ? `${network.rdap.startAddress} — ${network.rdap.endAddress}` : null}
              />
              <DetailRow label="Lookup URL" value={network.rdap.queryUrl} />
              {network.rdap.fallbackFrom ? <DetailRow label="Fallback From" value={network.rdap.fallbackFrom} /> : null}
            </div>
          </div>

          <div className="space-y-3">
            <SubSectionLabel
              label="BGP Origin"
              description="Border Gateway Protocol origin data for the routed prefix currently announcing this IP. This is usually the strongest signal for the network operator or hosting provider."
            />
            <div className={cn(insetPanelClass, "p-3")}>
              <DetailRow label="ASN" value={network.bgp.asNumber} />
              <DetailRow label="Name" value={network.bgp.description} mono={false} />
              <DetailRow label="Prefix" value={network.bgp.prefix} />
              <DetailRow label="Country" value={network.bgp.country} mono={false} />
              <DetailRow label="Registry" value={network.bgp.registry?.toUpperCase() ?? null} />
              <DetailRow label="Allocated" value={network.bgp.allocatedAt} />
              <DetailRow label="Source" value={network.bgp.source} mono={false} />
            </div>
          </div>
        </div>

        {/* RDAP Contacts */}
        {network.rdap.entities.length > 0 ? (
          <div className="space-y-3">
            <SubSectionLabel
              label="RDAP Contacts"
              count={network.rdap.entities.length}
              description="Registration contacts and entities attached to the RDAP assignment. Addresses identify registered contacts or organizations, not necessarily where the server hardware is located."
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {network.rdap.entities.map((entity, index) => (
                <div
                  key={`${entity.handle ?? entity.name ?? entity.organization ?? "entity"}-${index}`}
                  className={cn(insetPanelClass, "p-3")}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {entity.name ?? entity.organization ?? entity.handle ?? "Unknown entity"}
                    </span>
                    {entity.roles.map((role) => (
                      <span
                        key={role}
                        className="border border-[var(--gray-border)]/35 bg-[var(--surface-mid)]/25 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]"
                      >
                        {entity.relationship === "contact" ? role : `${role} ${entity.relationship}`}
                      </span>
                    ))}
                  </div>
                  {entity.organization && entity.organization !== entity.name ? (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">{entity.organization}</p>
                  ) : null}
                  {entity.handle ? (
                    <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{entity.handle}</p>
                  ) : null}
                  {entity.address ? (
                    <p className="relative mt-2 whitespace-pre-line pt-2 font-mono text-xs leading-relaxed text-[var(--muted-foreground)] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--gray-border)]/28">
                      {entity.address}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* PTR */}
        {network.ptr.length > 0 ? (
          <div className="space-y-3">
            <SubSectionLabel
              label="PTR"
              count={network.ptr.length}
              description="Reverse DNS pointer records returned by DNS for the IP address. PTR names are useful context, but they are operator-controlled and can be stale or misleading."
            />
            <div className={cn(insetPanelClass, "p-3")}>
              <div className="flex flex-wrap gap-1.5">
                {network.ptr.map((ptr) => (
                  <span
                    key={ptr}
                    className="rounded border border-[var(--gray-border)]/35 bg-[var(--background)]/40 px-2 py-1 font-mono text-xs text-[var(--foreground)]"
                  >
                    {ptr}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Co-hosts */}
        {coHostGroups.length > 0 ? (
          <div className="space-y-3">
            <SubSectionLabel
              label="Stackray Co-hosts"
              count={coHostGroups.length}
              description="Other scans in this Stackray database that resolved to the same host IP. This is local intelligence from your own scan history, not a third-party dataset."
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {coHostGroups.map((group) => (
                <div key={group.key} className={insetPanelClass}>
                  <div className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link
                        href={`/scans/${group.matches[0]?.scanId ?? ""}`}
                        className="break-all font-medium text-[var(--foreground)] transition-colors hover:text-[var(--accent)]"
                      >
                        {group.target}
                      </Link>
                      {group.title ? (
                        <span className="block truncate text-xs text-[var(--muted-foreground)]">{group.title}</span>
                      ) : null}
                    </div>
                    {group.matches.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => toggleCoHostGroup(group.key)}
                        className="inline-flex shrink-0 items-center gap-1 border border-[var(--gray-border)]/40 bg-[var(--surface-mid)]/30 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                        aria-expanded={expandedCoHostKeys.has(group.key)}
                      >
                        {group.matches.length}
                        {expandedCoHostKeys.has(group.key) ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                      </button>
                    ) : null}
                  </div>
                  {group.matches.length > 1 && expandedCoHostKeys.has(group.key) ? (
                    <div className="relative px-3 py-2 before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-[var(--gray-border)]/18">
                      <div className="flex flex-col">
                        {group.matches.map((match) => (
                          <Link
                            key={`${match.scanId}-${match.resultId}`}
                            href={`/scans/${match.scanId}`}
                            className={cn(
                              "flex flex-col gap-1 px-2 py-2 text-xs transition-colors hover:bg-[var(--surface-mid)]/42 sm:flex-row sm:items-center sm:justify-between sm:gap-3",
                              insetRowDividerClass,
                            )}
                          >
                            <span className="min-w-0 break-words text-[var(--muted-foreground)] sm:truncate">
                              {match.title || match.finalUrl || match.target}
                            </span>
                            <LocalTime
                              value={match.observedAt}
                              preset="shortDateTimeWithZone"
                              className="shrink-0 font-mono text-[var(--foreground)]"
                            />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* External Reverse IP - cards on mobile, table on lg+ */}
        {externalDomains.length > 0 ? (
          <div className="space-y-3">
            <SubSectionLabel
              label={`External Reverse IP${network.reverseIp.provider ? ` · ${network.reverseIp.provider}` : ""}`}
              count={externalDomains.length}
              description="Hostnames from a public reverse-IP dataset that have been observed on this IP. This is passive OSINT and can be incomplete, rate-limited, or stale."
            />
            {/* Mobile: card grid */}
            <div className="grid gap-2 lg:hidden">
              {reverseDomainRows.map((row, index) => (
                <div
                  key={row.id}
                  className={cn(insetPanelClass, "p-3 transition-colors hover:border-[var(--gray-border)]/55 hover:bg-[var(--surface-mid)]/28")}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--muted-foreground)]/70">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="min-w-0 break-all font-mono text-sm font-medium text-[var(--foreground)]">
                      {row.domain}
                    </p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 pl-7 font-mono text-xs text-[var(--muted-foreground)]">
                    <span className="min-w-0 truncate">
                      <span className="text-[var(--muted-foreground)]/60">base:</span>{" "}
                      <span className="text-[var(--foreground)]/85">{row.baseDomain}</span>
                    </span>
                    {row.prefix !== "@" && (
                      <span className="min-w-0 truncate">
                        <span className="text-[var(--muted-foreground)]/60">prefix:</span>{" "}
                        <span className="text-[var(--foreground)]/85">{row.prefix}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop: table */}
            <div className={cn(insetPanelClass, "hidden lg:block")}>
              <table className="w-full text-left text-sm">
                <thead className="relative bg-[var(--surface-mid)]/28 text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)] after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[var(--gray-border)]/28">
                  <tr>
                    <th scope="col" className="w-10 px-3 py-2 font-semibold">#</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Hostname</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Base Domain</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Prefix</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {reverseDomainRows.map((row, index) => (
                    <tr key={row.id} className={cn("bg-[var(--surface-mid)]/18 transition-colors hover:bg-[var(--surface-mid)]/30", insetRowDividerClass)}>
                      <td className="px-3 py-1.5 text-[var(--muted-foreground)] tabular-nums">{index + 1}</td>
                      <td className="break-all px-3 py-1.5 text-[var(--foreground)]">{row.domain}</td>
                      <td className="px-3 py-1.5 text-[var(--foreground)]">{row.baseDomain}</td>
                      <td className="break-all px-3 py-1.5 text-[var(--muted-foreground)]">{row.prefix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(network.reverseIp.sourceUrl || network.reverseIp.fallbackFrom) ? (
              <div className={cn(insetPanelClass, "p-3")}>
                <DetailRow label="Source URL" value={network.reverseIp.sourceUrl} align="left" />
                {network.reverseIp.fallbackFrom ? <DetailRow label="Fallback From" value={network.reverseIp.fallbackFrom} align="left" /> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {hasErrors ? (
          <p className="border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs leading-relaxed text-amber-300">
            Some IP intelligence sources returned partial data. Raw errors are retained in the enrichment record.
          </p>
        ) : null}

        {network.refreshedAt ? (
          <p className="relative pt-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]/80 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--gray-border)]/24">
            Updated <LocalTime value={network.refreshedAt} preset="shortDateTimeWithZone" />
          </p>
        ) : null}
      </div>
    </SectionPanel>
  )
}

const SUBDOMAIN_PAGE_SIZE = 250

export function SubdomainsSectionCard({ scanId, subdomains }: { scanId: string; subdomains: SubdomainsSection }) {
  const { summary } = subdomains
  const [items, setItems] = useState(subdomains.items)
  const [total, setTotal] = useState(subdomains.total)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const statusLabel = summary.state === "not_run" ? "Not run" : summary.state
  const hasMore = items.length < total

  useEffect(() => {
    setItems(subdomains.items)
    setTotal(subdomains.total)
    setPage(1)
    setLoadError(null)
  }, [scanId, subdomains.items, subdomains.total])

  async function loadMoreSubdomains() {
    if (loadingMore || !hasMore) {
      return
    }

    const nextPage = page + 1
    setLoadingMore(true)
    setLoadError(null)

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(SUBDOMAIN_PAGE_SIZE),
      })
      const response = await fetch(`/api/v1/scans/${scanId}/subdomains?${params}`)

      if (!response.ok) {
        throw new Error("Unable to load more subdomains.")
      }

      const payload = await response.json() as {
        items?: ScanSubdomainItem[]
        total?: number
      }

      setItems((currentItems) => {
        const seen = new Set(currentItems.map((item) => item.subdomainId))
        const nextItems = (payload.items ?? []).filter((item) => {
          if (seen.has(item.subdomainId)) {
            return false
          }

          seen.add(item.subdomainId)
          return true
        })

        return [...currentItems, ...nextItems]
      })
      setTotal(typeof payload.total === "number" ? payload.total : total)
      setPage(nextPage)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load more subdomains.")
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <SectionPanel
      title="Subdomains"
      icon={Globe2}
      badge={summary.resultCount}
      description="Validated hostnames discovered for the apex domain during the scan."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SummaryStatTile
            label="Discovery Status"
            value={statusLabel}
            valueClassName="capitalize"
          />
          <SummaryStatTile
            label="Apex Domain"
            value={summary.targetDomain ?? null}
            mono
            breakAll
            fallback="N/A"
          />
          <SummaryStatTile
            label="Validated Hosts"
            value={summary.resultCount.toLocaleString()}
            mono
          />
        </div>

        {summary.errorMessage ? (
          <div className="rounded-lg border border-red-500/35 bg-red-500/5 p-3 text-sm text-red-300 ring-1 ring-white/5">
            {summary.errorMessage}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className={insetPanelClass}>
            {/* Header row: only on sm+ where we use the row layout */}
            <div className={cn("hidden grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,0.5fr)] gap-3 bg-[var(--surface-mid)]/28 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)] sm:grid", insetHeaderDividerClass)}>
              <span>Host</span>
              <span>IP</span>
              <span>Source</span>
            </div>
            <div className="font-mono text-[13px] sm:text-sm">
              {items.map((item) => (
                <div
                  key={item.subdomainId}
                  className={cn("grid grid-cols-1 gap-1 px-3 py-2.5 transition-colors hover:bg-[var(--surface-mid)]/28 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,0.5fr)] sm:gap-3 sm:py-2", insetRowDividerClass)}
                >
                  <span className="min-w-0 break-all text-[var(--foreground)]">
                    <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]/60 sm:hidden">
                      Host
                    </span>
                    {item.host}
                  </span>
                  <span className="min-w-0 break-all text-[var(--muted-foreground)]">
                    <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]/60 sm:hidden">
                      IP
                    </span>
                    {item.ip ?? "—"}
                  </span>
                  <span className="min-w-0 truncate text-[var(--muted-foreground)]">
                    <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]/60 sm:hidden">
                      Source
                    </span>
                    {item.source ?? "unknown"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={cn(insetPanelClass, "p-4 text-sm text-[var(--muted-foreground)]")}>
            No validated subdomains found.
          </div>
        )}

        {total > items.length ? (
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]/80">
            Showing {items.length} of {total.toLocaleString()} validated subdomains.
          </p>
        ) : null}

        {loadError ? (
          <div className="rounded-lg border border-red-500/35 bg-red-500/5 p-3 text-sm text-red-300 ring-1 ring-white/5">
            {loadError}
          </div>
        ) : null}

        {hasMore ? (
          <button
            type="button"
            onClick={loadMoreSubdomains}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--gray-border)]/45 bg-[var(--surface-mid)]/38 px-3 py-2 text-sm text-[var(--foreground)] ring-1 ring-white/5 transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--surface-mid)]/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="size-4" />
            {loadingMore ? "Loading" : "Load more"}
          </button>
        ) : null}
      </div>
    </SectionPanel>
  )
}

function SummaryStatTile({
  label,
  value,
  valueClassName,
  mono = false,
  breakAll = false,
  fallback = "N/A",
}: {
  label: string
  value: string | null
  valueClassName?: string
  mono?: boolean
  breakAll?: boolean
  fallback?: string
}) {
  return (
    <div className={cn(insetPanelClass, "px-3 py-3")}>
      <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold leading-snug text-[var(--foreground)] sm:text-base",
          mono && "font-mono",
          breakAll ? "break-all" : "truncate",
          valueClassName,
        )}
      >
        {value ?? <span className="text-[var(--muted-foreground)]/50">{fallback}</span>}
      </p>
    </div>
  )
}

// TLS Certificate Section
export function TlsCertificateSection({ tls }: { tls: TlsFingerprintsSection }) {
  const cert = tls.certificate

  const getCertField = (field: string): string | undefined => {
    const value = cert?.[field]
    if (typeof value === "string") return value
    return undefined
  }

  const getCertArray = (field: string): string[] => {
    const value = cert?.[field]
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === "string")
    }
    return []
  }

  const sanCount = getCertArray("subject_alt_name").length
  const hasCert = Boolean(cert && Object.keys(cert).length > 0)

  const summaryTiles = [
    { icon: Globe, label: "SNI", value: tls.sni ?? "N/A" },
    { icon: Fingerprint, label: "JARM Hash", value: tls.jarmHash ?? "N/A", valueClassName: "text-xs break-all" },
    ...(getCertField("tls_version") ? [{ icon: Lock, label: "TLS Version", value: getCertField("tls_version") as string }] : []),
    ...(getCertField("serial") ? [{ icon: FileText, label: "Serial", value: getCertField("serial") as string }] : []),
  ]

  return (
    <SectionPanel
      title="TLS Certificate"
      icon={Lock}
      description="Server certificate, TLS handshake metadata, and any extra subjects/issuers observed during the scan."
    >
      <div className="space-y-5">
        {/* Summary strip */}
        <SummaryStrip tiles={summaryTiles} variant="soft" />

        {/* Certificate Details */}
        {hasCert ? (
          <div className="space-y-2">
            <SectionTitle>Certificate Details</SectionTitle>
            <div className="grid gap-4 rounded-lg bg-[var(--surface-mid)]/10 px-4 py-4 ring-1 ring-white/5 sm:grid-cols-2">
              {getCertField("subject") ? (
                <div className="min-w-0">
                  <p className="mb-1 font-heading text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Subject</p>
                  <p className="break-all font-mono text-sm text-[var(--foreground)]">{getCertField("subject")}</p>
                </div>
              ) : null}
              {getCertField("issuer") ? (
                <div className="min-w-0">
                  <p className="mb-1 font-heading text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Issuer</p>
                  <p className="break-all font-mono text-sm text-[var(--foreground)]">{getCertField("issuer")}</p>
                </div>
              ) : null}
              {(getCertField("not_before") || getCertField("not_after")) && (
                <TlsValidity
                  notBefore={getCertField("not_before") ?? null}
                  notAfter={getCertField("not_after") ?? null}
                />
              )}
              {sanCount > 0 ? (
                <div className="min-w-0 sm:col-span-2">
                  <p className="mb-2 font-heading text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                    Subject Alt Names <span className="text-[var(--muted-foreground)]/60">· {sanCount}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {getCertArray("subject_alt_name").map((san) => (
                      <span
                        key={san}
                        className="rounded border border-[var(--gray-border)]/35 bg-[var(--background)]/40 px-2 py-1 font-mono text-xs text-[var(--foreground)]"
                      >
                        {san}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* SSL DNS Names (Nuclei) */}
        {tls.sslDnsNames.length > 0 && (
          <div className="space-y-3">
            <SectionTitle count={tls.sslDnsNames.reduce((acc, f) => acc + f.subjectAltNames.length, 0)}>
              SSL DNS Names (Nuclei)
            </SectionTitle>
            <div className={cn(insetPanelClass, "p-3")}>
              <div className="flex flex-wrap gap-1.5">
                {tls.sslDnsNames.flatMap((finding) =>
                  finding.subjectAltNames.map((san) => (
                    <span
                      key={`${finding.matchedAt}-${san}`}
                      className="rounded border border-[var(--accent)]/35 bg-[var(--accent)]/5 px-2 py-1 font-mono text-xs text-[var(--accent)]"
                    >
                      {san}
                    </span>
                  )),
                )}
              </div>
            </div>
          </div>
        )}

        {/* SSL Issuers (Nuclei) */}
        {tls.sslIssuers.length > 0 && (
          <div className="space-y-3">
            <SectionTitle count={tls.sslIssuers.length}>SSL Issuers (Nuclei)</SectionTitle>
            <div className={insetPanelClass}>
              {tls.sslIssuers.map((finding) => (
                <div key={`${finding.matchedAt}-${finding.issuer}`} className={cn("px-3 py-2 font-mono text-sm text-[var(--foreground)]", insetRowDividerClass)}>
                  {finding.issuer}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionPanel>
  )
}

function TlsValidity({ notBefore, notAfter }: { notBefore: string | null; notAfter: string | null }) {
  const startLabel = notBefore
    ? new Date(notBefore).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—"
  const endLabel = notAfter
    ? new Date(notAfter).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—"
  const [daysLeft] = useState<number | null>(() => {
    if (!notAfter) {
      return null
    }
    const expiry = Date.parse(notAfter)
    if (Number.isNaN(expiry)) {
      return null
    }
    return Math.round((expiry - Date.now()) / (1000 * 60 * 60 * 24))
  })
  const isExpiringSoon = daysLeft !== null && daysLeft < 30
  const dayLabelClass = isExpiringSoon ? "text-amber-300" : "text-[var(--foreground)]"

  return (
    <div className="min-w-0 sm:col-span-2">
      <p className="mb-2 font-heading text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Validity</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="relative sm:pr-4 sm:after:absolute sm:after:inset-y-1 sm:after:right-0 sm:after:w-px sm:after:bg-[var(--gray-border)]/16">
          <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">Issued</p>
          <p className="mt-1 font-mono text-[13px] text-[var(--foreground)]">{startLabel}</p>
        </div>
        <div className="relative sm:px-4 sm:after:absolute sm:after:inset-y-1 sm:after:right-0 sm:after:w-px sm:after:bg-[var(--gray-border)]/16">
          <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">Expires</p>
          <p className={cn("mt-1 font-mono text-[13px]", dayLabelClass)}>{endLabel}</p>
        </div>
        <div className="sm:pl-4">
          <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">Days Left</p>
          <p className={cn("mt-1 font-mono text-[13px]", dayLabelClass)}>
            {daysLeft !== null ? daysLeft.toLocaleString() : "—"}
          </p>
        </div>
      </div>
    </div>
  )
}

function isAbsoluteHttpUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value)
}

function isLocalImagePath(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("/")
}

// Fingerprints Section
export function FingerprintsSection({ tls }: { tls: TlsFingerprintsSection }) {
  const hashEntries = Object.entries(tls.hashes).filter(([, value]) => value && value !== "N/A")
  const faviconPreviewSrc = resolveFaviconPreviewSrc(tls.favicon)
  const faviconDisplayValue = faviconPreviewSrc ?? tls.favicon.path ?? tls.favicon.url

  const summaryTiles = [
    { icon: Fingerprint, label: "Favicon MMH3", value: tls.favicon.mmh3 ?? "N/A" },
    { icon: Fingerprint, label: "Favicon MD5", value: tls.favicon.md5 ?? "N/A" },
  ]

  return (
    <SectionPanel
      title="Fingerprints"
      icon={Fingerprint}
      description="Stable content and favicon hashes that can be used to identify this site or match it against other Stackray scans."
    >
      <div className="space-y-5">
        {/* Favicon preview + URL */}
        {faviconDisplayValue ? (
          <div className={cn(insetPanelClass, "flex items-start gap-4 p-3")}>
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--gray-border)]/45 bg-[var(--surface-mid)] ring-1 ring-white/5">
              {faviconPreviewSrc ? (
                isLocalImagePath(faviconPreviewSrc) ? (
                  <Image
                    src={faviconPreviewSrc}
                    alt="Favicon"
                    width={40}
                    height={40}
                    className="object-contain"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization
                  <img
                    src={faviconPreviewSrc}
                    alt="Favicon"
                    width={40}
                    height={40}
                    className="object-contain"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.style.display = "none"
                    }}
                  />
                )
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">No preview</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Favicon URL
              </p>
              <p className="break-all font-mono text-sm text-[var(--foreground)]">
                {faviconDisplayValue}
              </p>
            </div>
          </div>
        ) : null}

        {/* Favicon hashes as summary tiles */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {summaryTiles.map((tile) => (
            <SummaryTile
              key={tile.label}
              icon={tile.icon}
              label={tile.label}
              value={tile.value}
            />
          ))}
        </div>

        {/* Content Hashes */}
        {hashEntries.length > 0 && (
          <div className="space-y-3">
            <SectionTitle count={hashEntries.length}>Content Hashes</SectionTitle>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {hashEntries.map(([hashType, hashValue]) => (
                <div key={hashType} className={cn(insetPanelClass, "p-3")}>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                    {hashType}
                  </p>
                  <p className="break-all font-mono text-xs text-[var(--foreground)]">{hashValue}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionPanel>
  )
}

// Domain Info Section
export function DomainInfoSection({ domain }: { domain: DomainIntelligenceSection }) {
  if (domain.metadata.length === 0) {
    return (
      <SectionPanel
        title="Domain Info"
        icon={FileText}
        description="Registrar and registry metadata for the domain."
      >
        <p className="text-sm text-[var(--muted-foreground)]">No domain metadata available</p>
      </SectionPanel>
    )
  }

  return (
    <SectionPanel
      title="Domain Info"
      icon={FileText}
      description="Registrar, registry, and lifecycle dates pulled from WHOIS for each domain in scope."
    >
      <div className="space-y-3">
        {domain.metadata.map((metadata) => (
          <DomainMetadataCard key={metadata.subject} metadata={metadata} />
        ))}
      </div>
    </SectionPanel>
  )
}

function DomainMetadataCard({ metadata }: { metadata: DomainMetadata }) {
  const registrationDate = metadata.registrationDate
    ? new Date(metadata.registrationDate)
    : null
  const expirationDate = metadata.expirationDate
    ? new Date(metadata.expirationDate)
    : null
  const lastChangedDate = metadata.lastChangedDate
    ? new Date(metadata.lastChangedDate)
    : null
  const [daysToExpiry] = useState<number | null>(() => {
    if (!expirationDate) {
      return null
    }
    return Math.round((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  })
  const isExpiringSoon = daysToExpiry !== null && daysToExpiry < 60 && daysToExpiry >= 0
  const isExpired = daysToExpiry !== null && daysToExpiry < 0

  const formatDate = (date: Date | null) =>
    date
      ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null

  return (
    <div className={cn(insetPanelClass, "p-3 sm:p-4")}>
      {/* Header: subject + provenance */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Globe className="size-4 shrink-0 text-[var(--accent)]" />
          <span className="truncate font-mono text-sm font-medium text-[var(--foreground)]">
            {metadata.subject}
          </span>
        </div>
        <TargetContextBadge provenance={metadata.provenance} />
      </div>

      {/* Registrar + lifecycle in a 2-col grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {metadata.registrarName ? (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Registrar</p>
            <p className="font-medium text-[var(--foreground)]">{metadata.registrarName}</p>
            {metadata.registrarIanaId ? (
              <p className="font-mono text-xs text-[var(--muted-foreground)]">IANA ID: {metadata.registrarIanaId}</p>
            ) : null}
          </div>
        ) : null}
        {metadata.registrarUrl ? (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Registrar URL</p>
            <a
              href={metadata.registrarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-mono text-sm text-[var(--accent)] hover:underline"
            >
              {metadata.registrarUrl}
            </a>
          </div>
        ) : null}
        {metadata.registrarEmail ? (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Registrar Email</p>
            <p className="break-all font-mono text-sm text-[var(--foreground)]">{metadata.registrarEmail}</p>
          </div>
        ) : null}
        {metadata.registrarPhone ? (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Registrar Phone</p>
            <p className="break-all font-mono text-sm text-[var(--foreground)]">{metadata.registrarPhone}</p>
          </div>
        ) : null}
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Registered</p>
          <p className="font-mono text-sm text-[var(--foreground)]">{formatDate(registrationDate) ?? "—"}</p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Expires</p>
          <p className="font-mono text-sm text-[var(--foreground)]">{formatDate(expirationDate) ?? "—"}</p>
        </div>
        {lastChangedDate ? (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Last Changed</p>
            <p className="font-mono text-sm text-[var(--foreground)]">{formatDate(lastChangedDate)}</p>
          </div>
        ) : null}
        {metadata.dnssec ? (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">DNSSEC</p>
            <p className={metadata.dnssec === "true" ? "text-sm text-emerald-400" : "text-sm text-orange-400"}>
              {metadata.dnssec === "true" ? "Enabled" : "Disabled"}
            </p>
          </div>
        ) : null}
      </div>

      {/* Nameservers + status in a shared footer */}
      {(metadata.nameservers.length > 0 || metadata.status.length > 0) && (
        <div className="relative mt-4 grid grid-cols-1 gap-4 pt-3 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--gray-border)]/28 sm:grid-cols-2">
          {metadata.nameservers.length > 0 && (
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Nameservers <span className="text-[var(--muted-foreground)]/60">· {metadata.nameservers.length}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {metadata.nameservers.map((ns) => (
                  <span
                    key={ns}
                    className="rounded border border-[var(--gray-border)]/35 bg-[var(--background)]/40 px-2 py-1 font-mono text-xs text-[var(--foreground)]"
                  >
                    {ns}
                  </span>
                ))}
              </div>
            </div>
          )}
          {metadata.status.length > 0 && (
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Status <span className="text-[var(--muted-foreground)]/60">· {metadata.status.length}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {metadata.status.map((s) => (
                  <span
                    key={s}
                    className="rounded border border-[var(--gray-border)]/35 bg-[var(--surface-mid)]/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isExpired && daysToExpiry !== null ? (
        <div className="mt-3 rounded-md border border-red-400/35 bg-red-400/5 px-3 py-2 text-xs text-red-300">
          Domain expired {Math.abs(daysToExpiry)} days ago.
        </div>
      ) : isExpiringSoon && daysToExpiry !== null ? (
        <div className="mt-3 rounded-md border border-amber-400/35 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
          Domain expires in {daysToExpiry} days.
        </div>
      ) : null}
    </div>
  )
}

// Robots.txt Section
export function RobotsTxtSection({ content }: { content: ContentSignalsSection }) {
  const { robotsTxt } = content

  return (
    <CompactCard title="Robots.txt" icon={FileText}>
      {robotsTxt ? (
        <div className="overflow-hidden rounded-lg border border-[var(--gray-border)]/45 bg-[var(--background)]/35 ring-1 ring-white/5">
          <div className={cn("flex flex-wrap items-center gap-2 bg-[var(--surface-mid)]/30 px-3 py-2", insetHeaderDividerClass)}>
            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
            <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-400">
              Found
            </span>
            {robotsTxt.matchedAt ? (
              <span
                className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]"
                title={robotsTxt.matchedAt}
              >
                {robotsTxt.matchedAt.replace(/^https?:\/\//, "")}
              </span>
            ) : null}
          </div>
          {robotsTxt.extractedResults.length > 0 ? (
            <div className="max-h-72 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed text-[var(--muted-foreground)]">
              {robotsTxt.extractedResults.map((result) => (
                <p key={result.slice(0, 50)} className="break-words">
                  {result}
                </p>
              ))}
            </div>
          ) : (
            <p className="p-3 text-xs text-[var(--muted-foreground)]">No directives parsed.</p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--gray-border)]/45 bg-[var(--background)]/35 px-3 py-3 ring-1 ring-white/5">
          <MinusCircle className="size-4 shrink-0 text-[var(--muted-foreground)]" />
          <span className="text-sm text-[var(--muted-foreground)]">No robots.txt detected</span>
        </div>
      )}
    </CompactCard>
  )
}

// CompactCard: a small bordered card with an icon + title header, used in
// the Scan Info grid and other multi-card layouts.
function CompactCard({
  title,
  icon: Icon,
  badge,
  children,
  bodyClassName,
}: {
  title: string
  icon: React.ElementType
  badge?: React.ReactNode
  children: React.ReactNode
  bodyClassName?: string
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-[var(--gray-border)]/45 bg-[var(--surface-dark)]/55 ring-1 ring-white/5">
      <div className="relative flex items-center gap-2.5 px-3 py-2.5 after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[var(--gray-border)]/28">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[var(--accent)]/25 bg-[var(--accent)]/8 text-[var(--accent)]">
          <Icon className="size-3.5" />
        </span>
        <h2 className="min-w-0 truncate font-heading text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] sm:text-[13px]">
          {title}
        </h2>
        {badge ? <div className="ml-auto shrink-0">{badge}</div> : null}
      </div>
      <div className={cn("flex-1 p-3", bodyClassName)}>{children}</div>
    </section>
  )
}

// Screenshot Preview Card
export function ScreenshotPreviewCard({ content, target }: { content: ContentSignalsSection; target: string }) {
  const { screenshot } = content
  const formattedSize = screenshot.byteSize
    ? screenshot.byteSize < 1024
      ? `${screenshot.byteSize} B`
      : screenshot.byteSize < 1024 * 1024
        ? `${Math.round(screenshot.byteSize / 1024)} KB`
        : `${(screenshot.byteSize / (1024 * 1024)).toFixed(1)} MB`
    : null

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--gray-border)]/45 bg-[var(--surface-dark)]/55 ring-1 ring-white/5">
      <div className="relative flex items-center justify-between gap-2 px-3 py-2.5 after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[var(--gray-border)]/28">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[var(--accent)]/25 bg-[var(--accent)]/8 text-[var(--accent)]">
            <Eye className="size-3.5" />
          </span>
          <h2 className="font-heading text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]">
            Homepage Screenshot
          </h2>
        </div>
      </div>
      <div className="overflow-hidden bg-[var(--surface-mid)]">
        {screenshot.available && screenshot.path ? (
          <>
            <div className="relative aspect-[16/10]">
              <Image
                src={screenshot.path}
                alt={`Homepage screenshot for ${target}`}
                fill
                unoptimized
                sizes="(max-width: 1024px) 100vw, 66vw"
                className="object-cover"
              />
            </div>
            <div className="relative px-3 py-2 before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-[var(--gray-border)]/28">
              <div className="flex items-center justify-between gap-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                {formattedSize ? <span>{formattedSize}</span> : <span />}
                {screenshot.capturedAt ? (
                  <span>
                    <LocalTime value={screenshot.capturedAt} preset="fullDateTimeWithZone" />
                  </span>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-[var(--surface-mid)] to-[var(--surface-dark)]">
            <div className="text-center">
              <Globe className="mx-auto mb-3 size-12 text-[var(--muted-foreground)]" />
              <p className="text-sm text-[var(--muted-foreground)]">Screenshot not available</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// Redirect Chain Card
export function RedirectChainCard({ delivery }: { delivery: DeliveryRedirectsSection }) {
  const hasRedirects = delivery.redirectChain.items.length > 1
  const hopCount = delivery.redirectChain.items.length - 1

  return (
    <CompactCard
      title="Redirect Chain"
      icon={LinkIcon}
      badge={
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]/80">
          {hopCount} hop{hopCount === 1 ? "" : "s"}
        </span>
      }
    >
      {hasRedirects ? (
        <div className="flex flex-col items-stretch">
          {delivery.redirectChain.items.map((hop, hopIdx) => {
            const statusCode = hop.statusCode ?? delivery.redirectChain.statusCodes[hopIdx]
            const statusColor =
              statusCode === undefined
                ? "text-[var(--muted-foreground)]"
                : statusCode >= 200 && statusCode < 300
                  ? "text-emerald-400"
                  : statusCode >= 300 && statusCode < 400
                    ? "text-amber-400"
                    : "text-red-400"
            return (
              <div key={`${hop.url}-${statusCode}`} className="flex flex-col">
                <div className="flex items-start gap-2 rounded-lg border border-[var(--gray-border)]/45 bg-[var(--background)]/40 px-2.5 py-2 ring-1 ring-white/5 transition-colors hover:border-[var(--accent)]/45">
                  <span className={cn("mt-0.5 shrink-0 font-mono text-xs font-semibold tabular-nums", statusColor)}>
                    {statusCode ?? "—"}
                  </span>
                  <span className="min-w-0 break-all font-mono text-[12px] text-[var(--foreground)]">{hop.url}</span>
                </div>
                {hopIdx < delivery.redirectChain.items.length - 1 ? (
                  <div className="ml-[1.05rem] flex h-3 w-px items-center justify-center bg-[var(--accent)]/45">
                    <ChevronDown className="size-2.5 -translate-y-[3px] bg-[var(--surface-dark)] text-[var(--accent)]/70" />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--gray-border)]/45 bg-[var(--background)]/40 px-3 py-2.5 text-sm text-[var(--muted-foreground)] ring-1 ring-white/5">
          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
          <span>No redirects, direct response</span>
        </div>
      )}
    </CompactCard>
  )
}

// Body Domains Card
export function BodyDomainsCard({ content }: { content: ContentSignalsSection }) {
  const [viewAll, setViewAll] = useState(false)
  const totalDomains = content.bodyDomains.length + content.bodyFqdns.length
  const visibleBodyDomains = viewAll ? content.bodyDomains : content.bodyDomains.slice(0, 18)
  const visibleBodyFqdns = viewAll ? content.bodyFqdns : content.bodyFqdns.slice(0, 12)

  return (
    <CompactCard
      title="Body Domains"
      icon={Globe2}
      badge={
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]/80">
          {totalDomains}
        </span>
      }
    >
      <div className="space-y-3">
        {content.bodyDomains.length > 0 ? (
          <div>
            <p className="mb-2 font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
              Apex domains <span className="text-[var(--muted-foreground)]/60">· {content.bodyDomains.length}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {visibleBodyDomains.map((domain) => (
                <span
                  key={domain}
                  className="rounded border border-[var(--gray-border)]/30 bg-[var(--background)]/40 px-2 py-1 text-xs text-[var(--foreground)]"
                >
                  {domain}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {content.bodyFqdns.length > 0 ? (
          <div>
            <p className="mb-2 font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
              FQDNs <span className="text-[var(--muted-foreground)]/60">· {content.bodyFqdns.length}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {visibleBodyFqdns.map((fqdn) => (
                <span
                  key={fqdn}
                  className="rounded border border-[var(--gray-border)]/30 bg-[var(--background)]/40 px-2 py-1 font-mono text-[11px] text-[var(--foreground)]"
                >
                  {fqdn}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {totalDomains > 18 ? (
          <button
            type="button"
            onClick={() => setViewAll(!viewAll)}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent)] transition-colors hover:text-[var(--accent)]/80"
          >
            {viewAll ? "← View less" : `View all ${totalDomains} domains →`}
          </button>
        ) : null}
      </div>
    </CompactCard>
  )
}

// History Card
export function HistoryCard({ history }: { history: HistorySection }) {
  const getStatusDot = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-400"
      case "failed":
        return "bg-red-400"
      case "cancelled":
        return "bg-amber-400"
      default:
        return "bg-[var(--muted-foreground)]"
    }
  }

  return (
    <CompactCard
      title="Previous Scans"
      icon={History}
      badge={
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]/80">
          {history.items.length}
        </span>
      }
      bodyClassName="p-0"
    >
      <div>
        {history.items.map((item) => (
          <Link
            key={item.scanId}
            href={`/scans/${item.scanId}`}
            className={cn("group block px-3 py-2.5 transition-colors hover:bg-[var(--surface-mid)]/25", insetRowDividerClass)}
          >
            <div className="flex items-baseline gap-3">
              <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", getStatusDot(item.status))} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-[var(--foreground)]">
                    {item.title || "Untitled"}
                  </p>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]/80">
                    {item.status}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]/80">
                  <LocalTime value={item.completedAt} preset="shortDateTimeWithZone" />
                  <span>·</span>
                  <span>{item.technologies.length} tech</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </CompactCard>
  )
}

// Scan Info Card
export function ScanInfoCard({
  scanId,
  source,
  submittedAt,
  completedAt,
  asnNumber,
}: {
  scanId: string
  source: string
  submittedAt: string
  completedAt: string | null
  asnNumber: string | null
}) {
  return (
    <CompactCard title="Scan Info" icon={Info} bodyClassName="p-1">
      <DetailRow label="Source" value={source} mono={false} />
      <DetailRow label="Scan ID" value={scanId} />
      <DetailRow
        label="Submitted"
        value={<LocalTime value={submittedAt} preset="shortDateTimeWithZone" />}
      />
      {completedAt ? (
        <DetailRow
          label="Completed"
          value={<LocalTime value={completedAt} preset="shortDateTimeWithZone" />}
        />
      ) : null}
      {asnNumber ? <DetailRow label="ASN" value={asnNumber} /> : null}
    </CompactCard>
  )
}

export { RawEvidenceSummaryCards }

// Raw Evidence Section Component
export function RawEvidenceCard({ rawEvidence }: { rawEvidence: RawEvidenceSection }) {
  return (
    <div id="raw-evidence" className="scroll-mt-24">
      <RawEvidenceTabs
        rawHttpx={rawEvidence.rawHttpx}
        nuclei={rawEvidence.nuclei}
      />
    </div>
  )
}
