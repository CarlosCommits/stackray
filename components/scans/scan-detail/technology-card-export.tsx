"use client"

import { Eye, ImageDown, SlidersHorizontal } from "lucide-react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import {
  captureExportPngBlob,
  captureExportPngDataUrl,
  sharePngBlob,
  shouldUseNativePngShare,
  waitForAnimationFrames,
  waitForImages,
  writePngBlobToClipboard,
} from "@/components/shared/image-export"
import { useMobileExportCapture } from "@/components/shared/use-mobile-export-capture"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { trackStackrayEvent } from "@/lib/analytics"
import { cn } from "@/lib/utils"

import type { TechnologyTableRow } from "./technologies"
import {
  TechnologyCardExportActions,
  TechnologyCardExportControls,
  type TechnologyCardExportStatus,
} from "./technology-card-export-controls"
import { getTechnologyCardFileName, TechnologyCardFrame } from "./technology-card-frame"
import { getTechnologyCardFixedFrameDimensions } from "./technology-card-layout"
import type { TechnologyCardStyle } from "./technology-card-options"

type TechnologyCardExportProps = {
  readonly rows: readonly TechnologyTableRow[]
  readonly target?: string
  readonly faviconUrl?: string | null
  readonly screenshotUrl?: string | null
  readonly demoMode?: boolean
}

type MobileTechnologyExportView = "edit" | "preview"

function normalizeSearchTerm(value: string) {
  return value.trim().toLowerCase()
}

const TECHNOLOGY_CARD_PREVIEW_SCALE = 0.78

async function withImageSafeRetry<T>(
  createImage: () => Promise<T>,
  setImageSafeExport: (value: boolean) => void,
): Promise<{ value: T; usedSafeMode: boolean }> {
  try {
    return {
      value: await createImage(),
      usedSafeMode: false,
    }
  } catch {
    setImageSafeExport(true)
    await waitForAnimationFrames(2)

    try {
      return {
        value: await createImage(),
        usedSafeMode: true,
      }
    } finally {
      setImageSafeExport(false)
    }
  }
}

export function TechnologyCardExport({ rows, target, faviconUrl, screenshotUrl, demoMode = false }: TechnologyCardExportProps) {
  const [open, setOpen] = useState(false)
  const [mobileView, setMobileView] = useState<MobileTechnologyExportView>("edit")
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [style, setStyle] = useState<TechnologyCardStyle>("stackray")
  const [status, setStatus] = useState<TechnologyCardExportStatus>("idle")
  const [badgeVisible, setBadgeVisible] = useState(true)
  const [whiteIconBackground, setWhiteIconBackground] = useState(false)
  const [brandVisible, setBrandVisible] = useState(true)
  const [screenshotVisible, setScreenshotVisible] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [imageSafeExport, setImageSafeExport] = useState(false)
  const useRasterSafeCapture = useMobileExportCapture()
  const exportRef = useRef<HTMLDivElement>(null)
  const previewFrameRef = useRef<HTMLDivElement>(null)
  const previewPanelRef = useRef<HTMLDivElement>(null)

  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.has(row.id)), [rows, selectedIds])
  const isExporting = status === "copying" || status === "downloading"
  const effectiveBrandVisible = demoMode || brandVisible
  const visibleScreenshotUrl = screenshotVisible ? screenshotUrl : null
  const previewHasScreenshot = Boolean(visibleScreenshotUrl && selectedRows.length > 0)
  const previewDimensions = getTechnologyCardFixedFrameDimensions(
    selectedRows.length,
    previewHasScreenshot,
    effectiveBrandVisible,
  )
  const [previewScale, setPreviewScale] = useState(TECHNOLOGY_CARD_PREVIEW_SCALE)

  useEffect(() => {
    if (
      status !== "copied" &&
      status !== "copied-safe" &&
      status !== "downloaded" &&
      status !== "downloaded-safe" &&
      status !== "error"
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => setStatus("idle"), 2200)

    return () => window.clearTimeout(timeoutId)
  }, [status])

  useLayoutEffect(() => {
    function updatePreviewScale() {
      const panelWidth = previewPanelRef.current?.clientWidth ?? 0

      if (panelWidth <= 0) {
        setPreviewScale(TECHNOLOGY_CARD_PREVIEW_SCALE)
        return
      }

      const availableWidth = Math.max(0, panelWidth - 24)
      const nextScale = Math.min(TECHNOLOGY_CARD_PREVIEW_SCALE, availableWidth / previewDimensions.width)
      setPreviewScale((current) => (Math.abs(current - nextScale) < 0.001 ? current : nextScale))
    }

    updatePreviewScale()

    if (typeof ResizeObserver === "undefined" || !previewPanelRef.current) {
      window.addEventListener("resize", updatePreviewScale)
      return () => window.removeEventListener("resize", updatePreviewScale)
    }

    const observer = new ResizeObserver(updatePreviewScale)
    observer.observe(previewPanelRef.current)

    return () => observer.disconnect()
  }, [mobileView, open, previewDimensions.width])

  // Portrait frames with a screenshot stay content-height (auto) so technology
  // item cards keep their compact natural size for every count. The computed
  // `previewDimensions.height` is only an upper-bound estimate for those frames,
  // so measure the actually rendered preview frame and size the sizer box to
  // the real height to avoid extra whitespace or clipping. When a real
  // measurement is unavailable (e.g. jsdom), fall back to the computed height.
  const [previewHeight, setPreviewHeight] = useState(previewDimensions.height)
  useLayoutEffect(() => {
    const measured = previewFrameRef.current?.offsetHeight ?? 0
    const height = measured > 0 ? measured : previewDimensions.height
    setPreviewHeight((current) => (current === height ? current : height))
  }, [selectedRows, screenshotVisible, style, badgeVisible, whiteIconBackground, previewDimensions.height])

  const normalizedQuery = normalizeSearchTerm(searchQuery)
  const filteredRows = useMemo(() => {
    if (!normalizedQuery) {
      return rows
    }

    return rows.filter((row) => row.name.toLowerCase().includes(normalizedQuery))
  }, [rows, normalizedQuery])

  const updateIfIdle = <T,>(setter: (value: T) => void, resetStatus = false) => (value: T) => {
    if (isExporting) {
      return
    }

    setter(value)

    if (resetStatus) {
      setStatus("idle")
    }
  }

  const updateSelection = (mode: "add" | "delete") => () => {
    if (isExporting) {
      return
    }

    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds)

      for (const row of filteredRows) {
        nextIds[mode](row.id)
      }

      return nextIds
    })
    setStatus("idle")
  }

  const toggleSelection = (rowId: string) => {
    if (isExporting) {
      return
    }

    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(rowId)) {
        nextIds.delete(rowId)
      } else {
        nextIds.add(rowId)
      }

      return nextIds
    })
    setStatus("idle")
  }

  const selectAllVisible = updateSelection("add")
  const deselectAllVisible = updateSelection("delete")
  const handleStyleChange = updateIfIdle(setStyle, true)
  const handleBadgeChange = updateIfIdle(setBadgeVisible, true)
  const handleWhiteIconBackgroundChange = updateIfIdle(setWhiteIconBackground, true)
  const handleBrandVisibleChange = updateIfIdle(setBrandVisible, true)
  const handleScreenshotVisibleChange = updateIfIdle(setScreenshotVisible, true)
  const handleSearchChange = updateIfIdle(setSearchQuery, false)
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)

    if (nextOpen) {
      setMobileView("edit")
      setStatus("idle")
    }
  }

  const downloadExport = async () => {
    if (!exportRef.current || selectedRows.length === 0) {
      return
    }

    trackStackrayEvent("export_clicked", { surface: "technology_card", action: "download" })
    setStatus("downloading")

    try {
      const useNativeShare = shouldUseNativePngShare()
      const { value: dataUrl, usedSafeMode } = await withImageSafeRetry(async () => {
        if (!exportRef.current) {
          throw new Error("Export frame unavailable.")
        }

        await waitForImages(exportRef.current)
        await waitForAnimationFrames(2)
        return useNativeShare
          ? await captureExportPngBlob(exportRef.current)
          : await captureExportPngDataUrl(exportRef.current)
      }, setImageSafeExport)
      const fileName = getTechnologyCardFileName(target)

      if (useNativeShare) {
        if (!(dataUrl instanceof Blob)) {
          throw new Error("Export image could not be created.")
        }

        await sharePngBlob(dataUrl, fileName)
      } else {
        if (typeof dataUrl !== "string") {
          throw new Error("Export image could not be created.")
        }

        const anchor = document.createElement("a")
        anchor.href = dataUrl
        anchor.download = fileName
        anchor.click()
      }
      setStatus(usedSafeMode ? "downloaded-safe" : "downloaded")
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }

      setStatus("error")
    }
  }

  const copyExport = async () => {
    if (!exportRef.current || selectedRows.length === 0) {
      return
    }

    trackStackrayEvent("export_clicked", { surface: "technology_card", action: "copy" })
    setStatus("copying")

    try {
      let usedSafeMode = false
      const blobPromise = withImageSafeRetry(async () => {
        if (!exportRef.current) {
          throw new Error("Export frame unavailable.")
        }

        await waitForImages(exportRef.current)
        await waitForAnimationFrames(2)
        return captureExportPngBlob(exportRef.current)
      }, setImageSafeExport).then(({ value: blob, usedSafeMode: nextUsedSafeMode }) => {
        if (!blob) {
          throw new Error("Export image could not be created.")
        }

        usedSafeMode = nextUsedSafeMode
        return blob
      })

      await writePngBlobToClipboard(blobPromise)
      setStatus(usedSafeMode ? "copied-safe" : "copied")
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }

      setStatus("error")
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} repositionInputs={false}>
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-auto self-start border-[var(--gray-border)]/40 bg-[var(--surface-mid)]/18 text-xs sm:h-8 sm:self-auto"
        >
          <ImageDown data-icon="inline-start" aria-hidden="true" />
          Export
        </Button>
      </DrawerTrigger>
      <DrawerContent className="z-[90] overflow-hidden border-[var(--gray-border)]/40 bg-[#10161d] text-[var(--foreground)] ring-1 ring-white/8 data-[vaul-drawer-direction=bottom]:!h-[92vh] data-[vaul-drawer-direction=bottom]:!max-h-[92vh] lg:!h-[min(860px,calc(100vh-2rem))] lg:!max-h-[min(860px,calc(100vh-2rem))]">
        <DrawerTitle className="sr-only">Export technology card</DrawerTitle>
        <DrawerDescription className="sr-only">
          Choose technologies and card styling before copying or exporting the technology card.
        </DrawerDescription>

        <div className="px-4 pt-4 lg:hidden">
          <ToggleGroup
            type="single"
            value={mobileView}
            onValueChange={(value) => {
              if (value) {
                setMobileView(value as MobileTechnologyExportView)
              }
            }}
            aria-label="Technology export view"
            className="grid w-full grid-cols-2 rounded-full border border-white/10 bg-black/25 p-0.5 shadow-inner shadow-black/25 ring-1 ring-white/5"
            spacing={1}
          >
            <ToggleGroupItem
              value="edit"
              className="h-8 cursor-pointer rounded-full border-0 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-white/6 hover:text-[var(--foreground)] data-[state=on]:bg-[var(--foreground)] data-[state=on]:text-[var(--background)] data-[state=on]:shadow-sm data-[state=on]:shadow-black/30"
            >
              <SlidersHorizontal data-icon="inline-start" aria-hidden="true" />
              Edit
            </ToggleGroupItem>
            <ToggleGroupItem
              value="preview"
              className="h-8 cursor-pointer rounded-full border-0 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-white/6 hover:text-[var(--foreground)] data-[state=on]:bg-[var(--foreground)] data-[state=on]:text-[var(--background)] data-[state=on]:shadow-sm data-[state=on]:shadow-black/30"
            >
              <Eye data-icon="inline-start" aria-hidden="true" />
              Preview
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pb-4 pt-5 lg:grid lg:max-h-none lg:grid-cols-[minmax(280px,360px)_1fr] lg:gap-3 lg:overflow-hidden lg:p-4">
          <div className={cn("min-h-0 w-full min-w-0", mobileView === "edit" ? "flex" : "hidden", "lg:flex")}>
            <TechnologyCardExportControls
              allRows={rows}
              filteredRows={filteredRows}
              selectedRows={selectedRows}
              selectedIds={selectedIds}
              style={style}
              status={status}
              isExporting={isExporting}
              badgeVisible={badgeVisible}
              whiteIconBackground={whiteIconBackground}
              brandVisible={effectiveBrandVisible}
              brandRequired={demoMode}
              screenshotAvailable={Boolean(screenshotUrl)}
              screenshotVisible={screenshotVisible}
              searchQuery={searchQuery}
              onToggleSelection={toggleSelection}
              onSelectAll={selectAllVisible}
              onDeselectAll={deselectAllVisible}
              onSearchChange={handleSearchChange}
              onStyleChange={handleStyleChange}
              onBadgeChange={handleBadgeChange}
              onWhiteIconBackgroundChange={handleWhiteIconBackgroundChange}
              onBrandVisibleChange={handleBrandVisibleChange}
              onScreenshotVisibleChange={handleScreenshotVisibleChange}
              onCopy={copyExport}
              onDownload={downloadExport}
            />
          </div>

          <div
            ref={previewPanelRef}
            className={cn(
              "min-w-0 overflow-auto rounded-lg border border-[var(--gray-border)]/24 bg-[var(--background)]/32 p-3",
              mobileView === "preview" ? "flex min-h-0 flex-1 justify-center" : "hidden",
              "lg:block"
            )}
          >
            <div
              className="mx-auto"
              data-scan-technology-preview-scale={previewScale}
              style={{
                width: previewDimensions.width * previewScale,
                height: previewHeight * previewScale,
              }}
            >
              <div
                className="origin-top-left"
                style={{
                  transform: `scale(${previewScale})`,
                }}
              >
                <TechnologyCardFrame
                  rootRef={previewFrameRef}
                  rows={selectedRows}
                  style={style}
                  target={target}
                  faviconUrl={faviconUrl}
                  screenshotUrl={visibleScreenshotUrl}
                  badgeVisible={badgeVisible}
                  whiteIconBackground={whiteIconBackground}
                  brandVisible={effectiveBrandVisible}
                  fixedDesktop
                  captureFrame={false}
                  exportSafe
                />
              </div>
            </div>
          </div>

          {mobileView === "preview" ? (
            <div className="lg:hidden">
              <TechnologyCardExportActions
                selectedCount={selectedRows.length}
                status={status}
                isExporting={isExporting}
                onCopy={copyExport}
                onDownload={downloadExport}
              />
            </div>
          ) : null}
        </div>

        <div className="pointer-events-none fixed left-0 top-0 opacity-0" aria-hidden="true">
          <TechnologyCardFrame
            rootRef={exportRef}
            rows={selectedRows}
            style={style}
            target={target}
            faviconUrl={faviconUrl}
            screenshotUrl={visibleScreenshotUrl}
            badgeVisible={badgeVisible}
            whiteIconBackground={whiteIconBackground}
            brandVisible={effectiveBrandVisible}
            fixedDesktop
            exportSafe
            imageSafeMode={imageSafeExport}
            captureFrame
            rasterSafe={useRasterSafeCapture}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
