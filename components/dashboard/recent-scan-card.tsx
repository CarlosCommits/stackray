"use client"

import { memo, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  Activity,
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  ChevronRight,
  Circle,
  Cloud,
  Globe,
  Server,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { LocalTime } from "@/components/ui/local-time"
import { Progress } from "@/components/ui/progress"
import { ScanCompleteIndicator } from "@/components/ui/scan-complete-indicator"
import { SquareLoader } from "@/components/ui/square-loader"
import { resolveFaviconPreviewSrc } from "@/lib/favicon"
import { trackStackrayEvent } from "@/lib/analytics"
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

const CARD_STATE_EASE = [0.22, 1, 0.36, 1] as const

type IntersectionVisibilityListener = (isIntersecting: boolean) => void

const documentVisibilityListeners = new Set<() => void>()
const intersectionVisibilityListeners = new WeakMap<Element, IntersectionVisibilityListener>()
let sharedIntersectionObserver: IntersectionObserver | null = null

function notifyDocumentVisibilityListeners() {
  documentVisibilityListeners.forEach((listener) => listener())
}

function subscribeDocumentVisibility(listener: () => void) {
  documentVisibilityListeners.add(listener)

  if (documentVisibilityListeners.size === 1) {
    document.addEventListener("visibilitychange", notifyDocumentVisibilityListeners)
  }

  return () => {
    documentVisibilityListeners.delete(listener)

    if (documentVisibilityListeners.size === 0) {
      document.removeEventListener("visibilitychange", notifyDocumentVisibilityListeners)
    }
  }
}

function getDocumentVisibilitySnapshot() {
  return !document.hidden
}

function getDocumentVisibilityServerSnapshot() {
  return true
}

function getSharedIntersectionObserver() {
  if (typeof IntersectionObserver === "undefined") {
    return null
  }

  sharedIntersectionObserver ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      intersectionVisibilityListeners.get(entry.target)?.(entry.isIntersecting)
    }
  })

  return sharedIntersectionObserver
}

function useAnimationVisibility() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isIntersecting, setIsIntersecting] = useState(true)
  const isDocumentVisible = useSyncExternalStore(
    subscribeDocumentVisibility,
    getDocumentVisibilitySnapshot,
    getDocumentVisibilityServerSnapshot,
  )

  useEffect(() => {
    const container = containerRef.current
    const observer = getSharedIntersectionObserver()

    if (!container || !observer) {
      return
    }

    intersectionVisibilityListeners.set(container, (nextIsIntersecting) => {
      setIsIntersecting(nextIsIntersecting)
    })
    observer.observe(container)

    return () => {
      intersectionVisibilityListeners.delete(container)
      observer.unobserve(container)
    }
  }, [])

  return {
    containerRef,
    shouldAnimate: isDocumentVisible && isIntersecting,
  }
}

function hasVisibleIp(ip: string) {
  const value = ip.trim()
  return value.length > 0 && value !== "-" && value !== "—" && value !== "â€”"
}

function getCardClassName(scan: RecentScan) {
  const statusClass = scan.status === "failed" ? "hover:border-red-400/60" : "hover:border-[color-mix(in_srgb,var(--gray-border)_70%,#60a5fa)]"

  return [
    "relative flex min-h-[160px] cursor-pointer flex-col gap-0 overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-[color-mix(in_srgb,var(--surface-dark)_92%,black)] p-0 ring-0 shadow-[0_18px_52px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] transition-[border-color,background-color,box-shadow,transform] duration-200 [content-visibility:auto] [contain-intrinsic-size:auto_180px]",
    "hover:-translate-y-0.5 hover:bg-[var(--surface-mid)]/35 hover:shadow-[0_18px_52px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.05)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#60a5fa] active:translate-y-px active:scale-[0.995]",
    statusClass,
  ].join(" ")
}

function getFooterSummary(scan: RecentScan, technologyCount: number) {
  if (scan.status === "complete") {
    if (technologyCount === 0) {
      return "No technologies detected"
    }

    return `${technologyCount} ${technologyCount === 1 ? "technology" : "technologies"} detected`
  }

  if (scan.status === "analyzing") {
    return scan.phaseDescription ?? scan.phaseLabel
  }

  return "Scan needs attention"
}

function getFooterAction(scan: RecentScan) {
  if (scan.status === "complete") {
    return "View report"
  }

  if (scan.status === "analyzing") {
    return "View live scan"
  }

  return "Review issue"
}

function ActiveStatusIndicator({ queued }: { queued: boolean }) {
  const { containerRef, shouldAnimate } = useAnimationVisibility()

  return (
    <div
      ref={containerRef}
      className="inline-flex"
      data-animation-state={shouldAnimate ? "running" : "paused"}
      data-slot="scan-activity-indicator"
    >
      <SquareLoader
        label={queued ? "Scan queued" : "Scan running"}
        color={queued ? "var(--foreground)" : "var(--accent)"}
        paused={!shouldAnimate}
        speedSeconds={queued ? 1.5 : 1.2}
        trackOpacity={queued ? 0.1 : 0.16}
      />
    </div>
  )
}

function StatusBadge({ scan }: { scan: RecentScan }) {
  if (scan.status === "complete") {
    return <ScanCompleteIndicator />
  }

  if (scan.status === "failed") {
    return (
      <Badge variant="outline" className="border-red-500/40 px-2 py-0.5 text-[11px] font-medium text-red-400">
        <AlertCircle className="mr-1 size-3" />
        {scan.phaseLabel}
      </Badge>
    )
  }

  return <ActiveStatusIndicator queued={scan.phase === "queued"} />
}

function PhaseRail({ phase }: { phase: RecentScan["phase"] }) {
  const activeIndex = activeSteps.indexOf(phase)

  return (
    <ol aria-label="Scan phases" className="grid grid-cols-3 gap-1.5" data-slot="scan-phase-rail">
      {activeSteps.map((step, index) => {
        const isCurrent = step === phase
        const isDone = activeIndex > index || phase === "complete"
        const state = isDone ? "complete" : isCurrent ? "active" : "pending"
        const stateClassName = isDone
          ? "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-300/90"
          : isCurrent
            ? "border-[var(--accent)]/45 bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--foreground)]"
            : "border-[var(--gray-border)]/55 bg-[var(--surface-mid)]/15 text-[var(--text-dim)]/60"

        return (
          <li
            key={step}
            aria-current={isCurrent ? "step" : undefined}
            className={["flex h-5 min-w-0 items-center justify-center gap-1 rounded-md border px-1.5", stateClassName].join(" ")}
            data-state={state}
          >
            {isDone ? (
              <CheckCircle2 className="size-3 shrink-0" />
            ) : isCurrent ? (
              <Activity className="size-3 shrink-0 text-[var(--accent)]" />
            ) : (
              <Circle className="size-3 shrink-0" />
            )}
            <span
              className={[
                "truncate text-[10px] sm:text-[11px]",
                isCurrent ? "font-semibold" : "font-medium",
              ].join(" ")}
            >
              {phaseShortLabels[step]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function ActiveSummary({ scan }: { scan: RecentScan }) {
  const progressValue = scan.progress ?? 0

  return (
    <div className="w-full space-y-1.5">
      <div className="flex min-w-0 items-center justify-between gap-3 font-mono text-[10px] leading-none sm:text-[11px]">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 font-heading font-semibold uppercase tracking-[0.12em] text-[#8fb9ea]/80">
            {scan.phase === "queued" ? "Status" : "Current"}
          </span>
          <span className="truncate font-medium text-[var(--foreground)]">{scan.phaseLabel}</span>
        </div>
        <span className="shrink-0 tabular-nums text-[var(--accent)]">{progressValue}%</span>
      </div>
      <Progress
        value={progressValue}
        aria-label="Scan progress"
        aria-valuetext={[progressValue, "% complete, ", scan.phaseLabel].join("")}
        className="h-1.5 bg-[var(--gray-border)]/75 [&_[data-slot=progress-indicator]]:bg-[var(--accent)]"
      />
      <PhaseRail phase={scan.phase} />
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
          <Cloud className="size-3 shrink-0" />
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
      <div className="flex items-start gap-2 text-sm text-red-300">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span className="line-clamp-2">{scan.error}</span>
      </div>
    )
  }

  if (scan.status === "analyzing") {
    return <ActiveSummary scan={scan} />
  }

  return <CompletedSummary scan={scan} />
}

function CompleteFactCell({
  label,
  children,
  className = "",
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`relative min-w-0 space-y-1 border-[var(--gray-border)]/70 px-2 py-1.5 ${className}`}>
      <p className="font-heading text-[8px] font-semibold uppercase tracking-[0.14em] text-[#8fb9ea]/85 sm:text-[9px]">
        {label}
      </p>
      {children}
    </div>
  )
}

function CompleteFactGrid({ scan }: { scan: RecentScan }) {
  return (
    <div className="relative grid h-full grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)] px-3 py-0 before:absolute before:left-3 before:right-3 before:top-0 before:h-px before:bg-[var(--gray-border)]/70 after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px after:bg-[var(--gray-border)]/70">
      <CompleteFactCell
        label="HTTP"
        className="after:absolute after:bottom-2.5 after:right-0 after:top-2.5 after:w-px after:bg-[var(--gray-border)]/70 after:content-['']"
      >
        {scan.statusCode ? (
          <span className={`inline-flex rounded-md border px-1.5 py-0 font-mono text-[11px] font-semibold tabular-nums sm:text-xs ${
            scan.statusCode < 400
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/35 bg-amber-500/10 text-amber-300"
          }`}>
            {scan.statusCode}
          </span>
        ) : (
          <span className="font-mono text-sm text-[var(--text-dim)]">Unknown</span>
        )}
      </CompleteFactCell>

      <CompleteFactCell
        label="Server"
        className="after:absolute after:bottom-2.5 after:right-0 after:top-2.5 after:w-px after:bg-[var(--gray-border)]/70 after:content-['']"
      >
        <div className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] font-semibold text-[var(--foreground)] sm:gap-2 sm:text-xs">
          <Server className="size-3.5 shrink-0 text-[#c7d8ee]" />
          <span className="truncate">{scan.server ?? "Unknown"}</span>
        </div>
      </CompleteFactCell>

      <CompleteFactCell label="CDN">
        <div className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] font-semibold text-[var(--foreground)] sm:gap-2 sm:text-xs">
          <Cloud className="size-3.5 shrink-0 text-[#c7d8ee]" />
          <span className="truncate">{scan.cdn ?? "None"}</span>
        </div>
      </CompleteFactCell>
    </div>
  )
}

function IncompleteSummaryPanel({ scan }: { scan: RecentScan }) {
  return (
    <div className="flex h-full items-center border-y border-[#294768]/80 px-3 py-1.5">
      <SummaryPanel scan={scan} />
    </div>
  )
}

function RecentScanCardComponent({ scan }: RecentScanCardProps) {
  const { push } = useRouter()
  const shouldReduceMotion = useReducedMotion()
  const [faviconHidden, setFaviconHidden] = useState(false)
  const faviconPreviewSrc = faviconHidden ? null : resolveFaviconPreviewSrc(scan.faviconUrl ?? null)
  const displayTarget = formatTargetForDisplay(scan.target)
  const completeTechCount = scan.techCount ?? 0
  const statusAnimationKey =
    scan.status === "analyzing" ? `analyzing-${scan.phase}` : `${scan.status}-${scan.phaseLabel}`
  const detailsAnimationKey = scan.status === "complete" ? "complete-details" : `${scan.status}-${scan.phase}-details`
  const footerAnimationKey = scan.status === "complete" ? "complete-footer" : `${scan.status}-footer`
  const stateMotion = {
    initial: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 },
    animate: shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
    exit: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 },
    transition: { duration: shouldReduceMotion ? 0 : 0.18, ease: CARD_STATE_EASE },
  }
  const openScanDetails = () => {
    trackStackrayEvent("scan_detail_opened", { source: "dashboard_recent" })
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
      <div className="flex items-start justify-between gap-2 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {faviconPreviewSrc ? (
            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md">
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization */}
              <img
                src={faviconPreviewSrc}
                alt=""
                className="size-7 object-contain"
                onError={() => setFaviconHidden(true)}
              />
            </div>
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md">
              <Globe className="size-5 text-[#8fc4ff]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-mono text-lg font-semibold text-[var(--foreground)]">
              {displayTarget}
            </h4>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#9fb4d2]">
              {hasVisibleIp(scan.ip) ? (
                <span className="flex items-center gap-2">
                  <span>{scan.ip}</span>
                </span>
              ) : null}
              <span className="flex items-center gap-2">
                {hasVisibleIp(scan.ip) ? <span className="text-[#446182]">/</span> : null}
                <LocalTime value={scan.timestamp} preset="shortDateTimeWithZone" />
              </span>
            </div>
          </div>
        </div>
        <div className="shrink-0 pt-0.5">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={statusAnimationKey}
              initial={stateMotion.initial}
              animate={stateMotion.animate}
              exit={stateMotion.exit}
              transition={stateMotion.transition}
            >
              <StatusBadge scan={scan} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={detailsAnimationKey}
          layout
          className="h-[60px] min-w-0 shrink-0 overflow-hidden"
          data-slot="scan-card-details"
          initial={stateMotion.initial}
          animate={stateMotion.animate}
          exit={stateMotion.exit}
          transition={{
            layout: { duration: shouldReduceMotion ? 0 : 0.24, ease: CARD_STATE_EASE },
            ...stateMotion.transition,
          }}
        >
          {scan.status === "complete" ? <CompleteFactGrid scan={scan} /> : <IncompleteSummaryPanel scan={scan} />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={footerAnimationKey}
          layout
          className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-[color-mix(in_srgb,var(--surface-mid)_22%,transparent)] px-3 py-2.5"
          initial={stateMotion.initial}
          animate={stateMotion.animate}
          exit={stateMotion.exit}
          transition={{
            layout: { duration: shouldReduceMotion ? 0 : 0.24, ease: CARD_STATE_EASE },
            ...stateMotion.transition,
          }}
        >
          <span className={`min-w-0 truncate font-mono text-xs font-medium ${
            scan.status === "failed" ? "text-red-300/90" : "text-[#aebdd0]"
          }`}>
            {getFooterSummary(scan, completeTechCount)}
          </span>

          <span className={`flex shrink-0 items-center gap-1 font-heading text-xs font-semibold transition-colors ${
            scan.status === "failed"
              ? "text-red-300 group-hover/card:text-red-200"
              : "text-[#b9d7f7] group-hover/card:text-[var(--foreground)]"
          }`}>
            <span>{getFooterAction(scan)}</span>
            <ChevronRight
              aria-hidden="true"
              data-slot="scan-card-navigation-cue"
              className="size-3.5 shrink-0 text-[var(--accent)] transition-transform duration-200 group-hover/card:translate-x-0.5"
            />
          </span>
        </motion.div>
      </AnimatePresence>
    </Card>
  )
}

export const RecentScanCard = memo(RecentScanCardComponent)
