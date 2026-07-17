"use client"

import { Globe } from "lucide-react"
import { useState } from "react"

import { resolveExportImageSrc, resolveScannedExportFaviconSrc } from "@/components/shared/image-export"
import { cn } from "@/lib/utils"

import type { TechnologyCardIconScale } from "./technology-card-layout"
import type { TechnologyTableRow } from "./technologies"

export function getTargetLabel(target: string | undefined) {
  if (!target) {
    return "Stackray scan"
  }

  return target.replace(/^https?:\/\//i, "").replace(/\/$/u, "")
}

function getInlineScreenshotSrc(screenshotUrl: string | null | undefined) {
  if (!screenshotUrl) {
    return null
  }

  if (screenshotUrl.includes("inline=1")) {
    return resolveExportImageSrc(screenshotUrl)
  }

  const separator = screenshotUrl.includes("?") ? "&" : "?"
  return resolveExportImageSrc(`${screenshotUrl}${separator}inline=1`)
}

export function ScreenshotBrowserPreview({
  screenshotUrl,
  target,
  height,
  shellClassName,
  chromeClassName,
  dotClassName,
  showChrome = false,
  imageFit = "contain",
}: {
  readonly screenshotUrl?: string | null
  readonly target?: string
  readonly height: number
  readonly shellClassName: string
  readonly chromeClassName?: string
  readonly dotClassName?: string
  readonly showChrome?: boolean
  readonly imageFit?: "contain" | "cover"
}) {
  const screenshotSrc = getInlineScreenshotSrc(screenshotUrl)
  const [failed, setFailed] = useState(false)

  if (!screenshotSrc || failed) {
    return null
  }

  const targetLabel = getTargetLabel(target)

  return (
    <div
      data-technology-card-screenshot-browser
      className={cn(
        "min-h-0 shrink-0 overflow-hidden border",
        showChrome ? "flex flex-col rounded-xl" : "rounded-3xl",
        shellClassName,
      )}
      style={{ height }}
    >
      {showChrome ? (
        <div
          data-technology-card-browser-chrome
          className={cn("flex h-9 shrink-0 items-center gap-3 border-b px-3", chromeClassName)}
        >
          <div className="flex shrink-0 items-center gap-2" aria-hidden="true">
            <span className={cn("size-2.5 rounded-full", dotClassName)} />
            <span className={cn("size-2.5 rounded-full opacity-75", dotClassName)} />
            <span className={cn("size-2.5 rounded-full opacity-55", dotClassName)} />
          </div>
        </div>
      ) : null}
      <div className={cn("min-h-0 overflow-hidden", showChrome ? "flex-1 bg-white" : "size-full")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- scan screenshots are proxied through the app for html-to-image capture */}
        <img
          src={screenshotSrc}
          data-export-raster-image
          alt={`Homepage screenshot for ${targetLabel}`}
          className={cn(
            "size-full object-top",
            imageFit === "cover" ? "object-cover" : "bg-black object-contain",
          )}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  )
}

export function TechnologyExportIcon({
  row,
  exportSafe,
  imageSafeMode = false,
  iconScale,
  tileClassName,
  fallbackClassName,
  whiteBackground = false,
  decorated = false,
}: {
  readonly row: TechnologyTableRow
  readonly exportSafe: boolean
  readonly imageSafeMode?: boolean
  readonly iconScale: TechnologyCardIconScale
  readonly tileClassName?: string
  readonly fallbackClassName?: string
  readonly whiteBackground?: boolean
  readonly decorated?: boolean
}) {
  const iconSrc = imageSafeMode ? null : exportSafe ? resolveExportImageSrc(row.iconUrl) : row.iconUrl
  const [failed, setFailed] = useState(false)

  return (
    <span
      data-technology-export-icon
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        (decorated || whiteBackground) && "border ring-1",
        whiteBackground && "border-white/80 ring-black/25",
        tileClassName,
        iconScale.shellClass,
      )}
      style={whiteBackground ? { background: "#ffffff" } : undefined}
    >
      {iconSrc && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- export frames need plain img sources for html-to-image capture
        <img
          src={iconSrc}
          alt=""
          width={iconScale.imageSize}
          height={iconScale.imageSize}
          className={cn("object-contain", iconScale.imageClass)}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <Globe
          className={cn(whiteBackground ? "text-slate-700" : fallbackClassName, iconScale.fallbackClass)}
          aria-hidden="true"
        />
      )}
    </span>
  )
}

export function TargetFavicon({
  target,
  faviconUrl,
  imageSafeMode = false,
  compact = false,
  fallbackClassName,
  whiteBackground = false,
  variant = "dossier",
}: {
  readonly target?: string
  readonly faviconUrl?: string | null
  readonly imageSafeMode?: boolean
  readonly compact?: boolean
  readonly fallbackClassName?: string
  readonly whiteBackground?: boolean
  readonly variant?: "dossier" | "classic"
}) {
  const faviconSrc = imageSafeMode || !target ? null : resolveScannedExportFaviconSrc(faviconUrl ?? null, target)
  const [failed, setFailed] = useState(false)

  return (
    <span
      data-target-export-favicon
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        variant === "classic" ? "rounded-xl" : "rounded-2xl",
        variant === "classic"
          ? compact ? "size-10" : "size-14"
          : compact ? "size-12" : "size-16",
        whiteBackground && "border border-white/80 ring-1 ring-black/25",
      )}
      style={whiteBackground ? { background: "#ffffff" } : undefined}
    >
      {faviconSrc && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- export frames need plain img sources for html-to-image capture
        <img
          src={faviconSrc}
          data-export-raster-image
          alt=""
          width={variant === "classic" ? compact ? 24 : 48 : compact ? 36 : 56}
          height={variant === "classic" ? compact ? 24 : 48 : compact ? 36 : 56}
          className={cn(
            "object-contain",
            variant === "classic"
              ? compact ? "size-6" : "size-12"
              : compact ? "size-9" : "size-14",
          )}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <Globe
          className={cn(
            whiteBackground ? "text-slate-700" : fallbackClassName,
            variant === "classic"
              ? compact ? "size-5" : "size-7"
              : compact ? "size-6" : "size-8",
          )}
          aria-hidden="true"
        />
      )}
    </span>
  )
}
