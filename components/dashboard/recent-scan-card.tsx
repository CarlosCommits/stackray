"use client"

import { useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  Globe,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { DotmSquare4 } from "@/components/ui/dotm-square-4"
import { DotmSquare10 } from "@/components/ui/dotm-square-10"
import { Progress } from "@/components/ui/progress"
import { resolveFaviconPreviewSrc } from "@/lib/favicon"
import { formatTargetForDisplay } from "@/lib/targets/display-target"
import type { RecentScan } from "@/components/dashboard/types"

interface RecentScanCardProps {
  scan: RecentScan
}

const activeSteps: Array<RecentScan["phase"]> = ["queued", "httpx", "enrichment"]
const phaseShortLabels: Record<RecentScan["phase"], string> = {
  queued: "Queue",
  httpx: "Probe",
  enrichment: "Enrich",
  complete: "Done",
  failed: "Issue",
}

const recentScanTimestampFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
})

function formatRecentScanTimestamp(timestamp: string) {
  const parsed = new Date(timestamp)

  if (Number.isNaN(parsed.getTime())) {
    return timestamp
  }

  return recentScanTimestampFormatter.format(parsed)
}

function hasVisibleIp(ip: string) {
  const value = ip.trim()
  return value.length > 0 && value !== "-" && value !== "—" && value !== "â€”"
}

function getCardClassName(scan: RecentScan) {
  const statusClass = {
    complete: "border-emerald-500/15 hover:border-emerald-400/35",
    analyzing: "border-[var(--accent)]/35 hover:border-[var(--accent)]/60",
    failed: "border-red-500/25 hover:border-red-400/45",
  }[scan.status]

  const animationClass = scan.isNew
    ? "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-300"
    : ""

  return [
    "widget-outline relative flex min-h-[200px] cursor-pointer flex-col gap-2.5 overflow-hidden rounded-lg bg-[var(--surface-mid)] p-4 transition-[border-color,background-color,transform]",
    "hover:-translate-y-0.5 hover:bg-[var(--surface-light)]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]",
    statusClass,
    animationClass,
  ].join(" ")
}

function StatusBadge({ scan }: { scan: RecentScan }) {
  if (scan.status === "complete") {
    return (
      <Badge variant="outline" className="border-emerald-500/40 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
        <CheckCircle2 className="mr-1 size-3" />
        Done
      </Badge>
    )
  }

  if (scan.status === "failed") {
    return (
      <Badge variant="outline" className="border-red-500/40 px-2 py-0.5 text-[11px] font-medium text-red-400">
        <AlertCircle className="mr-1 size-3" />
        {scan.phaseLabel}
      </Badge>
    )
  }

  if (scan.phase === "queued") {
    return (
      <DotmSquare10
        size={24}
        dotSize={3}
        speed={1.6}
        color="var(--foreground)"
        opacityMid={1}
        opacityPeak={1}
      />
    )
  }

  return (
    <DotmSquare4
      size={24}
      dotSize={3}
      speed={1.2}
      color="var(--accent)"
      opacityMid={1}
      opacityPeak={1}
    />
  )
}

function PhaseRail({ phase }: { phase: RecentScan["phase"] }) {
  const activeIndex = activeSteps.indexOf(phase)

  return (
    <div className="grid grid-cols-3 gap-2">
      {activeSteps.map((step, index) => {
        const isCurrent = step === phase
        const isDone = activeIndex > index || phase === "complete"

        return (
          <div key={step} className="flex min-w-0 items-center gap-1.5">
            {isDone ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
            ) : isCurrent ? (
              <Activity className="size-3.5 shrink-0 text-[var(--accent)] motion-safe:animate-pulse" />
            ) : (
              <Circle className="size-3.5 shrink-0 text-[var(--text-dim)]/45" />
            )}
            <span className={`truncate text-[11px] ${isCurrent ? "text-[var(--foreground)]" : "text-[var(--text-dim)]"}`}>
              {phaseShortLabels[step]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ActiveSummary({ scan }: { scan: RecentScan }) {
  const progressValue = scan.progress ?? 0

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Progress value={progressValue} className="h-1.5 bg-[var(--gray-border)]" />
        <span className="w-9 text-right font-mono text-[11px] text-[var(--accent)]">{progressValue}%</span>
      </div>
      <PhaseRail phase={scan.phase} />
      <p className="line-clamp-2 text-xs leading-4 text-[var(--text-dim)]">
        {scan.phaseDescription ?? "Scan is running."}
      </p>
    </div>
  )
}

function CompletedSummary({ scan }: { scan: RecentScan }) {
  return (
    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
      {scan.statusCode ? (
        <span className={`rounded px-1.5 py-0.5 ${scan.statusCode < 400 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
          {scan.statusCode}
        </span>
      ) : null}
      {scan.server ? (
        <span className="flex min-w-0 max-w-[9rem] items-center gap-1 truncate text-[var(--text-dim)]">
          <Server className="size-3 shrink-0" />
          <span className="truncate">{scan.server}</span>
        </span>
      ) : null}
      {scan.cdn ? (
        <span className="flex min-w-0 max-w-[9rem] items-center gap-1 truncate text-[var(--text-dim)]">
          <Zap className="size-3 shrink-0" />
          <span className="truncate">{scan.cdn}</span>
        </span>
      ) : null}
      {scan.redirectCount !== undefined && scan.redirectCount > 0 ? (
        <span className="flex items-center gap-1 text-[var(--text-dim)]">
          <ArrowRightLeft className="size-3" />
          {scan.redirectCount} redirect{scan.redirectCount > 1 ? "s" : ""}
        </span>
      ) : null}
      {scan.responseTimeMs ? (
        <span className="ml-auto text-[var(--text-dim)]">{scan.responseTimeMs}ms</span>
      ) : null}
    </div>
  )
}

function SummaryPanel({ scan }: { scan: RecentScan }) {
  if (scan.status === "failed") {
    return (
      <div className="flex min-h-[78px] items-start gap-2 text-sm text-red-300">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span className="line-clamp-3">{scan.error}</span>
      </div>
    )
  }

  if (scan.status === "analyzing") {
    return <ActiveSummary scan={scan} />
  }

  return <CompletedSummary scan={scan} />
}

export function RecentScanCard({ scan }: RecentScanCardProps) {
  const { push } = useRouter()
  const [faviconHidden, setFaviconHidden] = useState(false)
  const faviconPreviewSrc = faviconHidden ? null : resolveFaviconPreviewSrc(scan.faviconUrl ?? null)
  const displayTarget = formatTargetForDisplay(scan.target)
  const techDisplayCount = 2
  const visibleTechs = scan.technologies?.slice(0, techDisplayCount) ?? []
  const remainingTechs = (scan.technologies?.length ?? 0) - techDisplayCount
  const metadataItems = [
    hasVisibleIp(scan.ip) ? scan.ip : null,
    formatRecentScanTimestamp(scan.timestamp),
  ].filter((item): item is string => item !== null)

  const openScanDetails = () => {
    push(`/scans/${scan.id}`)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      openScanDetails()
    }
  }

  return (
    <Card
      className={getCardClassName(scan)}
      onClick={openScanDetails}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="link"
      aria-label={`View scan details for ${displayTarget}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex min-w-0 items-center gap-2.5">
            {faviconPreviewSrc ? (
              <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--surface-light)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization */}
                <img
                  src={faviconPreviewSrc}
                  alt=""
                  className="size-5 object-contain"
                  onError={() => setFaviconHidden(true)}
                />
              </div>
            ) : (
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-light)]">
                <Globe className="size-4 text-[var(--accent)]" />
              </div>
            )}
            <h4 className="truncate font-mono text-lg font-semibold text-[var(--foreground)] xl:text-xl">
              {displayTarget}
            </h4>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-9 font-mono text-xs text-[var(--text-dim)]/85">
            {metadataItems.map((item, index) => (
              <span key={`${scan.id}-${item}`} className="flex items-center gap-2">
                {index > 0 ? <span className="text-[var(--gray-border)]">/</span> : null}
                <span>{item}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="shrink-0">
          <StatusBadge scan={scan} />
        </div>
      </div>

      <SummaryPanel scan={scan} />

      {visibleTechs.length > 0 ? (
        <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
          {visibleTechs.map((tech) => (
            <span
              key={tech}
              className="max-w-[8rem] shrink-0 truncate rounded border border-[var(--gray-border)]/50 bg-[var(--surface-light)]/50 px-1.5 py-0.5 text-xs text-[var(--text-dim)]"
            >
              {tech}
            </span>
          ))}
          {remainingTechs > 0 ? (
            <span className="shrink-0 text-xs text-[var(--text-dim)]/70">+{remainingTechs} more</span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--gray-border)]/50 pt-2.5">
        <span className="min-w-0 truncate text-sm font-mono text-[var(--foreground)]/75">
          {scan.status === "complete" && scan.techCount !== undefined
            ? `${scan.techCount} technologies detected`
            : scan.status === "analyzing"
              ? "Analysis in progress..."
              : scan.status === "failed"
                ? "Scan needs attention"
                : ""}
        </span>

        <span className={`flex shrink-0 items-center gap-1 font-mono text-xs ${scan.status === "failed" ? "text-red-300" : "text-[var(--accent)]"}`}>
          {scan.status === "failed" ? <RefreshCw className="size-3" /> : scan.status === "analyzing" ? <Activity className="size-3 motion-safe:animate-pulse" /> : <ExternalLink className="size-3" />}
          {scan.status === "analyzing" ? "Live details" : "Open scan"}
        </span>
      </div>
    </Card>
  )
}
