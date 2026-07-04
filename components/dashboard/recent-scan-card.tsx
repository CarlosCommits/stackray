"use client"

import { memo, useState, type KeyboardEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  Activity,
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Circle,
  Cloud,
  Globe,
  Server,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { DotmSquare4 } from "@/components/ui/dotm-square-4"
import { DotmSquare10 } from "@/components/ui/dotm-square-10"
import { LocalTime } from "@/components/ui/local-time"
import { Progress } from "@/components/ui/progress"
import { DotMatrixBase, rowMajorIndex, type DotAnimationResolver } from "@/lib/dotmatrix-core"
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

const TECHNOLOGY_PREVIEW_MAX_ITEMS = 3
const TECHNOLOGY_PREVIEW_CHARACTER_BUDGET = 36
const TECHNOLOGY_PREVIEW_CHIP_CHARACTER_CAP = 14
const TECHNOLOGY_PREVIEW_EXTRA_CHIP_COST = 2
const TECHNOLOGY_PREVIEW_SHORT_SECOND_ITEM_LIMIT = 10
const CARD_STATE_EASE = [0.22, 1, 0.36, 1] as const
const COMPLETE_CHECKMARK_DOTS = new Set([
  rowMajorIndex(1, 4),
  rowMajorIndex(2, 3),
  rowMajorIndex(3, 0),
  rowMajorIndex(3, 2),
  rowMajorIndex(4, 1),
])

const completeCheckmarkResolver: DotAnimationResolver = ({ index, isActive }) => {
  if (!isActive) {
    return { className: "dmx-inactive" }
  }

  return { style: { opacity: COMPLETE_CHECKMARK_DOTS.has(index) ? 1 : 0.16 } }
}

function hasVisibleIp(ip: string) {
  const value = ip.trim()
  return value.length > 0 && value !== "-" && value !== "—" && value !== "â€”"
}

function getTechnologyPreviewItems(technologies: string[] = []) {
  const previewItems: string[] = []
  let usedCharacters = 0

  for (const technology of technologies) {
    if (previewItems.length >= TECHNOLOGY_PREVIEW_MAX_ITEMS) {
      break
    }

    const technologyCharacterCost = Math.min(technology.length, TECHNOLOGY_PREVIEW_CHIP_CHARACTER_CAP)
    const nextCharacterCount =
      usedCharacters + technologyCharacterCost + (previewItems.length > 0 ? TECHNOLOGY_PREVIEW_EXTRA_CHIP_COST : 0)

    const isShortSecondItem =
      previewItems.length === 1 && technology.length <= TECHNOLOGY_PREVIEW_SHORT_SECOND_ITEM_LIMIT

    if (
      previewItems.length > 0 &&
      nextCharacterCount > TECHNOLOGY_PREVIEW_CHARACTER_BUDGET &&
      !isShortSecondItem
    ) {
      break
    }

    previewItems.push(technology)
    usedCharacters = nextCharacterCount
  }

  return previewItems
}

function getCardClassName(scan: RecentScan) {
  const statusClass = scan.status === "failed" ? "hover:border-red-400/60" : "hover:border-[color-mix(in_srgb,var(--gray-border)_70%,#60a5fa)]"

  return [
    "relative flex min-h-[160px] cursor-pointer flex-col gap-0 overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-[color-mix(in_srgb,var(--surface-dark)_92%,black)] p-0 ring-0 shadow-[0_18px_52px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] transition-[border-color,background-color,box-shadow,transform] [content-visibility:auto] [contain-intrinsic-size:auto_180px]",
    "hover:-translate-y-0.5 hover:bg-[var(--surface-mid)]/35 hover:shadow-[0_18px_52px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.05)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#60a5fa]",
    statusClass,
  ].join(" ")
}

function StatusBadge({ scan }: { scan: RecentScan }) {
  if (scan.status === "complete") {
    return (
      <DotMatrixBase
        ariaLabel="Scan complete"
        size={24}
        dotSize={3}
        color="rgb(52 211 153)"
        pattern="full"
        phase="idle"
        animated={false}
        reducedMotion
        animationResolver={completeCheckmarkResolver}
      />
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
    <div className="space-y-1.5">
      <div className="flex items-center gap-2.5">
        <Progress value={progressValue} className="h-1 bg-[var(--gray-border)]" />
        <span className="w-9 text-right font-mono text-[11px] text-[var(--accent)]">{progressValue}%</span>
      </div>
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
    <div className={`relative min-w-0 space-y-1 border-[var(--gray-border)]/70 px-2 py-1.5 sm:px-2.5 ${className}`}>
      <p className="font-heading text-[8px] font-semibold uppercase tracking-[0.14em] text-[#8fb9ea]/85 sm:text-[9px]">
        {label}
      </p>
      {children}
    </div>
  )
}

function CompleteFactGrid({ scan }: { scan: RecentScan }) {
  return (
    <div className="relative grid grid-cols-[0.72fr_minmax(0,1.18fr)_minmax(0,1fr)] px-3 py-0 before:absolute before:left-3 before:right-3 before:top-0 before:h-px before:bg-[var(--gray-border)]/70 after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px after:bg-[var(--gray-border)]/70 sm:grid-cols-[0.82fr_1.22fr_1.18fr]">
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
    <div className="border-y border-[#294768]/80 px-3 py-2">
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
  const visibleTechs = getTechnologyPreviewItems(scan.technologies)
  const completeTechCount = scan.techCount ?? scan.technologies?.length ?? 0
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
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2.5">
            {faviconPreviewSrc ? (
              <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization */}
                <img
                  src={faviconPreviewSrc}
                  alt=""
                  className="size-6 object-contain"
                  onError={() => setFaviconHidden(true)}
                />
              </div>
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-black/30">
                <Globe className="size-4.5 text-[#8fc4ff]" />
              </div>
            )}
            <h4 className="truncate font-mono text-lg font-semibold text-[var(--foreground)]">
              {displayTarget}
            </h4>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-[2.625rem] font-mono text-[11px] text-[#9fb4d2]">
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
          className="min-w-0 overflow-hidden"
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
          className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2"
          initial={stateMotion.initial}
          animate={stateMotion.animate}
          exit={stateMotion.exit}
          transition={{
            layout: { duration: shouldReduceMotion ? 0 : 0.24, ease: CARD_STATE_EASE },
            ...stateMotion.transition,
          }}
        >
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap">
            {visibleTechs.length > 0 ? (
              <>
                {visibleTechs.map((tech) => (
                  <span
                    key={tech}
                    className="min-w-0 max-w-[7.25rem] truncate rounded-md border border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-[color-mix(in_srgb,var(--surface-dark)_72%,var(--surface-mid))] px-2 py-0 font-mono text-[10px] text-[var(--foreground)]"
                  >
                    {tech}
                  </span>
                ))}
              </>
            ) : (
              <span className="min-w-0 truncate font-mono text-xs text-[var(--text-dim)]">
                {scan.status === "complete"
                  ? "No technologies detected"
                  : scan.status === "analyzing"
                    ? "Analysis in progress..."
                    : "Scan needs attention"}
              </span>
            )}
          </div>

          <span className={`shrink-0 border-l border-[var(--gray-border)]/70 pl-2.5 font-mono text-[11px] ${
            scan.status === "failed" ? "text-red-300" : "text-[#9fb4d2]"
          }`}>
            {scan.status === "complete"
              ? `${completeTechCount} tech`
              : scan.status === "analyzing"
                ? "Live details"
                : "View details"}
          </span>
        </motion.div>
      </AnimatePresence>
    </Card>
  )
}

export const RecentScanCard = memo(RecentScanCardComponent)
