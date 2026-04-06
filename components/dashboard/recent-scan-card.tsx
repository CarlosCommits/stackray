"use client"

import { useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Activity,
  Globe,
  Server,
  Zap,
  ArrowRightLeft,
} from "lucide-react"
import { resolveFaviconPreviewSrc } from "@/lib/favicon"
import type { RecentScan } from "@/components/dashboard/types"

interface RecentScanCardProps {
  scan: RecentScan
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
  return ip.trim().length > 0 && ip !== "—"
}

function getStatusBadge(status: RecentScan["status"]) {
  switch (status) {
    case "complete":
      return (
        <Badge variant="outline" className="rounded-full border-emerald-500/40 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Done
        </Badge>
      )
    case "analyzing":
      return (
        <Badge className="flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-medium text-[var(--primary-foreground)]">
          <Activity className="h-3 w-3" />
          Active
        </Badge>
      )
    case "failed":
      return (
        <Badge variant="outline" className="rounded-full border-red-500/40 px-2 py-0.5 text-[11px] font-medium text-red-400">
          <AlertCircle className="mr-1 h-3 w-3" />
          Failed
        </Badge>
      )
  }
}

function getStatusBorder(status: RecentScan["status"]) {
  switch (status) {
    case "complete":
      return "border-emerald-500/10"
    case "analyzing":
      return "border-[var(--accent)]/30"
    case "failed":
      return "border-red-500/20"
    default:
      return "border-[var(--gray-border)]"
  }
}

function SummaryRow({ scan }: { scan: RecentScan }) {
  if (scan.status === "failed") {
    return (
      <div className="flex items-center gap-2 text-[11px] text-red-400/80">
        <AlertCircle className="h-3 w-3" />
        <span className="truncate">{scan.error}</span>
      </div>
    )
  }

  if (scan.status === "analyzing") {
    const progressValue = scan.progress ?? 0

    return (
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Progress value={progressValue} className="h-1 bg-[var(--gray-border)]" />
        </div>
        <span className="w-8 text-right font-mono text-[11px] text-[var(--accent)]">
          {progressValue}%
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px]">
      {scan.statusCode && (
        <span className={`rounded px-1.5 py-0.5 ${scan.statusCode < 400 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
          {scan.statusCode}
        </span>
      )}
      {scan.server && (
        <span className="flex items-center gap-1 text-[var(--text-dim)]">
          <Server className="h-3 w-3" />
          {scan.server}
        </span>
      )}
      {scan.cdn && (
        <span className="flex items-center gap-1 text-[var(--text-dim)]">
          <Zap className="h-3 w-3" />
          {scan.cdn}
        </span>
      )}
      {scan.redirectCount !== undefined && scan.redirectCount > 0 && (
        <span className="flex items-center gap-1 text-[var(--text-dim)]">
          <ArrowRightLeft className="h-3 w-3" />
          {scan.redirectCount} redirect{scan.redirectCount > 1 ? "s" : ""}
        </span>
      )}
      {scan.responseTimeMs ? (
        <span className="ml-auto text-[var(--text-dim)]">{scan.responseTimeMs}ms</span>
      ) : null}
    </div>
  )
}

export function RecentScanCard({ scan }: RecentScanCardProps) {
  const router = useRouter()
  const [faviconHidden, setFaviconHidden] = useState(false)
  const faviconPreviewSrc = faviconHidden ? null : resolveFaviconPreviewSrc(scan.faviconUrl ?? null)
  const techDisplayCount = 2
  const visibleTechs = scan.technologies?.slice(0, techDisplayCount) || []
  const remainingTechs = (scan.technologies?.length || 0) - techDisplayCount
  const metadataItems = [
    hasVisibleIp(scan.ip) ? scan.ip : null,
    formatRecentScanTimestamp(scan.timestamp),
  ].filter((item): item is string => item !== null)

  const openScanDetails = () => {
    router.push(`/scans/${scan.id}`)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      openScanDetails()
    }
  }

  return (
    <Card
      className={`widget-outline relative flex cursor-pointer flex-col gap-4 rounded-lg bg-[var(--surface-mid)] p-4 transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-[var(--accent)]/35 hover:bg-[var(--surface-light)]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${getStatusBorder(scan.status)}`}
      onClick={openScanDetails}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="link"
      aria-label={`View scan details for ${scan.target}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2.5">
            {faviconPreviewSrc ? (
              <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--surface-light)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization */}
                <img
                  src={faviconPreviewSrc}
                  alt=""
                  className="size-5 object-contain"
                  onError={() => setFaviconHidden(true)}
                />
              </div>
            ) : (
              <Globe className="h-5 w-5 shrink-0 text-[var(--accent)]" />
            )}
            <h4 className="truncate font-mono text-lg font-bold text-[var(--foreground)] xl:text-xl">
              {scan.target}
            </h4>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-8 font-mono text-xs text-[var(--text-dim)]/85">
            {metadataItems.map((item, index) => (
              <span key={`${scan.id}-${item}`} className="flex items-center gap-2">
                {index > 0 ? <span className="text-[var(--gray-border)]">•</span> : null}
                <span>{item}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="shrink-0">{getStatusBadge(scan.status)}</div>
      </div>

      <div className="min-h-[20px]">
        <SummaryRow scan={scan} />
      </div>

      {visibleTechs.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
          {visibleTechs.map((tech) => (
            <span
              key={tech}
              className="max-w-[8rem] shrink-0 truncate rounded border border-[var(--gray-border)]/50 bg-[var(--surface-light)]/50 px-1.5 py-0.5 text-xs text-[var(--text-dim)]"
            >
              {tech}
            </span>
          ))}
          {remainingTechs > 0 && (
            <span className="shrink-0 text-xs text-[var(--text-dim)]/70">+{remainingTechs} more</span>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-[var(--gray-border)]/50 pt-3">
        <span className="text-sm font-mono text-[var(--foreground)]/75">
          {scan.status === "complete" && scan.techCount !== undefined
            ? `${scan.techCount} technologies detected`
            : scan.status === "analyzing"
              ? "Analysis in progress…"
              : scan.status === "failed"
                ? "Scan needs attention"
                : ""}
        </span>

        <div className="flex items-center gap-2">
          {scan.status === "complete" ? (
            <span className="flex items-center gap-1 font-mono text-xs text-[var(--accent)]">
              Open scan
              <ExternalLink className="h-3 w-3" />
            </span>
          ) : null}
          {scan.status === "analyzing" ? (
            <span className="flex items-center gap-1 font-mono text-xs text-[var(--accent)]">
              <Activity className="h-3 w-3 motion-safe:animate-pulse" />
              Live details
            </span>
          ) : null}
          {scan.status === "failed" ? (
            <span className="flex items-center gap-1 font-mono text-xs text-red-300">
              <RefreshCw className="h-3 w-3" />
              Open scan
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
