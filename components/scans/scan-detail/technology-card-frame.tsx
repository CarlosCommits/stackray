"use client"

import { cn } from "@/lib/utils"

import { TechnologyClassicCardFrame } from "./technology-card-classic-frame"
import {
  getScreenshotBrowserHeightPx,
  getTechnologyCardFixedFrameDimensions,
  getTechnologyCardLayout,
  portraitFixedFrameWidth,
} from "./technology-card-layout"
import type { TechnologyTableRow } from "./technologies"
import {
  technologyCardThemeProfiles,
} from "./technology-card-options"
import { getTargetLabel, ScreenshotBrowserPreview, TargetFavicon, TechnologyExportIcon } from "./technology-card-frame-assets"
import type { TechnologyCardFrameProps, TechnologyCardRendererProps } from "./technology-card-frame-types"

type TechnologyGroup = {
  readonly type: string
  readonly rows: readonly TechnologyTableRow[]
}

export function getTechnologyCardFileName(target: string | undefined) {
  const slug = (target ?? "scan")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//u, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "scan"

  return `stackray-${slug}-technology-card.png`
}

function groupTechnologyRows(rows: readonly TechnologyTableRow[]): readonly TechnologyGroup[] {
  const groups = new Map<string, TechnologyTableRow[]>()

  for (const row of rows) {
    const type = row.type.trim() || "Other"
    const group = groups.get(type)

    if (group) {
      group.push(row)
    } else {
      groups.set(type, [row])
    }
  }

  return Array.from(groups, ([type, groupRows]) => ({ type, rows: groupRows }))
}

function getTargetTitleSizeClass(label: string, defaultClass: string) {
  if (label.length > 34) return "text-[36px]"
  if (label.length > 24) return "text-[44px]"
  return defaultClass
}

export function TechnologyCardFrame({ design = "dossier", ...rendererProps }: TechnologyCardFrameProps) {
  if (design === "classic") {
    return <TechnologyClassicCardFrame {...rendererProps} />
  }

  return <TechnologyDossierCardFrame {...rendererProps} />
}

function TechnologyDossierCardFrame({
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
  const layout = getTechnologyCardLayout(rows.length)
  const theme = technologyCardThemeProfiles[style]
  const groups = groupTechnologyRows(rows)
  const targetLabel = getTargetLabel(target)
  const fixedDimensions = getTechnologyCardFixedFrameDimensions(rows.length, showScreenshot, brandVisible)
  const pinProfileHeight = fixedDesktop && layout.mode === "profile"
  const browserHeightPx = showScreenshot ? getScreenshotBrowserHeightPx(portraitFixedFrameWidth) : 0

  const captureDataAttribute = fixedDesktop && captureFrame ? "portrait-capture" : undefined
  const previewDataAttribute = fixedDesktop && !captureFrame ? "portrait-preview" : undefined

  const frameClass = fixedDesktop
    ? "w-[1080px] rounded-[36px] p-12"
    : previewCompact
      ? "w-[1080px] max-w-none rounded-[36px] p-12"
      : "w-full max-w-[520px] rounded-[28px] p-6"

  return (
    <div
      ref={rootRef}
      data-scan-technology-export-frame={captureDataAttribute}
      data-scan-technology-preview-frame={previewDataAttribute}
      data-export-raster-safe={captureDataAttribute && rasterSafe ? "true" : undefined}
      data-technology-card-design="dossier"
      data-technology-card-density={layout.density}
      data-technology-card-mode={layout.mode}
      className={cn(
        "overflow-hidden border text-white",
        frameClass,
        theme.frameClass,
      )}
      style={pinProfileHeight ? { height: fixedDimensions.height } : undefined}
    >
      <div className={cn("relative flex min-w-0 flex-col gap-7", pinProfileHeight && "h-full")}>
        <header className="relative flex min-w-0 items-center justify-between gap-8 pb-7">
          <span
            className={cn("absolute inset-x-0 bottom-0 h-px", theme.headerRuleClass)}
            aria-hidden="true"
          />
          <div data-technology-card-target-lockup className="flex min-w-0 items-start gap-5">
            <TargetFavicon
              target={target}
              faviconUrl={faviconUrl}
              imageSafeMode={imageSafeMode}
              compact={layout.headerCompact}
              fallbackClassName={theme.fallbackIconClass}
              whiteBackground={whiteIconBackground}
            />
            <div className="min-w-0">
              <h3
                className={cn(
                  "line-clamp-2 break-words pb-1 font-heading font-semibold tracking-[-0.035em] [overflow-wrap:anywhere]",
                  getTargetTitleSizeClass(targetLabel, layout.headerTitleSizeClass),
                  "leading-[0.96]",
                )}
              >
                {targetLabel}
              </h3>
              <p
                data-technology-card-subtitle
                className={cn(
                  "mt-3 font-mono text-xl font-medium leading-none tracking-[0.1em]",
                  theme.accentTextClass,
                )}
              >
                Technology profile
              </p>
            </div>
          </div>
          {badgeVisible ? (
            <div
              data-technology-card-count-badge
              className="flex shrink-0 items-end gap-3 text-right"
              aria-label={`${rows.length} ${rows.length === 1 ? "technology" : "technologies"}`}
            >
              <span className={cn("font-mono text-[44px] font-semibold leading-[0.82] tabular-nums", theme.countClass)}>
                {String(rows.length).padStart(2, "0")}
              </span>
              <span className="pb-0.5 font-mono text-sm font-semibold uppercase leading-none tracking-[0.15em] text-white/58">
                {rows.length === 1 ? "technology" : "technologies"}
              </span>
            </div>
          ) : null}
        </header>

        {showScreenshot ? (
          <ScreenshotBrowserPreview
            screenshotUrl={screenshotUrl}
            target={target}
            height={browserHeightPx}
            shellClassName={theme.screenshotClass}
          />
        ) : null}

        <section
          className={cn("flex min-h-0 flex-1 flex-col", showScreenshot ? "justify-start" : "justify-center")}
          aria-label="Technology taxonomy"
        >
          {rows.length > 0 ? (
            <div className="w-full">
              <div className="mb-3">
                <h4 className="font-mono text-lg font-semibold uppercase tracking-[0.14em] text-white/72">
                  Detected stack
                </h4>
              </div>
              <div data-technology-card-groups>
                {groups.map((group) => (
                  <section
                    key={group.type}
                    data-technology-card-group={group.type}
                    className={cn(
                      "grid border-t",
                      fixedDesktop ? layout.groupGridClass : "grid-cols-1",
                      theme.groupRuleClass,
                      layout.groupPaddingClass,
                    )}
                  >
                    <div
                      data-technology-card-group-header
                      className="grid min-w-0 grid-cols-[minmax(0,1fr)_2ch] items-start gap-2 pr-7 pt-2"
                    >
                      <h5 className={cn("min-w-0 break-words font-mono text-base font-semibold uppercase leading-snug tracking-[0.1em] [overflow-wrap:anywhere]", theme.groupLabelClass)}>
                        {group.type}
                      </h5>
                      <span
                        data-technology-card-group-count
                        className="w-[2ch] justify-self-end pt-0.5 text-right font-mono text-sm leading-none tabular-nums text-white/44"
                      >
                        {String(group.rows.length).padStart(2, "0")}
                      </span>
                    </div>
                    <div
                      data-technology-card-group-grid
                      className={cn(
                        "grid min-w-0 border-l pl-7",
                        fixedDesktop ? layout.gridColsClass : "grid-cols-1",
                        theme.groupRuleClass,
                      )}
                    >
                      {group.rows.map((row) => (
                        <div
                          key={row.id}
                          data-technology-card-item
                          className={cn(
                            "flex min-w-0 items-center pr-5",
                            layout.itemGapClass,
                            layout.itemPaddingClass,
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
                          <p
                            data-technology-card-item-title
                            className={cn(
                              "line-clamp-2 min-w-0 break-words font-semibold leading-[1.08] tracking-[-0.015em] text-white [overflow-wrap:anywhere]",
                              layout.titleSizeClass,
                            )}
                          >
                            {row.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex min-h-64 items-center justify-center border-y border-white/10">
              <p className="font-mono text-base uppercase tracking-[0.13em] text-white/42">
                Select technologies to build a profile
              </p>
            </div>
          )}
        </section>

        {brandVisible ? (
          <footer className={cn("flex shrink-0 items-center justify-between border-t pt-5", theme.groupRuleClass)}>
            <span className="font-mono text-sm font-semibold uppercase tracking-[0.14em] text-white/46">
              Technology intelligence
            </span>
            <span
              data-stackray-export-brand
              className="whitespace-nowrap text-right font-mono text-lg font-semibold leading-none text-white/68"
            >
              Detected by stackray.app
            </span>
          </footer>
        ) : null}
      </div>
    </div>
  )
}
