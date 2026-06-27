"use client"

import { Check, Clipboard, Download, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

import type { TechnologyTableRow } from "./technologies"
import {
  technologyCardStyleOptions,
  type TechnologyCardStyle,
} from "./technology-card-options"
import { TechnologyCardTechnologyPicker } from "./technology-card-technology-picker"

export type TechnologyCardExportStatus =
  | "idle"
  | "copying"
  | "copied"
  | "copied-safe"
  | "downloading"
  | "downloaded"
  | "downloaded-safe"
  | "error"

type TechnologyCardExportControlsProps = {
  readonly allRows: readonly TechnologyTableRow[]
  readonly filteredRows: readonly TechnologyTableRow[]
  readonly selectedRows: readonly TechnologyTableRow[]
  readonly selectedIds: ReadonlySet<string>
  readonly style: TechnologyCardStyle
  readonly status: TechnologyCardExportStatus
  readonly isExporting: boolean
  readonly badgeVisible: boolean
  readonly whiteIconBackground: boolean
  readonly screenshotAvailable: boolean
  readonly screenshotVisible: boolean
  readonly searchQuery: string
  readonly onToggleSelection: (rowId: string) => void
  readonly onSelectAll: () => void
  readonly onDeselectAll: () => void
  readonly onSearchChange: (query: string) => void
  readonly onStyleChange: (style: TechnologyCardStyle) => void
  readonly onBadgeChange: (visible: boolean) => void
  readonly onWhiteIconBackgroundChange: (visible: boolean) => void
  readonly onScreenshotVisibleChange: (visible: boolean) => void
  readonly onCopy: () => void
  readonly onDownload: () => void
}

type TechnologyCardExportActionsProps = {
  readonly selectedCount: number
  readonly status: TechnologyCardExportStatus
  readonly isExporting: boolean
  readonly onCopy: () => void
  readonly onDownload: () => void
}

const technologyCardStyleSwatches = {
  stackray: "bg-[linear-gradient(135deg,#08090b_0%,#11110e_48%,#7c4a05_100%)]",
  sunset: "bg-[linear-gradient(135deg,#130909_0%,#e8792e_42%,#a855f7_100%)]",
  aurora: "bg-[linear-gradient(135deg,#061312_0%,#2dd4bf_45%,#a78bfa_100%)]",
  mono: "bg-[linear-gradient(135deg,#07090c_0%,#64748b_52%,#f8fafc_100%)]",
} satisfies Record<TechnologyCardStyle, string>

export function TechnologyCardExportControls({
  allRows,
  filteredRows,
  selectedRows,
  selectedIds,
  style,
  status,
  isExporting,
  badgeVisible,
  whiteIconBackground,
  screenshotAvailable,
  screenshotVisible,
  searchQuery,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  onSearchChange,
  onStyleChange,
  onBadgeChange,
  onWhiteIconBackgroundChange,
  onScreenshotVisibleChange,
  onCopy,
  onDownload,
}: TechnologyCardExportControlsProps) {
  const selectedStyleLabel =
    technologyCardStyleOptions.find((option) => option.value === style)?.label ?? technologyCardStyleOptions[0]?.label

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:h-full lg:min-h-0 lg:gap-3 lg:overflow-hidden">
      <div className="hidden rounded-lg border border-[var(--gray-border)]/30 bg-[var(--surface-mid)]/12 px-3 py-2 lg:block">
        <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
          {selectedRows.length} of {allRows.length} selected
        </p>
      </div>

      <TechnologyCardTechnologyPicker
        rows={filteredRows}
        selectedIds={selectedIds}
        selectedCount={selectedRows.length}
        totalCount={allRows.length}
        isExporting={isExporting}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onToggleSelection={onToggleSelection}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
      />

      <div className="rounded-lg border border-[var(--gray-border)]/30 bg-[var(--surface-mid)]/12 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            Background style
          </p>
          <span className="truncate text-xs font-medium text-[var(--foreground)]">{selectedStyleLabel}</span>
        </div>
        <ToggleGroup
          type="single"
          value={style}
          onValueChange={(value) => {
            if (value) {
              onStyleChange(value as TechnologyCardStyle)
            }
          }}
          disabled={isExporting}
          aria-label="Background style"
          className="grid w-full grid-cols-4 gap-2"
        >
          {technologyCardStyleOptions.map((option) => {
            const selected = style === option.value

            return (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                aria-label={`${option.label} background style`}
                title={option.label}
                disabled={isExporting}
                className={cn(
                  "relative h-8 min-w-0 cursor-pointer overflow-hidden rounded-md border p-0",
                  selected
                    ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]"
                    : "border-[var(--gray-border)]/70 hover:border-[var(--gray-border)]",
                )}
              >
                <span className={cn("absolute inset-0", technologyCardStyleSwatches[option.value])} aria-hidden="true" />
                <span className="absolute inset-0 bg-black/10" aria-hidden="true" />
                {selected ? (
                  <span className="relative z-10 flex size-5 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/40">
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                ) : null}
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </div>

      <div className="rounded-lg border border-[var(--gray-border)]/30 bg-[var(--surface-mid)]/12 p-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Options</p>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--foreground)]">Show technology count</span>
          <Switch
            size="sm"
            checked={badgeVisible}
            onCheckedChange={onBadgeChange}
            disabled={isExporting}
            aria-label="Toggle technology count badge"
          />
        </label>
        <label className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--foreground)]">White icon background</span>
          <Switch
            size="sm"
            checked={whiteIconBackground}
            onCheckedChange={onWhiteIconBackgroundChange}
            disabled={isExporting}
            aria-label="Toggle white icon background"
          />
        </label>
        <label className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--foreground)]">Show website screenshot</span>
          <Switch
            size="sm"
            checked={screenshotAvailable && screenshotVisible}
            onCheckedChange={onScreenshotVisibleChange}
            disabled={isExporting || !screenshotAvailable}
            aria-label="Toggle website screenshot"
          />
        </label>
      </div>

      <TechnologyCardExportActions
        selectedCount={selectedRows.length}
        status={status}
        isExporting={isExporting}
        onCopy={onCopy}
        onDownload={onDownload}
      />
    </div>
  )
}

export function TechnologyCardExportActions({
  selectedCount,
  status,
  isExporting,
  onCopy,
  onDownload,
}: TechnologyCardExportActionsProps) {
  return (
    <div className="shrink-0">
      <div className="grid grid-cols-2 gap-2 pb-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => void onCopy()}
          disabled={selectedCount === 0 || isExporting}
        >
          {status === "copying" ? (
            <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" />
          ) : status === "copied" || status === "copied-safe" ? (
            <Check data-icon="inline-start" aria-hidden="true" />
          ) : (
            <Clipboard data-icon="inline-start" aria-hidden="true" />
          )}
          {status === "copying" ? "Copying" : status === "copied" || status === "copied-safe" ? "Copied" : "Copy"}
        </Button>
        <Button type="button" onClick={() => void onDownload()} disabled={selectedCount === 0 || isExporting}>
          {status === "downloading" ? (
            <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" />
          ) : (
            <Download data-icon="inline-start" aria-hidden="true" />
          )}
          Export PNG
        </Button>
      </div>
      {status === "downloaded" || status === "downloaded-safe" ? (
        <p className="text-xs text-emerald-300">PNG export started.</p>
      ) : null}
      {status === "copied" || status === "copied-safe" ? (
        <p className="text-xs text-emerald-300">PNG copied to clipboard.</p>
      ) : null}
      {status === "error" ? (
        <p className="text-xs text-red-300">Could not export this card. Try again with fewer technologies.</p>
      ) : null}
    </div>
  )
}
