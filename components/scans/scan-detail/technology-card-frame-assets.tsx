"use client"

import { Globe } from "lucide-react"
import { useState } from "react"

import { resolveExportImageSrc, resolveScannedExportFaviconSrc } from "@/components/shared/image-export"
import { cn } from "@/lib/utils"

import type { TechnologyCardIconScale } from "./technology-card-layout"
import type { TechnologyCardThemeProfile } from "./technology-card-options"
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
  theme,
  height,
}: {
  readonly screenshotUrl?: string | null
  readonly target?: string
  readonly theme: TechnologyCardThemeProfile
  readonly height: number
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
      className={cn("flex min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border", theme.browserShellClass)}
      style={{ height }}
    >
      <div className={cn("flex h-9 items-center gap-3 border-b px-3", theme.browserChromeClass)}>
        <div className="flex shrink-0 items-center gap-2" aria-hidden="true">
          <span className={cn("size-2.5 rounded-full", theme.browserDotClass)} />
          <span className={cn("size-2.5 rounded-full opacity-75", theme.browserDotClass)} />
          <span className={cn("size-2.5 rounded-full opacity-55", theme.browserDotClass)} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- scan screenshots are proxied through the app for html-to-image capture */}
        <img
          src={screenshotSrc}
          data-export-raster-image
          alt={`Homepage screenshot for ${targetLabel}`}
          className="size-full object-cover object-top"
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
}: {
  readonly row: TechnologyTableRow
  readonly exportSafe: boolean
  readonly imageSafeMode?: boolean
  readonly iconScale: TechnologyCardIconScale
  readonly tileClassName?: string
  readonly fallbackClassName?: string
  readonly whiteBackground?: boolean
}) {
  const iconSrc = imageSafeMode ? null : exportSafe ? resolveExportImageSrc(row.iconUrl) : row.iconUrl
  const [failed, setFailed] = useState(false)

  return (
    <span
      data-technology-export-icon
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden border ring-1",
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
  tileClassName,
  fallbackClassName,
  whiteBackground = false,
}: {
  readonly target?: string
  readonly faviconUrl?: string | null
  readonly imageSafeMode?: boolean
  readonly compact?: boolean
  readonly tileClassName?: string
  readonly fallbackClassName?: string
  readonly whiteBackground?: boolean
}) {
  const faviconSrc = imageSafeMode || !target ? null : resolveScannedExportFaviconSrc(faviconUrl ?? null, target)
  const [failed, setFailed] = useState(false)

  return (
    <span
      data-target-export-favicon
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl border ring-1",
        tileClassName,
        compact ? "size-10" : "size-16",
      )}
      style={whiteBackground ? { background: "#ffffff" } : undefined}
    >
      {faviconSrc && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- export frames need plain img sources for html-to-image capture
        <img
          src={faviconSrc}
          data-export-raster-image
          alt=""
          width={compact ? 24 : 44}
          height={compact ? 24 : 44}
          className={cn("object-contain", compact ? "size-6" : "size-11")}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <Globe
          className={cn(whiteBackground ? "text-slate-700" : fallbackClassName, compact ? "size-5" : "size-8")}
          aria-hidden="true"
        />
      )}
    </span>
  )
}
