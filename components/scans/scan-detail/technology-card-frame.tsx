"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import {
  getScreenshotBrowserHeightPx,
  getTechnologyCardFixedFrameDimensions,
  getTechnologyCardLayout,
  portraitFixedFrameWidth,
} from "./technology-card-layout"
import type { TechnologyTableRow } from "./technologies"
import {
  technologyCardThemeProfiles,
  type TechnologyCardStyle,
} from "./technology-card-options"
import { getTargetLabel, ScreenshotBrowserPreview, TargetFavicon, TechnologyExportIcon } from "./technology-card-frame-assets"

export function getTechnologyCardFileName(target: string | undefined) {
  const slug = (target ?? "scan")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//u, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "scan"

  return `stackray-${slug}-technology-card.png`
}

function getScreenshotBrowserHeightPxForPortraitFrame() {
  // The browser preview spans the full frame content width, so its height is
  // derived from the screenshot's 16:10 aspect ratio plus the chrome bar. This
  // keeps the screenshot from being cropped regardless of how many technologies
  // are selected, and lets the frame canvas expand to fit it.
  return getScreenshotBrowserHeightPx(portraitFixedFrameWidth)
}

export function TechnologyCardFrame({
  rows,
  style,
  target,
  screenshotUrl,
  fixedDesktop = false,
  previewCompact = false,
  rootRef,
  exportSafe = false,
  imageSafeMode = false,
  badgeVisible = true,
  whiteIconBackground = false,
  captureFrame = true,
}: {
  readonly rows: readonly TechnologyTableRow[]
  readonly style: TechnologyCardStyle
  readonly target?: string
  readonly screenshotUrl?: string | null
  readonly fixedDesktop?: boolean
  readonly previewCompact?: boolean
  readonly rootRef?: React.Ref<HTMLDivElement>
  readonly exportSafe?: boolean
  readonly imageSafeMode?: boolean
  readonly badgeVisible?: boolean
  readonly whiteIconBackground?: boolean
  readonly captureFrame?: boolean
}) {
  const showScreenshot = Boolean(screenshotUrl && rows.length > 0)
  const layout = getTechnologyCardLayout(rows.length, fixedDesktop, showScreenshot)
  const theme = technologyCardThemeProfiles[style]
  const showDotGrid = rows.length > 0 && rows.length < 6
  // Fixed desktop/capture frames use calculated pixel geometry applied inline
  // so the height is always honored. Tailwind cannot see runtime-built
  // arbitrary classes like `h-[1295px]`, so deriving the height from a numeric
  // dimension keeps every technology count consistent instead of only the
  // counts whose height happens to appear as a literal in scanned source.
  //
  // Exception: portrait frames WITH a screenshot stay content-height (auto).
  // Pinning the canvas to the proportional formula stretches every grid row to
  // ~162px, which makes the technology item cards much taller than their
  // natural content height. Leaving the height unset lets the grid rows stay at
  // content height (the compact look) for every count, and the screenshot +
  // header simply push the frame as tall as needed.
  const pinFrameHeight = fixedDesktop && !showScreenshot
  const fixedDimensions = pinFrameHeight
    ? getTechnologyCardFixedFrameDimensions(rows.length, showScreenshot)
    : null
  const browserHeightPx = showScreenshot ? getScreenshotBrowserHeightPxForPortraitFrame() : 0

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
      data-technology-card-density={layout.density}
      className={cn(
        "overflow-hidden rounded-2xl border p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
        frameClass,
        theme.frameClass,
      )}
      style={fixedDimensions ? { height: fixedDimensions.height } : undefined}
    >
      <div className={cn("relative flex size-full min-w-0 flex-col", showScreenshot ? "gap-5" : "gap-6")}>
        <div
          className={cn(
            "relative flex min-w-0 items-center justify-between gap-5 pb-6",
            layout.headerCompact && "gap-4 pb-4",
          )}
        >
          <span
            className={cn("absolute inset-x-0 bottom-0 h-px", theme.headerDividerClass)}
            aria-hidden="true"
          />
          <div className={cn("flex min-w-0 items-center", layout.headerCompact ? "gap-3" : "gap-4")}>
            <TargetFavicon
              target={target}
              imageSafeMode={imageSafeMode}
              compact={layout.headerCompact}
              tileClassName={theme.targetTileClass}
              fallbackClassName={theme.fallbackIconClass}
              whiteBackground={whiteIconBackground}
            />
            <div className="min-w-0">
              <h3
                className={cn(
                  "truncate font-heading font-semibold leading-none tracking-tight",
                  layout.headerTitleSizeClass,
                )}
              >
                {getTargetLabel(target)}
              </h3>
              <p
                className={cn(
                  "mt-2 pl-0.5 font-mono font-semibold uppercase leading-none tracking-[0.2em] text-white/62",
                  layout.headerCompact ? "text-[12px]" : "text-[15px]",
                )}
              >
                Technology profile
              </p>
            </div>
          </div>
          {badgeVisible ? (
            <Badge
              className={cn("shrink-0 rounded-full px-5 py-3.5 text-sm leading-none", theme.badgeClass)}
              variant="outline"
            >
              {rows.length} technologies
            </Badge>
          ) : null}
        </div>

        {showScreenshot ? (
          <ScreenshotBrowserPreview
            screenshotUrl={screenshotUrl}
            target={target}
            theme={theme}
            height={browserHeightPx}
          />
        ) : null}

        <div className={cn(layout.gridWrapperClass)}>
          <div
            className={cn(
              layout.gridClass,
              layout.gridColsClass,
              layout.gridGapClass,
            )}
          >
            {rows.map((row) => (
              <div
                key={row.id}
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
                <div
                  className={cn(
                    "relative z-10 flex flex-1",
                    layout.cardContentAlignClass ?? "items-center",
                    layout.cardGapClass,
                  )}
                >
                  <TechnologyExportIcon
                    row={row}
                    exportSafe={exportSafe}
                    imageSafeMode={imageSafeMode}
                    iconScale={layout.iconScale}
                    tileClassName={theme.iconTileClass}
                    fallbackClassName={theme.fallbackIconClass}
                    whiteBackground={whiteIconBackground}
                  />
                  <span className={cn("h-12 w-px shrink-0", theme.itemSeparatorClass)} aria-hidden="true" />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "line-clamp-2 font-semibold text-white",
                        layout.titleSizeClass,
                        layout.titleWrapClass,
                      )}
                    >
                      {row.name}
                    </p>
                    <p
                      className={cn(
                        "line-clamp-2",
                        theme.itemTypeClass,
                        layout.typeSizeClass,
                      )}
                    >
                      {row.type}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
