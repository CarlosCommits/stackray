"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import {
  classicTechnologyCardFrameWidth,
  getClassicScreenshotBrowserHeightPx,
  getClassicTechnologyCardFixedFrameDimensions,
  getClassicTechnologyCardLayout,
} from "./technology-card-classic-layout"
import { classicTechnologyCardThemeProfiles } from "./technology-card-classic-options"
import { getTargetLabel, ScreenshotBrowserPreview, TargetFavicon, TechnologyExportIcon } from "./technology-card-frame-assets"
import type { TechnologyCardRendererProps } from "./technology-card-frame-types"

export function TechnologyClassicCardFrame({
  rows,
  style,
  target,
  faviconUrl,
  screenshotUrl,
  fixedDesktop = false,
  previewCompact = false,
  rootRef,
  exportSafe = false,
  imageSafeMode = false,
  badgeVisible = true,
  whiteIconBackground = false,
  brandVisible = true,
  captureFrame = true,
  rasterSafe = false,
}: TechnologyCardRendererProps) {
  const showScreenshot = Boolean(screenshotUrl && rows.length > 0)
  const layout = getClassicTechnologyCardLayout(rows.length, fixedDesktop, showScreenshot)
  const theme = classicTechnologyCardThemeProfiles[style]
  const showDotGrid = rows.length > 0 && rows.length < 6
  const pinFrameHeight = fixedDesktop && !showScreenshot
  const fixedDimensions = pinFrameHeight
    ? getClassicTechnologyCardFixedFrameDimensions(rows.length, false, brandVisible)
    : null
  const browserHeightPx = showScreenshot
    ? getClassicScreenshotBrowserHeightPx(classicTechnologyCardFrameWidth)
    : 0
  const captureDataAttribute = fixedDesktop && captureFrame ? "portrait-capture" : undefined
  const previewDataAttribute = fixedDesktop && !captureFrame ? "portrait-preview" : undefined

  const frameClass = fixedDesktop
    ? "w-[720px] rounded-[28px] p-7"
    : previewCompact
      ? "w-[720px] max-w-none rounded-[28px] p-7"
      : "w-full max-w-[520px] rounded-[28px] p-6"

  return (
    <div
      ref={rootRef}
      data-scan-technology-export-frame={captureDataAttribute}
      data-scan-technology-preview-frame={previewDataAttribute}
      data-export-raster-safe={captureDataAttribute && rasterSafe ? "true" : undefined}
      data-technology-card-design="classic"
      data-technology-card-density={layout.density}
      className={cn(
        "overflow-hidden border text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
        frameClass,
        theme.frameClass,
      )}
      style={fixedDimensions ? { height: fixedDimensions.height } : undefined}
    >
      <div className={cn("relative flex size-full min-w-0 flex-col", showScreenshot ? "gap-5" : "gap-6")}>
        <header
          className={cn(
            "relative flex min-w-0 items-center justify-between gap-5 pb-6",
            layout.headerCompact && "gap-4 pb-4",
          )}
        >
          <span className={cn("absolute inset-x-0 bottom-0 h-px", theme.headerDividerClass)} aria-hidden="true" />
          <div className={cn("flex min-w-0 items-center", layout.headerCompact ? "gap-3" : "gap-4")}>
            <TargetFavicon
              target={target}
              faviconUrl={faviconUrl}
              imageSafeMode={imageSafeMode}
              compact={layout.headerCompact}
              fallbackClassName={theme.fallbackIconClass}
              whiteBackground={whiteIconBackground}
              variant="classic"
            />
            <div className="min-w-0">
              <h3
                className={cn(
                  "-mb-1 truncate pb-1 font-heading font-semibold leading-none tracking-tight",
                  layout.headerTitleSizeClass,
                )}
              >
                {getTargetLabel(target)}
              </h3>
              <p
                data-technology-card-subtitle
                className={cn(
                  "mt-2 pl-0.5 font-mono font-semibold uppercase leading-none tracking-[0.2em] text-white/72",
                  layout.headerCompact ? "text-[13px]" : "text-[17px]",
                )}
              >
                Technology profile
              </p>
            </div>
          </div>
          {badgeVisible ? (
            <Badge
              data-technology-card-count-badge
              className={cn("shrink-0 rounded-xl px-5 py-3.5 text-[15px] leading-none", theme.badgeClass)}
              variant="outline"
            >
              {rows.length} {rows.length === 1 ? "technology" : "technologies"}
            </Badge>
          ) : null}
        </header>

        {showScreenshot ? (
          <ScreenshotBrowserPreview
            screenshotUrl={screenshotUrl}
            target={target}
            height={browserHeightPx}
            shellClassName={theme.browserShellClass}
            chromeClassName={theme.browserChromeClass}
            dotClassName={theme.browserDotClass}
            showChrome
            imageFit="cover"
          />
        ) : null}

        <section className={layout.gridWrapperClass} aria-label="Detected technologies">
          <div className={cn(layout.gridClass, layout.gridColsClass, layout.gridGapClass)}>
            {rows.map((row) => (
              <div
                key={row.id}
                data-technology-card-item
                className={cn(
                  "relative flex min-w-0 flex-col overflow-hidden rounded-xl border",
                  theme.itemCardClass,
                  layout.cardPaddingClass,
                )}
              >
                {showDotGrid ? (
                  <span
                    data-technology-card-dot-grid
                    className={cn(
                      "pointer-events-none absolute right-7 top-1/2 h-20 w-28 -translate-y-1/2 opacity-42 [background-size:10px_10px]",
                      theme.itemDottedClass,
                    )}
                    style={{
                      maskImage: "linear-gradient(135deg, transparent 0%, rgba(0,0,0,0.18) 30%, #000 68%)",
                    }}
                    aria-hidden="true"
                  />
                ) : null}
                <div className={cn("relative z-10 flex flex-1 items-center", layout.cardGapClass)}>
                  <TechnologyExportIcon
                    row={row}
                    exportSafe={exportSafe}
                    imageSafeMode={imageSafeMode}
                    iconScale={layout.iconScale}
                    tileClassName={theme.iconTileClass}
                    fallbackClassName={theme.fallbackIconClass}
                    whiteBackground={whiteIconBackground}
                    decorated
                  />
                  <span
                    data-technology-card-item-separator
                    className={cn("h-12 w-px shrink-0", theme.itemSeparatorClass)}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p
                      data-technology-card-item-title
                      className={cn(
                        "line-clamp-2 font-semibold text-white",
                        layout.titleSizeClass,
                        layout.titleWrapClass,
                      )}
                    >
                      {row.name}
                    </p>
                    <p
                      data-technology-card-item-type
                      className={cn("line-clamp-2", theme.itemTypeClass, layout.typeSizeClass)}
                    >
                      {row.type}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {brandVisible ? (
          <footer className="flex shrink-0 justify-end">
            <span
              data-stackray-export-brand
              className="whitespace-nowrap text-right font-mono text-base font-bold leading-none text-white/70"
            >
              Detected by stackray.app
            </span>
          </footer>
        ) : null}
      </div>
    </div>
  )
}
