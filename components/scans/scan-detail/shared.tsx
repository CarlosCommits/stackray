"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import type * as React from "react"
import { Globe, Info } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { DomainProvenance } from "@/lib/server/scans/scan-detail-view-model"

export const surfacePanelClass =
  "rounded-lg border border-[var(--gray-border)]/45 bg-[var(--surface-dark)]/72 shadow-none ring-1 ring-white/5"

export const compactPanelClass =
  "rounded-lg border border-[var(--gray-border)]/45 bg-[var(--surface-dark)]/62 shadow-none ring-1 ring-white/5"

export const insetPanelClass =
  "overflow-hidden rounded-lg border border-[var(--gray-border)]/24 bg-[var(--surface-mid)]/14 ring-1 ring-white/4"

export const insetRowDividerClass =
  "relative after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[var(--gray-border)]/18 last:after:hidden"

export const insetHeaderDividerClass =
  "relative after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[var(--gray-border)]/20"

const DAY_IN_MS = 1000 * 60 * 60 * 24

const scanDetailDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

export function formatScanDetailDate(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return scanDetailDateFormatter.format(date)
}

export function useClientDaysUntil(value: Date | string | null | undefined) {
  const [daysUntil, setDaysUntil] = useState<number | null>(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        setDaysUntil(null)
        return
      }

      const date = value instanceof Date ? value : new Date(value)

      if (Number.isNaN(date.getTime())) {
        setDaysUntil(null)
        return
      }

      setDaysUntil(Math.round((date.getTime() - Date.now()) / DAY_IN_MS))
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [value])

  return daysUntil
}

// Compact KPI Component
export function CompactKPI({
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

export function getHttpStatusColor(code: number): "emerald" | "amber" | "orange" | "red" {
  if (code >= 200 && code < 300) return "emerald"
  if (code >= 300 && code < 400) return "amber"
  if (code >= 400 && code < 500) return "orange"
  return "red"
}

export function getHttpStatusSummary(code: number): string {
  if (code >= 200 && code < 300) return "Success"
  if (code >= 300 && code < 400) return "Redirect"
  if (code >= 400 && code < 500) return "Client error"
  if (code >= 500) return "Server error"
  return "HTTP response"
}

export function SummaryMetricTile({
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
export function SectionPanel({
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
export function TargetContextBadge({ provenance }: { provenance: DomainProvenance }) {
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

export type FaviconPreview = {
  url: string | null
  path: string | null
}

export function FaviconImage({
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


export function MetricValue({
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

export function InfoPopover({ label, description }: { label: string; description: string }) {
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
export function SubSectionLabel({
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
export function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
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
export function SummaryTile({
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
export function SummaryStrip({
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


export function DetailRow({
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


export function isAbsoluteHttpUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value)
}

export function isLocalImagePath(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("/")
}

// Fingerprints Section

export function CompactCard({
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
