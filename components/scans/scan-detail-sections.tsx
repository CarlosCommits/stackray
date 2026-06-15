"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
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
import { RawEvidenceTabs } from "./raw-evidence-tabs"

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
  "rounded-none border border-[var(--gray-border)]/25 bg-[var(--surface-dark)]/72 shadow-none ring-0"

const compactPanelClass =
  "rounded-none border border-[var(--gray-border)]/22 bg-[var(--surface-dark)]/62 shadow-none ring-0"

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
    <div className="grid min-h-24 grid-cols-[auto_minmax(0,1fr)] gap-x-3 border-b border-[var(--gray-border)]/20 px-3 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 lg:px-4">
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
    <div className="min-h-24 border border-[var(--gray-border)]/22 bg-[var(--surface-mid)]/10 p-3">
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
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  badge?: string | number
}) {
  return (
    <section className={`${compactPanelClass} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--gray-border)]/20 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon className="size-4 shrink-0 text-[var(--accent)]" />
          <span className="truncate text-sm font-semibold text-[var(--foreground)]">{title}</span>
          {badge !== undefined && badge !== "" ? (
            <Badge variant="outline" className="ml-1 text-xs">
              {badge}
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="space-y-4 bg-[var(--background)]/35 p-3 sm:p-4">{children}</div>
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
                <span className={cn("mt-0.5 text-xs font-semibold", presentation.textClassName)}>{phase.status}</span>
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
    <section className={`${compactPanelClass} overflow-hidden`}>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_430px] xl:grid-cols-[minmax(0,1fr)_480px]">
        <div className="min-w-0 px-4 py-5 sm:px-5 lg:pl-7 xl:pl-8">
          <ResponseMetricStrip overview={overview} />
          {phases.length > 0 && (
            <div className="mt-14 border-t border-[var(--gray-border)]/20 pt-8">
              <ScanProgressTimelineTrack phases={phases} />
            </div>
          )}
        </div>
        <div className="border-t border-[var(--gray-border)]/20 lg:border-l lg:border-t-0">
          {content ? (
            <ScreenshotFrame content={content} target={target} />
          ) : (
            <ScreenshotPlaceholder />
          )}
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
    <div className="mb-[-0.5rem] mt-2">
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-[repeat(2,250px)] lg:ml-6 xl:ml-8 2xl:ml-12 2xl:grid-cols-[190px_165px_200px_255px] 2xl:gap-x-0 2xl:[&>*+*]:border-l 2xl:[&>*+*]:border-[var(--gray-border)]/45 2xl:[&>*+*]:pl-6 2xl:[&>*]:pr-5 2xl:[&>*+*]:shadow-[-1px_0_0_rgba(255,255,255,0.035)]">
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
    </div>
  )
}

function ScreenshotFrame({ content, target }: { content: ContentSignalsSection; target: string }) {
  const { screenshot } = content

  if (!screenshot.available || !screenshot.path) {
    return <ScreenshotPlaceholder />
  }

  return (
    <div className="relative aspect-[16/10] overflow-hidden border border-[var(--gray-border)]/20 bg-[var(--surface-mid)]">
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
    <div className="flex aspect-[16/10] items-center justify-center border border-[var(--gray-border)]/20 bg-gradient-to-br from-[var(--surface-mid)] to-[var(--surface-dark)]">
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
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 py-1.5">
      <Icon className={cn("mt-1 size-5 shrink-0 2xl:size-6", colorClasses[color])} />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)] 2xl:text-xs">
          {label}
        </p>
        <MetricValue value={value} fullValue={fullValue} className={cn(colorClasses[color], "text-lg 2xl:text-xl")} />
        {subValue && (
          <p className="mt-1.5 truncate text-sm text-[var(--muted-foreground)] 2xl:text-base" title={subValue}>
            {subValue}
          </p>
        )}
      </div>
    </div>
  )
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
    <section className={`${surfacePanelClass} px-4 py-4 sm:px-5`}>
      <div
        className={cn(
          "grid gap-0",
          hasPageContext && "xl:min-h-24 xl:grid-cols-[minmax(390px,0.95fr)_minmax(0,1.08fr)_minmax(300px,0.8fr)] xl:items-center",
        )}
      >
        <div className={cn("min-w-0", hasPageContext && "xl:pr-7")}>
          <div className="flex min-w-0 items-center gap-3">
            {favicon && (
              <FaviconImage
                favicon={favicon}
                alt=""
                imageSize={40}
                className="size-11 shrink-0 border border-[var(--gray-border)]/25"
              />
            )}
            <TruncatedTargetTitle href={targetHref} target={target} />
            {status !== "completed" && (
              <Badge variant="outline" className="ml-1 shrink-0 border-[var(--accent)]/30 px-3 py-1 text-[var(--accent)]">
                <div className="mr-1.5 size-2 rounded-full bg-[var(--accent)] animate-pulse" />
                {status}
              </Badge>
            )}
          </div>

          <div className="mt-3 flex min-w-0 flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-3">
            <div className="flex min-w-0 items-center gap-2 text-[var(--muted-foreground)]">
              <CalendarDays className="size-4 shrink-0" />
              <span>
                Submitted{" "}
                <LocalTime value={submittedAt} preset="fullDateTimeWithZone" />
              </span>
            </div>
            {currentAttempt && attemptHistory.length > 0 && (
              <>
                <span className="hidden text-[var(--gray-border)] sm:inline">|</span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[var(--muted-foreground)]">Attempt {currentAttempt.attemptNumber}</span>
                  {currentAttempt.fallbackReason && (
                    <Badge variant="outline" className="border-amber-400/30 text-xs text-amber-400">
                      Fallback: {currentAttempt.fallbackReason}
                    </Badge>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        {pageTitle && (
          <HeaderContextColumn label="Page title" className="mt-4 border-t border-[var(--gray-border)]/20 pt-4 xl:mt-0 xl:border-l xl:border-t-0 xl:border-[var(--gray-border)]/45 xl:px-8 xl:py-1 xl:shadow-[-1px_0_0_rgba(255,255,255,0.035)]">
            <p className="truncate text-base font-medium leading-snug text-[var(--foreground)] xl:text-lg" title={pageTitle}>
              {pageTitle}
            </p>
          </HeaderContextColumn>
        )}
        {finalUrl && (
          <HeaderContextColumn label="Final URL" className="mt-4 border-t border-[var(--gray-border)]/20 pt-4 xl:mt-0 xl:border-l xl:border-t-0 xl:border-[var(--gray-border)]/45 xl:py-1 xl:pl-8 xl:pr-2 xl:shadow-[-1px_0_0_rgba(255,255,255,0.035)]">
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
        )}
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
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
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
    <section className="grid overflow-hidden border border-[var(--gray-border)]/25 bg-[var(--surface-dark)]/68 sm:grid-cols-2 lg:grid-cols-[0.85fr_0.85fr_1.15fr_1.35fr]">
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
      <div className="border-b border-[var(--gray-border)]/20 px-3 py-3 md:border-b-0 md:border-r sm:px-4">
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
  const [tabScrollState, setTabScrollState] = useState({ canScrollLeft: false, canScrollRight: false })

  useEffect(() => {
    setActiveValue(defaultValue)
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

  if (!defaultValue) {
    return null
  }

  return (
    <Tabs
      value={activeValue}
      onValueChange={setActiveValue}
      className={`${compactPanelClass} gap-0 overflow-visible`}
    >
      <div className="sticky top-0 z-20 border-b border-[var(--gray-border)]/20 bg-[var(--surface-dark)]/96 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface-dark)]/82">
        <TabsList
          ref={tabListRef}
          variant="line"
          aria-label="Scan detail sections"
          className="flex !h-auto min-h-10 w-full justify-start gap-0.5 overflow-x-auto overflow-y-hidden rounded-none px-2 py-0 pr-12 [-ms-overflow-style:none] [scrollbar-width:none] sm:min-h-11 lg:flex-wrap lg:overflow-visible lg:py-1 lg:pr-2 [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => {
            const Icon = scanDetailSectionTabIcons[item.value] ?? FileText

            return (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="!h-10 flex-none cursor-pointer rounded-none border-0 px-2 py-0 text-xs font-medium text-[var(--muted-foreground)] after:!bottom-0 after:bg-[var(--accent)] hover:text-[var(--foreground)] aria-selected:bg-[var(--surface-mid)]/18 aria-selected:!text-[var(--accent)] data-active:text-[var(--accent)] data-[state=active]:text-[var(--accent)] sm:!h-11 sm:px-2.5"
                onClick={(event) => {
                  event.currentTarget.scrollIntoView({
                    block: "nearest",
                    inline: "center",
                    behavior: "smooth",
                  })
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

      <div className="min-w-0">
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
          className="grid w-full min-w-0 cursor-pointer grid-cols-[minmax(0,1fr)_minmax(6rem,0.45fr)] items-center gap-3 border-b border-[var(--gray-border)]/12 py-2 text-left transition-colors last:border-b-0 hover:bg-[var(--surface-mid)]/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 active:bg-[var(--surface-mid)]/18"
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
          <span className="min-w-0 truncate text-right text-sm text-[var(--muted-foreground)]">{row.type}</span>
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
    <section className={cn("mb-3 inline-block w-full break-inside-avoid border bg-[var(--surface-dark)]/36 align-top", presentation.borderClassName)}>
      <div className="flex items-center gap-3 border-b border-[var(--gray-border)]/16 px-3 py-2.5">
        <span className={cn("flex size-8 shrink-0 items-center justify-center", presentation.surfaceClassName)}>
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
      <div className="flex justify-start px-3 py-3 sm:px-4">
        <label className="relative block w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search technologies..."
            className="h-9 w-full border border-[var(--gray-border)]/25 bg-[var(--surface-dark)]/80 pl-9 pr-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] hover:border-[var(--gray-border)]/45 focus:border-[var(--accent)]/60"
          />
        </label>
      </div>

      <div className="border-t border-[var(--gray-border)]/16 p-3 [column-gap:0.75rem] sm:p-4 xl:columns-2">
        {visibleGroups.map((group) => (
          <TechnologyCategoryBlock key={`${group.categoryId}-${group.category}`} group={group} />
        ))}
        {visibleRows.length === 0 && (
          <div className="border border-[var(--gray-border)]/18 px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
            No technologies match the current search.
          </div>
        )}
      </div>
    </section>
  )
}

// DNS & Infrastructure Section Component
export function DnsInfrastructureCard({ dns }: { dns: DnsInfrastructureSection }) {
  const hasCname = dns.cname.length > 0
  const hasAsnRange = dns.asn.range && dns.asn.range.length > 0

  const capabilityItems = [
    { key: "http2", label: "HTTP/2", enabled: dns.capabilities.http2 },
    { key: "websocket", label: "WebSocket", enabled: dns.capabilities.websocket },
    { key: "pipeline", label: "Pipeline", enabled: dns.capabilities.pipeline },
    { key: "vhost", label: "VHost", enabled: dns.capabilities.vhost },
  ]

  return (
    <SectionPanel title="DNS & Infrastructure" icon={Network}>
      <div className="space-y-5">
        {/* Capabilities */}
        <div className="flex flex-wrap gap-2">
          {capabilityItems.map((cap) => (
            <div
              key={cap.key}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border ${
                cap.enabled
                  ? "border-[var(--accent)]/30 bg-[var(--accent)]/5"
                  : "border-[var(--gray-border)]/20 bg-[var(--gray-charcoal)]/50 opacity-60"
              }`}
            >
              <span className="text-sm font-medium text-[var(--foreground)]">{cap.label}</span>
              {cap.enabled ? (
                <CheckCircle2 className="size-3.5 text-[var(--accent)]" />
              ) : (
                <XCircle className="size-3.5 text-[var(--muted-foreground)]" />
              )}
            </div>
          ))}
        </div>

        {/* DNS Records */}
        <div>
          <p className="text-sm text-[var(--muted-foreground)] mb-3">DNS Records</p>
          <div className="grid grid-cols-1 gap-4 text-base md:grid-cols-3">
            <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
              <p className="text-sm text-[var(--muted-foreground)] mb-1">A Record</p>
              <p className="font-mono text-sm">{dns.a.join(", ") || dns.hostIp || "N/A"}</p>
            </div>
            <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
              <p className="text-sm text-[var(--muted-foreground)] mb-1">AAAA Records</p>
              <p className="font-mono text-sm">{dns.aaaa.join(", ") || "N/A"}</p>
            </div>
            <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
              <p className="text-sm text-[var(--muted-foreground)] mb-1">Resolvers</p>
              <p className="font-mono text-sm">{dns.resolvers.join(", ") || "N/A"}</p>
            </div>
          </div>
          {hasCname && (
            <div className="mt-3 p-3 bg-[var(--surface-mid)]/20 rounded-lg">
              <p className="text-sm text-[var(--muted-foreground)] mb-1">CNAME Records</p>
              <p className="font-mono text-sm">{dns.cname.join(", ")}</p>
            </div>
          )}
        </div>

        {/* ASN */}
        <div className="border-t border-[var(--gray-border)]/20 pt-5">
          <p className="text-sm text-[var(--muted-foreground)] mb-3">Network (ASN)</p>
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs shrink-0">
                {dns.asn.asNumber || "N/A"}
              </Badge>
              <span className="text-sm text-[var(--foreground)] break-all">{dns.asn.org || "Unknown organization"}</span>
            </div>
            {dns.asn.country && (
              <p className="text-sm text-[var(--muted-foreground)]">Country: {dns.asn.country}</p>
            )}
            {hasAsnRange && (
              <div className="mt-2 flex flex-wrap gap-1">
                {dns.asn.range!.map((r) => (
                  <Badge key={r} variant="outline" className="border-[var(--gray-border)] text-[var(--muted-foreground)] text-xs font-mono">
                    {r}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nameservers */}
        {dns.nameservers.length > 0 && (
          <div className="border-t border-[var(--gray-border)]/20 pt-5">
            <p className="text-sm text-[var(--muted-foreground)] mb-3">Nameservers</p>
            <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
              <div className="flex flex-wrap gap-2">
                {dns.nameservers.map((ns) => (
                  <Badge key={ns} variant="outline" className="border-[var(--gray-border)]/50 text-[var(--foreground)] text-sm font-mono px-2 py-1">
                    {ns}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DNS Services from Nuclei */}
        {dns.dnsServices.length > 0 && (
          <div className="border-t border-[var(--gray-border)]/20 pt-5">
            <p className="text-sm text-[var(--muted-foreground)] mb-3">Detected DNS Services</p>
            <div className="space-y-2">
              {dns.dnsServices.map((service) => (
                <div key={`${service.serviceName}-${service.subject}`} className="flex items-center justify-between p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Wifi className="size-4 text-[var(--accent)]" />
                    <span className="text-sm font-medium">{service.serviceName}</span>
                  </div>
                  <TargetContextBadge provenance={service.provenance} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TXT Records */}
        {dns.txtRecords.length > 0 && (
          <div className="border-t border-[var(--gray-border)]/20 pt-5">
            <p className="text-sm text-[var(--muted-foreground)] mb-3">TXT Records</p>
            <div className="space-y-2">
              {dns.txtRecords.map((txt) => (
                <div key={`${txt.subject}-${txt.records[0]?.slice(0, 20)}`} className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--muted-foreground)]">{txt.subject}</span>
                    <TargetContextBadge provenance={txt.provenance} />
                  </div>
                  <div className="space-y-1">
                    {txt.records.map((record) => (
                      <p key={record.slice(0, 50)} className="font-mono text-sm break-all">{record}</p>
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

function DetailRow({
  label,
  value,
  description,
}: {
  label: string
  value: string | null | undefined
  description?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="inline-flex items-center gap-1.5 text-[var(--muted-foreground)]">
        {label}
        {description && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex size-5 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                aria-label={`${label} explanation`}
              >
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
              {description}
            </TooltipContent>
          </Tooltip>
        )}
      </span>
      <span className="text-right font-mono text-[var(--foreground)] break-all">{value || "N/A"}</span>
    </div>
  )
}

function IntelligenceSubtitle({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--gray-border)]/20 pb-2 pt-2">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]">{label}</p>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-5 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            aria-label={`${label} explanation`}
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {description}
        </TooltipContent>
      </Tooltip>
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
    <SectionPanel title="IP Intelligence" icon={Network} badge={network.providerName ?? externalDomains.length}>
      <div className="space-y-4">
        <div className="rounded-lg bg-[var(--surface-mid)]/20 p-3 space-y-2">
          <DetailRow label="IP" value={network.ip} />
          <DetailRow label="Provider" value={network.providerName ?? "Unknown"} />
          <DetailRow label="Source" value={network.providerSource?.toUpperCase() ?? null} />
          <DetailRow label="CIDR" value={cidr} />
        </div>

        <div className="space-y-2">
          <IntelligenceSubtitle
            label="RDAP"
            description="Registration Data Access Protocol data from the regional internet registry. Contact addresses here belong to the person or entity registered to the IP assignment and do not necessarily show the physical server location."
          />
          <div className="rounded-lg bg-[var(--surface-mid)]/20 p-3 space-y-2">
            <DetailRow
              label="RDAP Registry"
              value={network.rdap.registry?.toUpperCase() ?? null}
              description="The registry inferred from the returned RDAP object itself, such as its port43 server or RDAP links. This is the best registry label for the specific assignment."
            />
            <DetailRow
              label="IANA Bootstrap Registry"
              value={network.rdap.bootstrapRegistry?.toUpperCase() ?? null}
              description="The registry IANA's RDAP bootstrap selected as the starting lookup endpoint for the broader address block. More-specific assignments can point to a different RDAP registry."
            />
            <DetailRow label="Network" value={network.rdap.name} />
            <DetailRow label="Handle" value={network.rdap.handle} />
            <DetailRow label="Parent Handle" value={network.rdap.parentHandle} />
            <DetailRow label="Type" value={network.rdap.type} />
            <DetailRow label="Status" value={network.rdap.status.join(", ") || null} />
            <DetailRow label="Country" value={network.rdap.country} />
            <DetailRow label="Range" value={network.rdap.startAddress && network.rdap.endAddress ? `${network.rdap.startAddress} - ${network.rdap.endAddress}` : null} />
            <DetailRow label="Lookup URL" value={network.rdap.queryUrl} />
            {network.rdap.fallbackFrom && <DetailRow label="Fallback From" value={network.rdap.fallbackFrom} />}
          </div>
        </div>

        {network.rdap.entities.length > 0 && (
          <div className="space-y-2">
            <IntelligenceSubtitle
              label="RDAP Contacts"
              description="Registration contacts and entities attached to the RDAP assignment. Addresses identify registered contacts or organizations, not necessarily where the server hardware is located."
            />
            <div className="grid gap-2">
              {network.rdap.entities.map((entity, index) => (
                <div
                  key={`${entity.handle ?? entity.name ?? entity.organization ?? "entity"}-${index}`}
                  className="rounded-lg bg-[var(--surface-mid)]/20 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--foreground)]">{entity.name ?? entity.organization ?? entity.handle ?? "Unknown entity"}</span>
                    {entity.roles.map((role) => (
                      <Badge key={role} variant="outline" className="border-[var(--gray-border)] text-[var(--muted-foreground)] text-xs">
                        {entity.relationship === "contact" ? role : `${role} ${entity.relationship}`}
                      </Badge>
                    ))}
                  </div>
                  {entity.organization && entity.organization !== entity.name && (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">{entity.organization}</p>
                  )}
                  {entity.handle && (
                    <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{entity.handle}</p>
                  )}
                  {entity.address && (
                    <p className="mt-2 whitespace-pre-line font-mono text-xs text-[var(--foreground)]">{entity.address}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <IntelligenceSubtitle
            label="BGP Origin"
            description="Border Gateway Protocol origin data for the routed prefix currently announcing this IP. This is usually the strongest signal for the network operator or hosting provider."
          />
          <div className="rounded-lg bg-[var(--surface-mid)]/20 p-3 space-y-2">
            <DetailRow label="ASN" value={network.bgp.asNumber} />
            <DetailRow label="Name" value={network.bgp.description} />
            <DetailRow label="Prefix" value={network.bgp.prefix} />
            <DetailRow label="Country" value={network.bgp.country} />
            <DetailRow label="Registry" value={network.bgp.registry?.toUpperCase() ?? null} />
            <DetailRow label="Allocated" value={network.bgp.allocatedAt} />
            <DetailRow label="Source" value={network.bgp.source} />
          </div>
        </div>

        {network.ptr.length > 0 && (
          <div className="space-y-2">
            <IntelligenceSubtitle
              label="PTR"
              description="Reverse DNS pointer records returned by DNS for the IP address. PTR names are useful context, but they are operator-controlled and can be stale or misleading."
            />
            <div className="flex flex-wrap gap-1.5">
              {network.ptr.map((ptr) => (
                <Badge key={ptr} variant="outline" className="border-[var(--gray-border)] text-[var(--foreground)] font-mono text-xs">
                  {ptr}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {coHostGroups.length > 0 && (
          <div className="space-y-2">
            <IntelligenceSubtitle
              label="Stackray Co-hosts"
              description="Other scans in this Stackray database that resolved to the same host IP. This is local intelligence from your own scan history, not a third-party dataset."
            />
            <div className="space-y-2">
              {coHostGroups.map((group) => (
                <div key={group.key} className="rounded-lg bg-[var(--surface-mid)]/20 text-sm">
                  <div className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <Link href={`/scans/${group.matches[0]?.scanId ?? ""}`} className="font-medium text-[var(--foreground)] hover:text-[var(--accent)] break-all">
                        {group.target}
                      </Link>
                      {group.title && <span className="block text-xs text-[var(--muted-foreground)] truncate">{group.title}</span>}
                    </div>
                    {group.matches.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => toggleCoHostGroup(group.key)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--gray-border)] px-2 py-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        aria-expanded={expandedCoHostKeys.has(group.key)}
                      >
                        {group.matches.length} scans
                        {expandedCoHostKeys.has(group.key) ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      </button>
                    ) : null}
                  </div>
                  {group.matches.length > 1 && expandedCoHostKeys.has(group.key) && (
                    <div className="border-t border-[var(--gray-border)]/20 px-3 pb-3 pt-2">
                      <div className="space-y-1.5">
                        {group.matches.map((match) => (
                          <Link
                            key={`${match.scanId}-${match.resultId}`}
                            href={`/scans/${match.scanId}`}
                            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-[var(--surface-mid)]/35"
                          >
                            <span className="truncate text-[var(--muted-foreground)]">{match.title || match.finalUrl || match.target}</span>
                            <LocalTime value={match.observedAt} preset="shortDateTimeWithZone" className="font-mono text-[var(--foreground)]" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {externalDomains.length > 0 && (
          <div className="space-y-2">
            <IntelligenceSubtitle
              label={`External Reverse IP${network.reverseIp.provider ? ` (${network.reverseIp.provider})` : ""}`}
              description="Hostnames from a public reverse-IP dataset that have been observed on this IP. This is passive OSINT and can be incomplete, rate-limited, or stale."
            />
            <div className="overflow-x-auto rounded-lg border border-[var(--gray-border)]/20">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-[var(--surface-mid)]/25 text-[var(--muted-foreground)]">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">#</th>
                    <th scope="col" className="px-3 py-2 font-medium">Hostname</th>
                    <th scope="col" className="px-3 py-2 font-medium">Base Domain</th>
                    <th scope="col" className="px-3 py-2 font-medium">Prefix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--gray-border)]/10">
                  {reverseDomainRows.map((row, index) => (
                    <tr key={row.id} className="bg-[var(--surface-mid)]/10">
                      <td className="px-3 py-2 font-mono text-[var(--muted-foreground)]">{index + 1}</td>
                      <td className="px-3 py-2 font-mono text-[var(--foreground)] break-all">{row.domain}</td>
                      <td className="px-3 py-2 font-mono text-[var(--foreground)]">{row.baseDomain}</td>
                      <td className="px-3 py-2 font-mono text-[var(--muted-foreground)] break-all">{row.prefix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg bg-[var(--surface-mid)]/20 p-3 space-y-2">
              <DetailRow label="Source URL" value={network.reverseIp.sourceUrl} />
              {network.reverseIp.fallbackFrom && <DetailRow label="Fallback From" value={network.reverseIp.fallbackFrom} />}
            </div>
          </div>
        )}

        {hasErrors && (
          <p className="text-xs text-amber-300">
            Some IP intelligence sources returned partial data. Raw errors are retained in the enrichment record.
          </p>
        )}

        {network.refreshedAt && (
          <p className="text-xs text-[var(--muted-foreground)]">
            Updated <LocalTime value={network.refreshedAt} preset="shortDateTimeWithZone" />
          </p>
        )}
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
    <SectionPanel title="Subdomains" icon={Globe2} badge={summary.resultCount}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 text-base md:grid-cols-3">
          <div className="rounded-lg bg-[var(--surface-mid)]/20 p-3">
            <p className="mb-1 text-sm text-[var(--muted-foreground)]">Discovery Status</p>
            <p className="font-mono text-sm capitalize">{statusLabel}</p>
          </div>
          <div className="rounded-lg bg-[var(--surface-mid)]/20 p-3">
            <p className="mb-1 text-sm text-[var(--muted-foreground)]">Apex Domain</p>
            <p className="break-all font-mono text-sm">{summary.targetDomain ?? "N/A"}</p>
          </div>
          <div className="rounded-lg bg-[var(--surface-mid)]/20 p-3">
            <p className="mb-1 text-sm text-[var(--muted-foreground)]">Validated Hosts</p>
            <p className="font-mono text-sm">{summary.resultCount.toLocaleString()}</p>
          </div>
        </div>

        {summary.errorMessage ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
            {summary.errorMessage}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-[var(--gray-border)]/20">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,0.5fr)] gap-3 border-b border-[var(--gray-border)]/20 bg-[var(--surface-mid)]/20 px-3 py-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              <span>Host</span>
              <span>IP</span>
              <span>Source</span>
            </div>
            <div className="divide-y divide-[var(--gray-border)]/15">
              {items.map((item) => (
                <div
                  key={item.subdomainId}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,0.5fr)] gap-3 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 break-all font-mono text-[var(--foreground)]">{item.host}</span>
                  <span className="min-w-0 break-all font-mono text-[var(--muted-foreground)]">{item.ip ?? "N/A"}</span>
                  <span className="min-w-0 truncate text-[var(--muted-foreground)]">{item.source ?? "unknown"}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-[var(--surface-mid)]/20 p-3 text-sm text-[var(--muted-foreground)]">
            No validated subdomains found.
          </div>
        )}

        {total > items.length ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Showing {items.length} of {total.toLocaleString()} validated subdomains.
          </p>
        ) : null}

        {loadError ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
            {loadError}
          </div>
        ) : null}

        {hasMore ? (
          <button
            type="button"
            onClick={loadMoreSubdomains}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--gray-border)]/30 bg-[var(--surface-mid)]/30 px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--surface-mid)]/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="size-4" />
            {loadingMore ? "Loading" : "Load more"}
          </button>
        ) : null}
      </div>
    </SectionPanel>
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

  return (
    <SectionPanel title="TLS Certificate" icon={Lock}>
      <div className="space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-1 gap-4 text-base sm:grid-cols-2 md:grid-cols-3">
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
            <p className="text-sm text-[var(--muted-foreground)] mb-1">SNI</p>
            <p className="font-mono text-sm">{tls.sni ?? "N/A"}</p>
          </div>
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
            <p className="text-sm text-[var(--muted-foreground)] mb-1">JARM Hash</p>
            <p className="font-mono text-xs break-all">{tls.jarmHash ?? "N/A"}</p>
          </div>
          {getCertField("tls_version") && (
            <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
              <p className="text-sm text-[var(--muted-foreground)] mb-1">TLS Version</p>
              <p className="font-mono text-sm">{getCertField("tls_version")}</p>
            </div>
          )}
        </div>

        {/* Certificate Details */}
        {cert && Object.keys(cert).length > 0 && (
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg space-y-3">
            {getCertField("subject") && (
              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Subject</p>
                <p className="font-mono text-sm break-all">{getCertField("subject")}</p>
              </div>
            )}
            {getCertField("issuer") && (
              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Issuer</p>
                <p className="font-mono text-sm break-all">{getCertField("issuer")}</p>
              </div>
            )}
            {getCertField("serial") && (
              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Serial</p>
                <p className="font-mono text-xs break-all">{getCertField("serial")}</p>
              </div>
            )}
            {(getCertField("not_before") || getCertField("not_after")) && (
              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Validity</p>
                <div className="font-mono text-sm">
                  {getCertField("not_before") && <span className="block">From: {getCertField("not_before")}</span>}
                  {getCertField("not_after") && <span className="block">Until: {getCertField("not_after")}</span>}
                </div>
              </div>
            )}
            {getCertArray("subject_alt_name").length > 0 && (
              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Subject Alt Names</p>
                <div className="flex flex-wrap gap-1">
                  {getCertArray("subject_alt_name").map((san) => (
                    <Badge key={san} variant="outline" className="border-[var(--gray-border)] text-[var(--muted-foreground)] text-xs">
                      {san}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SSL Findings from Nuclei */}
        {tls.sslDnsNames.length > 0 && (
          <div className="border-t border-[var(--gray-border)]/20 pt-4">
            <p className="text-sm text-[var(--muted-foreground)] mb-2">SSL DNS Names (Nuclei)</p>
            <div className="space-y-2">
              {tls.sslDnsNames.map((finding) => (
                <div key={`${finding.matchedAt}-${finding.subjectAltNames[0]}`} className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                  <div className="flex flex-wrap gap-1">
                    {finding.subjectAltNames.map((san) => (
                      <Badge key={san} variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xs">
                        {san}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tls.sslIssuers.length > 0 && (
          <div className="border-t border-[var(--gray-border)]/20 pt-4">
            <p className="text-sm text-[var(--muted-foreground)] mb-2">SSL Issuers (Nuclei)</p>
            <div className="space-y-2">
              {tls.sslIssuers.map((finding) => (
                <div key={`${finding.matchedAt}-${finding.issuer}`} className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                  <p className="font-mono text-sm">{finding.issuer}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionPanel>
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

  return (
    <SectionPanel title="Fingerprints" icon={Fingerprint}>
      <div className="space-y-4">
        {/* Favicon */}
        {faviconDisplayValue && (
          <div className="flex items-center gap-5">
            <div className="size-20 bg-[var(--surface-mid)] rounded-lg flex items-center justify-center overflow-hidden">
              {faviconPreviewSrc ? (
                isLocalImagePath(faviconPreviewSrc) ? (
                  <Image
                    src={faviconPreviewSrc}
                    alt="Favicon"
                    width={56}
                    height={56}
                    className="object-contain"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization
                  <img
                    src={faviconPreviewSrc}
                    alt="Favicon"
                    width={56}
                    height={56}
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
                <span className="font-mono text-xs text-[var(--muted-foreground)]">No preview</span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-[var(--muted-foreground)] mb-2">Favicon URL</p>
              <p className="font-mono text-sm break-all">{faviconDisplayValue}</p>
            </div>
          </div>
        )}

        {/* Favicon Hashes */}
        <div className="grid grid-cols-1 gap-4 text-base sm:grid-cols-2">
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Favicon MMH3</p>
            <p className="font-mono text-sm break-all">{tls.favicon.mmh3 ?? "N/A"}</p>
          </div>
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Favicon MD5</p>
            <p className="font-mono text-sm break-all">{tls.favicon.md5 ?? "N/A"}</p>
          </div>
        </div>

        {/* Content Hashes */}
        {hashEntries.length > 0 && (
          <div className="border-t border-[var(--gray-border)]/20 pt-4">
            <p className="text-sm text-[var(--muted-foreground)] mb-2">Content Hashes</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {hashEntries.map(([hashType, hashValue]) => (
                <div key={hashType} className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                  <p className="text-sm text-[var(--muted-foreground)] mb-1 uppercase">{hashType}</p>
                  <p className="font-mono text-xs break-all">{hashValue}</p>
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
      <SectionPanel title="Domain Info" icon={FileText}>
        <p className="text-[var(--muted-foreground)]">No domain metadata available</p>
      </SectionPanel>
    )
  }

  return (
    <SectionPanel title="Domain Info" icon={FileText}>
      <div className="space-y-4">
        {domain.metadata.map((metadata) => (
          <DomainMetadataCard key={metadata.subject} metadata={metadata} />
        ))}
      </div>
    </SectionPanel>
  )
}

function DomainMetadataCard({ metadata }: { metadata: DomainMetadata }) {
  return (
    <div className="p-4 bg-[var(--surface-mid)]/20 rounded-lg border border-[var(--gray-border)]/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-[var(--accent)]" />
          <span className="font-mono text-sm">{metadata.subject}</span>
        </div>
        <TargetContextBadge provenance={metadata.provenance} />
      </div>

      <div className="grid grid-cols-1 gap-4 text-base sm:grid-cols-2">
        {metadata.registrarName && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Registrar</p>
            <p className="font-medium">{metadata.registrarName}</p>
            {metadata.registrarIanaId && (
              <p className="text-xs text-[var(--muted-foreground)] font-mono">IANA ID: {metadata.registrarIanaId}</p>
            )}
          </div>
        )}
        {metadata.registrarUrl && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Registrar URL</p>
            <a
              href={metadata.registrarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--accent)] break-all hover:underline"
            >
              {metadata.registrarUrl}
            </a>
          </div>
        )}
        {metadata.registrarEmail && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Registrar Email</p>
            <p className="font-mono text-sm break-all">{metadata.registrarEmail}</p>
          </div>
        )}
        {metadata.registrarPhone && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Registrar Phone</p>
            <p className="font-mono text-sm break-all">{metadata.registrarPhone}</p>
          </div>
        )}
        {metadata.registrationDate && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Registration Date</p>
            <p className="font-mono text-sm">{metadata.registrationDate}</p>
          </div>
        )}
        {metadata.expirationDate && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Expiration Date</p>
            <p className="font-mono text-sm">{metadata.expirationDate}</p>
          </div>
        )}
        {metadata.lastChangedDate && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Last Changed</p>
            <p className="font-mono text-sm">{metadata.lastChangedDate}</p>
          </div>
        )}
        {metadata.dnssec && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">DNSSEC</p>
            <p className={metadata.dnssec === "true" ? "text-emerald-400" : "text-orange-400"}>
              {metadata.dnssec === "true" ? "Enabled" : "Disabled"}
            </p>
          </div>
        )}
      </div>

      {metadata.nameservers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--gray-border)]/20">
          <p className="text-sm text-[var(--muted-foreground)] mb-2">Nameservers</p>
          <div className="flex flex-wrap gap-2">
            {metadata.nameservers.map((ns) => (
              <Badge key={ns} variant="outline" className="border-[var(--gray-border)]/50 text-[var(--foreground)] text-sm font-mono px-2 py-1">
                {ns}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {metadata.status.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {metadata.status.map((s) => (
            <Badge key={s} variant="outline" className="border-[var(--gray-border)]/30 text-[var(--muted-foreground)] text-xs">
              {s}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// Robots.txt Section
export function RobotsTxtSection({ content }: { content: ContentSignalsSection }) {
  const { robotsTxt } = content

  return (
    <SectionPanel title="Robots.txt" icon={FileText}>
      {robotsTxt ? (
        <div className="p-4 bg-[var(--surface-mid)]/20 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span className="text-emerald-400">Robots.txt found</span>
          </div>
          {robotsTxt.matchedAt && (
            <p className="text-sm text-[var(--muted-foreground)] mb-2">Matched at: {robotsTxt.matchedAt}</p>
          )}
          {robotsTxt.extractedResults.length > 0 && (
            <div className="space-y-1">
              {robotsTxt.extractedResults.map((result) => (
                <p key={result.slice(0, 50)} className="font-mono text-sm text-[var(--muted-foreground)]">
                  {result}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 bg-[var(--surface-mid)]/20 rounded-lg">
          <div className="flex items-center gap-2">
            <MinusCircle className="size-4 text-[var(--muted-foreground)]" />
            <span className="text-[var(--muted-foreground)]">No robots.txt detected</span>
          </div>
        </div>
      )}
    </SectionPanel>
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
    <Card className={`${compactPanelClass} py-0`}>
      <CardContent className="p-3">
        <div className="mb-3 flex items-center gap-2">
          <Eye className="size-4 text-[var(--accent)]" />
          <span className="font-semibold text-base">Homepage Screenshot</span>
        </div>
        <div className="overflow-hidden border border-[var(--gray-border)]/20 bg-[var(--surface-mid)]">
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
              <div className="border-t border-[var(--gray-border)]/20 p-2.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  {formattedSize ? <span className="text-[var(--muted-foreground)]">{formattedSize}</span> : null}
                  {screenshot.capturedAt && (
                    <span className="text-[var(--muted-foreground)]">
                      <LocalTime value={screenshot.capturedAt} preset="fullDateTimeWithZone" />
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-[var(--surface-mid)] to-[var(--surface-dark)]">
              <div className="text-center">
                <Globe className="size-16 text-[var(--muted-foreground)] mx-auto mb-3" />
                <p className="text-base text-[var(--muted-foreground)]">Screenshot not available</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Redirect Chain Card
export function RedirectChainCard({ delivery }: { delivery: DeliveryRedirectsSection }) {
  const hasRedirects = delivery.redirectChain.items.length > 1

  return (
    <Card className={`${compactPanelClass} py-0`}>
      <CardContent className="p-3">
        <div className="mb-3 flex items-center gap-2">
          <LinkIcon className="size-4 text-[var(--accent)]" />
          <span className="font-semibold text-base">Redirect Chain</span>
        </div>
        {hasRedirects ? (
          <div className="flex flex-col items-center">
            {delivery.redirectChain.items.map((hop, hopIdx) => {
              const statusCode = hop.statusCode ?? delivery.redirectChain.statusCodes[hopIdx]
              return (
                <div key={`${hop.url}-${statusCode}`} className="w-full">
                  <div className="flex items-center gap-2 border border-[var(--gray-border)]/30 bg-[var(--surface-mid)]/20 p-2">
                    <span
                      className={`font-mono text-sm shrink-0 ${
                        statusCode === 200 ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {statusCode}
                    </span>
                    <span className="text-sm font-mono truncate text-[var(--foreground)]">{hop.url}</span>
                  </div>
                  {hopIdx < delivery.redirectChain.items.length - 1 && (
                    <div className="flex justify-center py-1">
                      <div className="w-0.5 h-4 bg-[var(--accent)]/50" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <CheckCircle2 className="size-4" />
            <span>No redirects, direct response</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Body Domains Card
export function BodyDomainsCard({ content }: { content: ContentSignalsSection }) {
  const [viewAll, setViewAll] = useState(false)
  const totalDomains = content.bodyDomains.length + content.bodyFqdns.length

  return (
    <Card className={`${compactPanelClass} py-0`}>
      <CardContent className="p-3">
        <div className="mb-3 flex items-center gap-2">
          <Globe2 className="size-4 text-[var(--accent)]" />
          <span className="font-semibold text-base">Body Domains</span>
          <Badge variant="outline" className="ml-auto text-sm">
            {totalDomains}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {(viewAll ? content.bodyDomains : content.bodyDomains.slice(0, 12)).map((domain) => (
            <Badge key={domain} variant="outline" className="border-[var(--gray-border)]/50 text-[var(--muted-foreground)] text-sm">
              {domain}
            </Badge>
          ))}
        </div>
        {content.bodyFqdns.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--gray-border)]/20">
            <p className="text-xs text-[var(--muted-foreground)] mb-2">FQDNs</p>
            <div className="flex flex-wrap gap-2">
              {(viewAll ? content.bodyFqdns : content.bodyFqdns.slice(0, 8)).map((fqdn) => (
                <Badge key={fqdn} variant="outline" className="border-[var(--gray-border)]/50 text-[var(--muted-foreground)] text-xs font-mono">
                  {fqdn}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {totalDomains > 12 && (
          <button
            type="button"
            onClick={() => setViewAll(!viewAll)}
            className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1 mt-3"
          >
            {viewAll ? "View less" : `View all ${totalDomains} domains`}
          </button>
        )}
      </CardContent>
    </Card>
  )
}

// History Card
export function HistoryCard({ history }: { history: HistorySection }) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="size-4 text-emerald-400" />
      case "failed":
        return <XCircle className="size-4 text-red-400" />
      case "cancelled":
        return <MinusCircle className="size-4 text-amber-400" />
      default:
        return <Clock className="size-4 text-[var(--muted-foreground)]" />
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "completed":
        return "border-emerald-400/30 text-emerald-400 bg-emerald-400/10"
      case "failed":
        return "border-red-400/30 text-red-400 bg-red-400/10"
      case "cancelled":
        return "border-amber-400/30 text-amber-400 bg-amber-400/10"
      default:
        return "border-[var(--gray-border)] text-[var(--muted-foreground)]"
    }
  }

  return (
    <Card className={`${compactPanelClass} py-0`}>
      <CardContent className="p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="size-4 text-[var(--accent)]" />
            <span className="font-semibold text-base">Previous Scans</span>
          </div>
          <Badge variant="outline" className="text-sm">
            {history.items.length}
          </Badge>
        </div>
        <div className="space-y-2">
          {history.items.map((item) => (
            <Link key={item.scanId} href={`/scans/${item.scanId}`} className="block">
              <div className="border border-[var(--gray-border)]/20 p-2.5 transition-colors hover:border-[var(--accent)]/30 hover:bg-[var(--surface-mid)]/20">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {getStatusIcon(item.status)}
                    <span className="font-mono text-sm text-[var(--foreground)] truncate">
                      <LocalTime value={item.completedAt} preset="shortDateTimeWithZone" />
                    </span>
                  </div>
                  <Badge variant="outline" className={`text-xs px-2 py-0.5 shrink-0 ${getStatusBadgeClass(item.status)}`}>
                    {item.status}
                  </Badge>
                </div>
                <p className="text-sm text-[var(--foreground)] font-medium line-clamp-1 mb-2">
                  {item.title || "Untitled"}
                </p>
                <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <Layers className="size-3.5" />
                  <span>{item.technologies.length} technologies</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
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
    <Card className={`${compactPanelClass} py-0`}>
      <CardContent className="p-3">
        <div className="mb-3 flex items-center gap-2">
          <Info className="size-4 text-[var(--accent)]" />
          <span className="font-semibold text-base">Scan Info</span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Source</span>
            <span className="font-mono">{source}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-[var(--muted-foreground)]">Scan ID</span>
            <span className="min-w-0 break-all text-right font-mono text-xs leading-relaxed">{scanId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Submitted</span>
            <span className="font-mono">
              <LocalTime value={submittedAt} preset="shortDateTimeWithZone" />
            </span>
          </div>
          {completedAt && (
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Completed</span>
              <span className="font-mono">
                <LocalTime value={completedAt} preset="shortDateTimeWithZone" />
              </span>
            </div>
          )}
          {asnNumber && (
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">ASN</span>
              <span className="font-mono">{asnNumber}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Raw Evidence Section Component
export function RawEvidenceCard({ rawEvidence, scanId, target }: { rawEvidence: RawEvidenceSection; scanId: string; target: string }) {
  return (
    <div id="raw-evidence" className="scroll-mt-24">
      <RawEvidenceTabs
        rawHttpx={rawEvidence.rawHttpx}
        nuclei={rawEvidence.nuclei}
        scanId={scanId}
        target={target}
      />
    </div>
  )
}
