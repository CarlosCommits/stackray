"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import type * as React from "react"
import {
  ArrowLeftRight,
  CalendarDays,
  Globe,
  MapPin,
  Server,
  Shield,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { LocalTime } from "@/components/ui/local-time"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { GetScanResponse, ScanPhaseRun } from "@/lib/contracts/scans"
import type { ContentSignalsSection, OverviewSection } from "@/lib/server/scans/scan-detail-view-model"
import { cn } from "@/lib/utils"

import {
  FaviconImage,
  type FaviconPreview,
  MetricValue,
  getHttpStatusColor,
  getHttpStatusSummary,
} from "./shared"
import { ScanProgressPipeline } from "./scan-progress-pipeline"

export function ScanOverviewBand({
  completedAt,
  content,
  overview,
  phases,
  scanStatus,
  submittedAt,
  target,
}: {
  completedAt: string | null
  content: ContentSignalsSection | null
  overview?: OverviewSection | null
  phases: ScanPhaseRun[]
  scanStatus: GetScanResponse["status"]
  submittedAt: string
  target: string
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--gray-border)]/45 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-dark)_92%,transparent)_0%,color-mix(in_srgb,var(--surface-dark)_70%,transparent)_100%)] ring-1 ring-white/5">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_430px] xl:grid-cols-[minmax(0,1fr)_480px]">
        <div className="flex min-w-0 flex-col justify-center px-4 py-5 sm:px-5 lg:pl-7 xl:pl-8">
          <ResponseMetricStrip overview={overview} />
          <div className="relative mt-6 pt-5 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--gray-border)]/35">
            <ScanProgressPipeline
              completedAt={completedAt}
              phases={phases}
              scanStatus={scanStatus}
              submittedAt={submittedAt}
            />
          </div>
        </div>
        <div className="relative flex items-center before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-[var(--gray-border)]/24 lg:-translate-x-3 lg:before:hidden xl:-translate-x-2">
          {content ? <ScreenshotFrame content={content} target={target} /> : <ScreenshotPlaceholder />}
        </div>
      </div>
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
            {status === "failed" || status === "cancelled" ? (
              <Badge
                variant="outline"
                className={cn(
                  "ml-1 shrink-0 px-3 py-1",
                  status === "failed"
                    ? "border-red-400/30 text-red-400"
                    : "border-amber-400/30 text-amber-400",
                )}
              >
                <div
                  className={cn(
                    "mr-1.5 size-2 rounded-full",
                    status === "failed"
                      ? "bg-red-400"
                      : "bg-amber-400",
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
