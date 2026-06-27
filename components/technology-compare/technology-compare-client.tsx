"use client"

import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import {
  Check,
  ChevronRight,
  Clipboard,
  Globe,
  ImageDown,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { type CSSProperties, type Ref, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { toBlob, toPng } from "html-to-image"

import { Button } from "@/components/ui/button"
import {
  imageExportOptions,
  getDomainFaviconSrc,
  resolveExportFaviconSrc,
  resolveExportImageSrc,
  waitForImages,
  waitForNextFrame,
} from "@/components/shared/image-export"
import {
  Combobox,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { resolveFaviconPreviewSrc } from "@/lib/favicon"
import { formatTargetForDisplay } from "@/lib/targets/display-target"
import { POPULAR_TECHNOLOGY_QUICK_STARTS } from "@/lib/technology-comparison/preferences"
import type {
  TechnologyComparisonCombination,
  TechnologyComparisonItem,
  TechnologyComparisonOption,
} from "@/lib/contracts/targets"

interface TechnologyCompareClientProps {
  initialTechnology?: string
  initialTechnologies?: string[]
}

interface TechnologyComparisonResponse {
  technology: string
  technologies: string[]
  items: TechnologyComparisonItem[]
}

interface TechnologyComparisonOptionsResponse {
  items: TechnologyComparisonOption[]
  suggestedCombinations?: TechnologyComparisonCombination[]
}

type ExportAspect = "wide" | "square"
type ExportStyle = "stackray" | "sunset" | "aurora" | "mono"
type ExportStatus = "idle" | "copying" | "copied" | "copied-safe" | "downloading" | "downloaded" | "downloaded-safe" | "error"
type AccentStyle = CSSProperties & {
  "--fallback-accent": string
  "--fallback-accent-soft": string
  "--fallback-accent-glow": string
  "--fallback-accent-border": string
}
type PersistedTechnologyCompareState = {
  technologies: string[]
  selectedExportIds: string[]
  restoreExportSelection: boolean
  aspect: ExportAspect
  exportStyle: ExportStyle
  siteFilter: string
}

type TechnologyCompareUiState = {
  selectedTechnologies: string[]
  selectedExportIds: Set<string>
  aspect: ExportAspect
  exportStyle: ExportStyle
  exportStatus: ExportStatus
  siteFilter: string
  isLoading: boolean
}

type TechnologyCompareUiAction =
  | { type: "select-technologies"; technologies: string[] }
  | {
    type: "restore-persisted-state"
    persistedState: PersistedTechnologyCompareState
    initialSelectedTechnologies: string[]
  }
  | { type: "set-selected-export-ids"; selectedExportIds: Set<string> }
  | { type: "set-site-filter"; siteFilter: string }
  | { type: "set-aspect"; aspect: ExportAspect }
  | { type: "set-export-style"; exportStyle: ExportStyle }
  | { type: "set-export-status"; exportStatus: ExportStatus }
  | { type: "set-is-loading"; isLoading: boolean }

function technologyCompareUiReducer(
  state: TechnologyCompareUiState,
  action: TechnologyCompareUiAction,
): TechnologyCompareUiState {
  switch (action.type) {
    case "select-technologies": {
      const nextTechnologies = normalizeTechnologySelection(action.technologies)

      return {
        ...state,
        selectedTechnologies: nextTechnologies,
        selectedExportIds: new Set(),
        isLoading: nextTechnologies.length > 0,
        exportStatus: "idle",
        siteFilter: "",
      }
    }

    case "restore-persisted-state": {
      const persistedTechnologies = normalizeTechnologySelection(action.persistedState.technologies)
      const shouldRestoreSelection = action.initialSelectedTechnologies.length === 0 && persistedTechnologies.length > 0
      const shouldRestoreSelectionState = shouldRestoreSelection
        || areSameTechnologySelection(persistedTechnologies, action.initialSelectedTechnologies)

      return {
        ...state,
        aspect: action.persistedState.aspect,
        exportStyle: action.persistedState.exportStyle,
        selectedTechnologies: shouldRestoreSelection ? persistedTechnologies : state.selectedTechnologies,
        selectedExportIds: shouldRestoreSelectionState ? new Set(action.persistedState.selectedExportIds) : state.selectedExportIds,
        siteFilter: shouldRestoreSelectionState ? action.persistedState.siteFilter : state.siteFilter,
        isLoading: shouldRestoreSelection ? true : state.isLoading,
      }
    }

    case "set-selected-export-ids":
      return { ...state, selectedExportIds: action.selectedExportIds }

    case "set-site-filter":
      return { ...state, siteFilter: action.siteFilter }

    case "set-aspect":
      return { ...state, aspect: action.aspect }

    case "set-export-style":
      return { ...state, exportStyle: action.exportStyle }

    case "set-export-status":
      return { ...state, exportStatus: action.exportStatus }

    case "set-is-loading":
      return { ...state, isLoading: action.isLoading }
  }
}

const EXPORT_STYLE_OPTIONS: Array<{ value: ExportStyle; label: string }> = [
  { value: "stackray", label: "Stackray" },
  { value: "sunset", label: "Sunset" },
  { value: "aurora", label: "Aurora" },
  { value: "mono", label: "Mono" },
]

const EXPORT_STYLE_FRAME_CLASS: Record<ExportStyle, string> = {
  stackray: "border-amber-100/28 bg-[radial-gradient(circle_at_8%_8%,rgba(251,191,36,0.68),transparent_24%),radial-gradient(circle_at_95%_0%,rgba(245,158,11,0.42),transparent_32%),radial-gradient(circle_at_70%_100%,rgba(217,119,6,0.32),transparent_34%),linear-gradient(135deg,#19150d,#151b22_46%,#0f141b)]",
  sunset: "border-white/24 bg-[radial-gradient(circle_at_8%_8%,rgba(255,232,166,0.8),transparent_18%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.75),transparent_34%),linear-gradient(135deg,#fb7a45,#ec4899_48%,#8b1ed0)]",
  aurora: "border-white/20 bg-[radial-gradient(circle_at_8%_10%,rgba(125,211,252,0.55),transparent_24%),radial-gradient(circle_at_92%_8%,rgba(167,139,250,0.62),transparent_30%),linear-gradient(135deg,#0f766e,#0f172a_52%,#312e81)]",
  mono: "border-white/14 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.16),transparent_25%),linear-gradient(135deg,#111827,#0f141b_58%,#111111)]",
}

const EXPORT_STYLE_DIVIDER_CLASS: Record<ExportStyle, string> = {
  stackray: "border-amber-200/18",
  sunset: "border-white/28",
  aurora: "border-cyan-100/22",
  mono: "border-white/14",
}

const EXPORT_STYLE_CARD_CLASS: Record<ExportStyle, string> = {
  stackray: "bg-[linear-gradient(135deg,rgba(254,240,138,0.72),rgba(251,191,36,0.34)_36%,rgba(45,212,191,0.24)_62%,rgba(217,119,6,0.58))] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_42px_-26px_rgba(251,191,36,0.72)]",
  sunset: "bg-[linear-gradient(135deg,rgba(254,240,138,0.86),rgba(251,146,60,0.72)_28%,rgba(244,114,182,0.7)_58%,rgba(192,38,211,0.8))] shadow-[inset_0_1px_0_rgba(255,255,255,0.26),0_18px_42px_-24px_rgba(190,24,93,0.78)]",
  aurora: "bg-[linear-gradient(135deg,rgba(125,211,252,0.72),rgba(45,212,191,0.5)_32%,rgba(96,165,250,0.5)_62%,rgba(167,139,250,0.7))] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_42px_-24px_rgba(8,145,178,0.7)]",
  mono: "bg-[linear-gradient(135deg,rgba(255,255,255,0.46),rgba(255,255,255,0.13)_44%,rgba(255,255,255,0.34))] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_18px_38px_-26px_rgba(255,255,255,0.26)]",
}

const EXPORT_STYLE_CARD_INNER_CLASS: Record<ExportStyle, string> = {
  stackray: "bg-[#151b22]/94 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
  sunset: "bg-[#111821]/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]",
  aurora: "bg-[#0f172a]/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]",
  mono: "bg-[#151515]/94 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
}

const EXPORT_STYLE_PLACEHOLDER_CLASS: Record<ExportStyle, string> = {
  stackray: "bg-[radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.2),transparent_30%),radial-gradient(circle_at_84%_14%,rgba(217,119,6,0.14),transparent_34%),linear-gradient(135deg,#111820,#171d24)]",
  sunset: "bg-[radial-gradient(circle_at_18%_18%,rgba(251,146,60,0.28),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(217,70,239,0.18),transparent_34%),linear-gradient(135deg,#121922,#211827)]",
  aurora: "bg-[radial-gradient(circle_at_18%_18%,rgba(45,212,191,0.22),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(96,165,250,0.18),transparent_34%),linear-gradient(135deg,#101923,#141a2a)]",
  mono: "bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.1),transparent_30%),linear-gradient(135deg,#111827,#171717)]",
}
const TECHNOLOGY_COMPARE_STORAGE_KEY = "stackray:technology-compare:v1"

function getExportFileName(technology: string) {
  const slug = technology
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "technology"

  return `stackray-${slug}-comparison.png`
}

function normalizeTechnologyValue(value: string) {
  return value.trim().toLowerCase()
}

function normalizeTechnologySelection(values: readonly string[]) {
  const seen = new Set<string>()
  const selected: string[] = []

  for (const value of values) {
    const trimmedValue = value.trim()
    const normalizedValue = normalizeTechnologyValue(trimmedValue)

    if (!trimmedValue || seen.has(normalizedValue)) {
      continue
    }

    seen.add(normalizedValue)
    selected.push(trimmedValue)
  }

  return selected
}

function hashString(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}

function getFallbackAccentStyle(target: string): AccentStyle {
  const hue = hashString(target) % 360

  return {
    "--fallback-accent": `hsl(${hue} 82% 62%)`,
    "--fallback-accent-soft": `hsl(${hue} 82% 62% / 0.28)`,
    "--fallback-accent-glow": `hsl(${hue} 82% 62% / 0.46)`,
    "--fallback-accent-border": `hsl(${hue} 82% 70% / 0.54)`,
  }
}

function getRgbAccentStyle(red: number, green: number, blue: number): AccentStyle {
  return {
    "--fallback-accent": `rgb(${red} ${green} ${blue})`,
    "--fallback-accent-soft": `rgb(${red} ${green} ${blue} / 0.28)`,
    "--fallback-accent-glow": `rgb(${red} ${green} ${blue} / 0.48)`,
    "--fallback-accent-border": `rgb(${red} ${green} ${blue} / 0.58)`,
  }
}

function extractImageAccent(image: HTMLImageElement): AccentStyle | null {
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d", { willReadFrequently: true })

  if (!context) {
    return null
  }

  canvas.width = 32
  canvas.height = 32
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  let redTotal = 0
  let greenTotal = 0
  let blueTotal = 0
  let weightTotal = 0

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] ?? 0

    if (alpha < 80) {
      continue
    }

    const red = data[index] ?? 0
    const green = data[index + 1] ?? 0
    const blue = data[index + 2] ?? 0
    const max = Math.max(red, green, blue)
    const min = Math.min(red, green, blue)
    const saturation = max - min
    const brightness = (red + green + blue) / 3

    if ((brightness > 242 && saturation < 22) || brightness < 20) {
      continue
    }

    const weight = (alpha / 255) * (1 + saturation / 255)
    redTotal += red * weight
    greenTotal += green * weight
    blueTotal += blue * weight
    weightTotal += weight
  }

  if (weightTotal === 0) {
    return null
  }

  return getRgbAccentStyle(
    Math.round(redTotal / weightTotal),
    Math.round(greenTotal / weightTotal),
    Math.round(blueTotal / weightTotal),
  )
}

function useFaviconAccent(src: string | null, target: string) {
  const fallbackAccent = useMemo(() => getFallbackAccentStyle(target), [target])
  const previewSrc = resolveFaviconPreviewSrc(src)
  const proxiedSrc = resolveExportImageSrc(previewSrc)
  const [sampledAccent, setSampledAccent] = useState<{
    src: string
    style: AccentStyle
  } | null>(null)

  useEffect(() => {
    if (!proxiedSrc) {
      return
    }

    let cancelled = false
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.decoding = "async"
    image.onload = () => {
      if (cancelled) {
        return
      }

      try {
        const extractedAccent = extractImageAccent(image)

        if (extractedAccent) {
          setSampledAccent({ src: proxiedSrc, style: extractedAccent })
        }
      } catch {
      }
    }
    image.src = proxiedSrc

    return () => {
      cancelled = true
    }
  }, [proxiedSrc])

  return sampledAccent?.src === proxiedSrc ? sampledAccent.style : fallbackAccent
}

function formatTechnologySet(technologies: readonly string[]) {
  return technologies.length > 0 ? technologies.join(" + ") : ""
}

function areSameTechnologySelection(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function isExportAspect(value: unknown): value is ExportAspect {
  return value === "wide" || value === "square"
}

function isExportStyle(value: unknown): value is ExportStyle {
  return value === "stackray" || value === "sunset" || value === "aurora" || value === "mono"
}

function getTechnologyCompareUrl(technologies: readonly string[]) {
  const params = new URLSearchParams()

  for (const technology of technologies) {
    params.append("technology", technology)
  }

  return technologies.length > 0
    ? `/technology-compare?${params.toString()}`
    : "/technology-compare"
}

function replaceTechnologyCompareUrl(technologies: readonly string[]) {
  window.history.replaceState(null, "", getTechnologyCompareUrl(technologies))
}

function readPersistedTechnologyCompareState(): PersistedTechnologyCompareState | null {
  try {
    const rawValue = window.sessionStorage.getItem(TECHNOLOGY_COMPARE_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue) as Record<string, unknown>
    const technologies = Array.isArray(parsedValue.technologies)
      ? normalizeTechnologySelection(parsedValue.technologies.filter((value): value is string => typeof value === "string"))
      : []
    const selectedExportIds = Array.isArray(parsedValue.selectedExportIds)
      ? parsedValue.selectedExportIds.filter((value): value is string => typeof value === "string")
      : []

    return {
      technologies,
      selectedExportIds,
      restoreExportSelection: typeof parsedValue.restoreExportSelection === "boolean"
        ? parsedValue.restoreExportSelection
        : true,
      aspect: isExportAspect(parsedValue.aspect) ? parsedValue.aspect : "wide",
      exportStyle: isExportStyle(parsedValue.exportStyle) ? parsedValue.exportStyle : "stackray",
      siteFilter: typeof parsedValue.siteFilter === "string" ? parsedValue.siteFilter : "",
    }
  } catch {
    return null
  }
}

function writePersistedTechnologyCompareState(state: PersistedTechnologyCompareState) {
  try {
    if (state.technologies.length === 0) {
      window.sessionStorage.removeItem(TECHNOLOGY_COMPARE_STORAGE_KEY)
      return
    }

    window.sessionStorage.setItem(TECHNOLOGY_COMPARE_STORAGE_KEY, JSON.stringify(state))
  } catch {
  }
}

async function fetchTechnologyComparison(technologies: readonly string[], signal: AbortSignal) {
  const params = new URLSearchParams()

  for (const technology of technologies) {
    params.append("technology", technology)
  }

  const response = await fetch(`/api/v1/targets/technology-comparison?${params.toString()}`, {
    signal,
  })

  if (!response.ok) {
    throw new Error("Comparison request failed.")
  }

  return response.json() as Promise<TechnologyComparisonResponse>
}

async function fetchTechnologyOptions(signal: AbortSignal) {
  const response = await fetch("/api/v1/targets/technology-options", {
    signal,
  })

  if (!response.ok) {
    throw new Error("Technology options request failed.")
  }

  return response.json() as Promise<TechnologyComparisonOptionsResponse>
}

function TechnologyIcon({
  iconUrl,
  technology,
  forceFallback = false,
  exportSafe = false,
  className,
}: {
  iconUrl: string | null
  technology: string
  forceFallback?: boolean
  exportSafe?: boolean
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const imageSrc = exportSafe ? resolveExportImageSrc(iconUrl) : iconUrl
  const safeImageSrc = !failed && !forceFallback ? imageSrc : null

  return (
    <span className={cn(
      "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border",
      safeImageSrc
        ? "border-amber-300/20 bg-white"
        : "border-amber-300/35 bg-amber-300 text-[#18130a]",
      className ?? "size-6",
    )}>
      {safeImageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- technology icons come from Wappalyzer/custom metadata and may be remote SVGs
        <img
          src={safeImageSrc}
          alt=""
          className="size-[70%] object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-mono text-[11px] font-semibold uppercase">
          {technology.trim().slice(0, 1) || "T"}
        </span>
      )}
    </span>
  )
}

function getItemTechnologyMatches(item: TechnologyComparisonItem) {
  return item.matchedTechnologies.length > 0
    ? item.matchedTechnologies
    : [{ name: item.matchedTechnology, iconUrl: item.matchedTechnologyIconUrl }]
}

function TechnologySelector({
  options,
  selected,
  onSelectedChange,
  open,
  onOpenChange,
}: {
  options: TechnologyComparisonOption[]
  selected: string[]
  onSelectedChange: (selected: string[]) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [query, setQuery] = useState("")
  const anchorRef = useComboboxAnchor()
  const isOpen = open ?? uncontrolledOpen
  const setOpenState = useCallback((nextOpen: boolean) => {
    if (open === undefined) {
      setUncontrolledOpen(nextOpen)
    }

    onOpenChange?.(nextOpen)
  }, [onOpenChange, open])
  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeTechnologyValue(query)
    const matchingOptions = normalizedQuery
      ? options.filter((option) => normalizeTechnologyValue(option.name).includes(normalizedQuery))
      : options

    return matchingOptions.slice(0, 80)
  }, [options, query])
  const optionNames = useMemo(() => filteredOptions.map((option) => option.name), [filteredOptions])

  return (
    <Combobox
      multiple
      value={selected}
      onValueChange={(value) => {
        onSelectedChange(normalizeTechnologySelection(value as string[]))
        setQuery("")
      }}
      open={isOpen}
      onOpenChange={(nextOpen) => {
        setOpenState(nextOpen)

        if (!nextOpen) {
          setQuery("")
        }
      }}
      items={optionNames}
    >
      <div ref={anchorRef as Ref<HTMLDivElement>} className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        />
        <ComboboxChipsInput
          aria-label="Technology"
          placeholder="Search technologies..."
          onChange={(event) => {
            setOpenState(true)
            setQuery(event.currentTarget.value)
          }}
          onFocus={(event) => {
            setOpenState(true)
            setQuery(event.currentTarget.value)
          }}
          className="h-10 w-full rounded-md border border-amber-300/70 bg-[#0f141b] pl-9 pr-3 text-base text-white shadow-[0_0_0_3px_rgba(252,211,77,0.15)] outline-none transition-shadow placeholder:text-slate-500 focus:shadow-[0_0_0_3px_rgba(252,211,77,0.25)] sm:h-11 md:text-sm"
        />
      </div>
      <ComboboxContent anchor={anchorRef} className="border-white/10 bg-[#151b22] text-white">
        <ComboboxList data-tech-combobox-list className="max-h-64">
          <ComboboxEmpty>No technologies found.</ComboboxEmpty>
          {filteredOptions.map((option) => (
            <ComboboxItem
              key={option.name}
              value={option.name}
              className="text-slate-200 transition-colors data-highlighted:bg-slate-700/80 data-highlighted:text-amber-200 data-highlighted:**:text-amber-200!"
            >
              <TechnologyIcon
                iconUrl={option.iconUrl}
                technology={option.name}
                className="size-5 rounded-[4px]"
              />
              <span className="min-w-0 flex-1 truncate">{option.name}</span>
              <span className="font-mono text-[11px] text-slate-500">{option.matchCount}</span>
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function Favicon({
  src,
  target,
  forceFallback = false,
  disableDirectFallback = false,
  exportSafe = false,
  className,
  imageClassName,
  iconClassName,
}: {
  src: string | null
  target: string
  forceFallback?: boolean
  disableDirectFallback?: boolean
  exportSafe?: boolean
  className?: string
  imageClassName?: string
  iconClassName?: string
}) {
  const [sourceState, setSourceState] = useState<{
    key: string
    mode: "safe" | "domain" | "direct" | "fallback"
  }>({ key: "", mode: "safe" })
  const previewSrc = resolveFaviconPreviewSrc(src)
  const safeSrc = exportSafe ? resolveExportFaviconSrc(target) : previewSrc
  const domainSrc = exportSafe ? resolveExportImageSrc(getDomainFaviconSrc(target)) : null
  const canUseDirectFallback = !disableDirectFallback && !exportSafe && previewSrc && previewSrc !== safeSrc
  const sourceKey = `${safeSrc ?? ""}|${domainSrc ?? ""}|${previewSrc ?? ""}|${disableDirectFallback ? "safe" : "preview"}`
  const sourceMode = sourceState.key === sourceKey && !(disableDirectFallback && sourceState.mode === "direct")
    ? sourceState.mode
    : "safe"
  const faviconSrc = forceFallback || sourceMode === "fallback"
    ? null
    : sourceMode === "direct"
      ? previewSrc
      : sourceMode === "domain"
        ? domainSrc
      : safeSrc

  if (!faviconSrc) {
    return (
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]", className)}>
        <Globe className={cn("size-4 text-amber-200", iconClassName)} aria-hidden="true" />
      </span>
    )
  }

  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- external favicon previews can come from arbitrary scanned sites */}
      <img
        src={faviconSrc}
        alt=""
        className={cn("size-6 object-contain", imageClassName)}
        onError={() => {
          const nextMode = sourceMode === "safe" && domainSrc && domainSrc !== safeSrc
            ? "domain"
            : canUseDirectFallback && sourceMode !== "direct"
              ? "direct"
              : "fallback"

          setSourceState({
            key: sourceKey,
            mode: nextMode,
          })
        }}
      />
      <span className="sr-only">{target} favicon</span>
    </span>
  )
}

function ScreenshotFallback({
  item,
  target,
  disableDirectFaviconFallback,
}: {
  item: TechnologyComparisonItem
  target: string
  disableDirectFaviconFallback: boolean
}) {
  const accentStyle = useFaviconAccent(item.faviconUrl, target)

  return (
    <div
      style={accentStyle}
      className={cn(
        "relative flex size-full items-center justify-center overflow-hidden",
        "bg-[radial-gradient(circle_at_50%_42%,var(--fallback-accent-glow),transparent_24%),radial-gradient(circle_at_18%_18%,var(--fallback-accent-soft),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.08),transparent_32%),linear-gradient(135deg,#101820,#171d24)]",
      )}
    >
      <div className="absolute inset-3 rounded-md border border-[color:var(--fallback-accent-border)] bg-[#0f141b]/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />
      <div className="absolute inset-8 rounded-2xl border border-white/10 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />
      <div className="absolute size-28 rounded-full bg-[color:var(--fallback-accent-glow)] blur-2xl" />
      <div className="relative flex items-center justify-center rounded-2xl border border-white/12 bg-[#0f141b]/28 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <Favicon
          src={item.faviconUrl}
          target={target}
          disableDirectFallback={disableDirectFaviconFallback}
          exportSafe
          className="size-[72px] rounded-xl border-white/35 shadow-[0_18px_44px_-18px_var(--fallback-accent),0_0_0_1px_rgba(255,255,255,0.12)]"
          imageClassName="size-12"
          iconClassName="size-8"
        />
      </div>
    </div>
  )
}

function ScreenshotPreview({
  item,
  compact = false,
  disableDirectFaviconFallback = false,
  decorative = false,
}: {
  item: TechnologyComparisonItem
  compact?: boolean
  disableDirectFaviconFallback?: boolean
  decorative?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const screenshotSrc = failed ? null : item.screenshotUrl
  const target = formatTargetForDisplay(item.normalizedTarget)

  return (
    <div className={cn(
      "relative overflow-hidden rounded-md border border-white/10 bg-[#10151b]",
      compact ? "aspect-[16/10]" : "aspect-[16/9]",
    )}>
      {screenshotSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- scan screenshots are user-controlled artifacts and may be proxied or redirected */}
          <img
            src={screenshotSrc}
            alt={decorative ? "" : `${target} screenshot`}
            className="size-full object-cover"
            onError={() => setFailed(true)}
          />
        </>
      ) : (
        <ScreenshotFallback
          item={item}
          target={target}
          disableDirectFaviconFallback={disableDirectFaviconFallback}
        />
      )}
    </div>
  )
}

function ExportCard({
  item,
  disableDirectFaviconFallback,
  exportStyle,
}: {
  item: TechnologyComparisonItem
  disableDirectFaviconFallback: boolean
  exportStyle: ExportStyle
}) {
  const target = formatTargetForDisplay(item.normalizedTarget)

  return (
    <Link
      href={`/scans/${encodeURIComponent(item.latestScanId)}`}
      aria-label={`Open latest scan for ${target}`}
      className={cn(
        "block min-w-0 rounded-2xl p-[1px] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70",
        "hover:-translate-y-0.5",
        EXPORT_STYLE_CARD_CLASS[exportStyle],
      )}
    >
      <div className={cn("rounded-[15px] p-2.5", EXPORT_STYLE_CARD_INNER_CLASS[exportStyle])}>
        <ScreenshotPreview item={item} compact disableDirectFaviconFallback={disableDirectFaviconFallback} decorative />
        <div className="mt-3 flex min-w-0 items-start gap-2.5">
          <Favicon
            src={item.faviconUrl}
            target={target}
            disableDirectFallback={disableDirectFaviconFallback}
            exportSafe
          />
          <div className="min-w-0 flex-1">
            <div className="truncate pt-1.5 font-mono text-[15px] font-bold text-white">{target}</div>
          </div>
        </div>
      </div>
    </Link>
  )
}

function ExportSkeletonCard({ index, exportStyle }: { index: number; exportStyle: ExportStyle }) {
  return (
    <article
      className={cn(
        "min-w-0 rounded-2xl p-[1px]",
        EXPORT_STYLE_CARD_CLASS[exportStyle],
        "motion-safe:animate-pulse",
      )}
      style={{ animationDelay: `${index * 110}ms` }}
    >
      <div className={cn("rounded-[15px] p-2.5", EXPORT_STYLE_CARD_INNER_CLASS[exportStyle])}>
        <div className={cn("aspect-[16/10] rounded-md border border-white/10 p-3", EXPORT_STYLE_PLACEHOLDER_CLASS[exportStyle])}>
          <div className="grid grid-cols-[1.35fr_0.75fr] gap-2 opacity-80">
            <span className="h-2 rounded-full bg-white/18" />
            <span className="h-2 rounded-full bg-amber-200/28" />
            <span className="h-2 rounded-full bg-white/10" />
            <span className="h-2 rounded-full bg-white/14" />
          </div>
          <div className="mt-12 h-12 rounded-md border border-white/10 bg-white/[0.035]" />
        </div>
        <div className="mt-3 flex items-center gap-2.5">
          <span className="size-9 rounded-md border border-white/10 bg-white/[0.08]" />
          <div className="min-w-0 flex-1">
            <div className="h-3 w-2/3 rounded-full bg-white/18" />
            <div className="mt-2 h-2.5 w-24 rounded-full bg-amber-200/18" />
          </div>
        </div>
      </div>
    </article>
  )
}

function StateBlock({
  state,
  onRetry,
}: {
  state: "none" | "error"
  onRetry?: () => void
}) {
  const config = {
    none: {
      title: "No matching sites",
      description: "Remove one selected technology or scan more targets with this combination.",
    },
    error: {
      title: "Comparison failed",
      description: "The request did not complete. Retry the search when the API is reachable.",
    },
  }[state]

  return (
    <div className="rounded-lg border border-dashed border-white/12 bg-white/[0.025] p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-amber-200">
        <Search className="size-5" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-base font-semibold tracking-tight text-white">{config.title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{config.description}</p>
      {state === "error" && onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-5 border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
          onClick={onRetry}
        >
          Retry
        </Button>
      ) : null}
    </div>
  )
}

function CommonCombinationsSkeleton() {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-1" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 motion-safe:animate-pulse"
        >
          <span className="flex shrink-0 -space-x-1.5">
            <span className="size-7 rounded-md border border-white/10 bg-white/10 ring-2 ring-[#111820]" />
            <span className="size-7 rounded-md border border-white/10 bg-white/10 ring-2 ring-[#111820]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block h-3 w-3/4 rounded-full bg-white/14" />
            <span className="mt-2 block h-2.5 w-24 rounded-full bg-amber-200/14" />
          </span>
        </div>
      ))}
    </div>
  )
}

function EmptyComparisonWorkspace({
  isLoadingOptions,
  suggestedCombinations,
  onSelectTechnologies,
}: {
  isLoadingOptions: boolean
  suggestedCombinations: TechnologyComparisonCombination[]
  onSelectTechnologies: (technologies: string[]) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-[#151b22]/88 p-3 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.95)] sm:p-4">
      <div className="grid gap-4 lg:min-h-[500px] 2xl:grid-cols-[minmax(330px,0.78fr)_minmax(460px,1.22fr)] 2xl:gap-5">
        <div className="flex min-w-0 flex-col justify-between gap-6 rounded-lg border border-white/10 bg-[#0f141b] p-4 sm:gap-8 sm:p-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
              Select technologies to compare
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
              Choose one or more detected technologies. Matching sites must use every selected item.
            </p>
          </div>

          {suggestedCombinations.length > 0 ? (
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Common combinations
              </div>
              {isLoadingOptions ? (
                <CommonCombinationsSkeleton />
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
                  {suggestedCombinations.map((combination) => {
                    const label = formatTechnologySet(combination.technologies.map((technology) => technology.name))

                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => onSelectTechnologies(combination.technologies.map((technology) => technology.name))}
                        className="group flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-left transition-colors hover:border-amber-300/40 hover:bg-amber-300/10"
                      >
                        <span className="flex shrink-0 -space-x-1.5">
                          {combination.technologies.map((technology) => (
                            <TechnologyIcon
                              key={technology.name}
                              iconUrl={technology.iconUrl}
                              technology={technology.name}
                              className="size-7 rounded-md ring-2 ring-[#111820]"
                            />
                          ))}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium leading-5 text-slate-200 group-hover:text-amber-100">
                            {label}
                          </span>
                          <span className="mt-0.5 block font-mono text-[11px] text-slate-500 group-hover:text-amber-200/75">
                            {combination.matchCount} matching {combination.matchCount === 1 ? "site" : "sites"}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : isLoadingOptions ? (
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Common combinations
              </div>
              <CommonCombinationsSkeleton />
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-white/10 px-3 py-4 text-sm leading-6 text-slate-500">
              Common combinations will appear after Stackray has enough overlapping detections.
            </p>
          )}
        </div>

        <div className="relative hidden min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#0f141b] p-4 sm:p-5 md:block">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.055)_1px,transparent_1px)] bg-[size:34px_34px]" />
          <div className="relative">
            <div className="flex flex-col items-start gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Comparison preview
                </div>
                <h3 className="mt-1 text-base font-semibold text-white">Share-ready output</h3>
              </div>
              <div className="inline-grid grid-cols-2 rounded-md border border-white/10 bg-[#111820] p-1">
                <span className="rounded-[5px] bg-amber-300 px-3 py-1.5 text-xs font-medium text-[#17110b]">Wide</span>
                <span className="px-3 py-1.5 text-xs text-slate-500">Square</span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className={cn(
                    "rounded-lg border border-white/10 bg-[#151b22]/85 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                    index === 1 ? "translate-y-5" : null,
                  )}
                >
                  <div className="aspect-[16/10] rounded-md border border-white/10 bg-[radial-gradient(circle_at_28%_20%,rgba(251,191,36,0.15),transparent_32%),linear-gradient(135deg,#111820,#171d24)] p-3">
                    <div className="grid grid-cols-[1.3fr_0.7fr] gap-2 opacity-80">
                      <span className="h-2 rounded-full bg-white/18" />
                      <span className="h-2 rounded-full bg-amber-200/30" />
                      <span className="h-2 rounded-full bg-white/10" />
                      <span className="h-2 rounded-full bg-white/14" />
                    </div>
                    <div className="mt-9 h-12 rounded-md border border-white/10 bg-white/[0.035]" />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="size-7 rounded-md border border-white/10 bg-white/[0.08]" />
                    <div className="min-w-0 flex-1">
                      <div className="h-2.5 w-2/3 rounded-full bg-white/18" />
                      <div className="mt-2 h-2.5 w-1/2 rounded-full bg-amber-200/18" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-9 rounded-lg border border-dashed border-white/10 bg-white/[0.025] px-4 py-5 text-center">
              <p className="text-sm text-slate-400">
                Select technologies to populate this preview with matching sites, favicons, screenshots, and export controls.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickStartChips({
  isLoadingOptions,
  technologyOptions,
  onSelectTechnologies,
}: {
  isLoadingOptions: boolean
  technologyOptions: TechnologyComparisonOption[]
  onSelectTechnologies: (technologies: string[]) => void
}) {
  const quickPicks = useMemo(() => {
    const optionByNormalizedName = new Map(
      technologyOptions.map((option) => [normalizeTechnologyValue(option.name), option]),
    )
    const preferredOptions = POPULAR_TECHNOLOGY_QUICK_STARTS.flatMap((technology) => {
      const option = optionByNormalizedName.get(normalizeTechnologyValue(technology))

      return option ? [option] : []
    })
    const seen = new Set(preferredOptions.map((option) => normalizeTechnologyValue(option.name)))
    const fallbackOptions = technologyOptions.flatMap((option) => {
      const normalizedName = normalizeTechnologyValue(option.name)

      if (seen.has(normalizedName)) {
        return []
      }

      seen.add(normalizedName)
      return [option]
    })

    return [...preferredOptions, ...fallbackOptions].slice(0, 24)
  }, [technologyOptions])

  if (isLoadingOptions) {
    return (
      <div className="flex flex-wrap gap-2" aria-hidden="true">
        {[
          136, 118, 156, 128,
          176, 108, 148,
          124, 158, 116, 144,
          132, 172, 126,
          152, 112, 164,
          142, 120, 154,
          130, 168,
        ].map((width, index) => (
          <span
            key={`${width}-${index}`}
            className="inline-flex h-[34px] items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 motion-safe:animate-pulse"
            style={{ width }}
          >
            <span className="size-4 rounded-[4px] bg-white/14" />
            <span className="h-2.5 flex-1 rounded-full bg-white/14" />
          </span>
        ))}
      </div>
    )
  }

  if (quickPicks.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-white/10 px-3 py-4 text-sm leading-6 text-slate-500">
        Quick starts will appear after scans detect technologies.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {quickPicks.map((technology) => (
        <button
          key={technology.name}
          type="button"
          onClick={() => onSelectTechnologies([technology.name])}
          className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-200 transition-colors hover:border-amber-300/40 hover:bg-amber-300/10 hover:text-amber-100"
        >
          <TechnologyIcon
            iconUrl={technology.iconUrl}
            technology={technology.name}
            className="size-4 rounded-[4px]"
          />
          {technology.name}
        </button>
      ))}
    </div>
  )
}

function IncludedSitesControls({
  items,
  filteredItems,
  selectedExportIds,
  exportLabel,
  isLoading,
  siteFilter,
  onSiteFilterChange,
  onSelectAll,
  onSelectNone,
  onToggleSelection,
  surface = "panel",
}: {
  items: TechnologyComparisonItem[]
  filteredItems: TechnologyComparisonItem[]
  selectedExportIds: Set<string>
  exportLabel: string
  isLoading: boolean
  siteFilter: string
  onSiteFilterChange: (value: string) => void
  onSelectAll: () => void
  onSelectNone: () => void
  onToggleSelection: (id: string) => void
  surface?: "panel" | "drawer"
}) {
  const isDrawer = surface === "drawer"

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden",
        isDrawer
          ? "flex min-h-0 flex-col px-4 pb-4"
          : "rounded-lg border border-white/10 bg-[#151b22]/90 p-2.5",
      )}
    >
      <div className="flex items-center justify-between gap-3 px-0.5">
        <div>
          {isDrawer ? null : (
            <h2 className="text-sm font-semibold text-white">Included sites</h2>
          )}
          <p className={cn("font-mono text-[11px] text-amber-200/80", isDrawer ? null : "mt-0.5")}>
            {exportLabel}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white"
            onClick={onSelectAll}
            disabled={items.length === 0}
          >
            All
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white"
            onClick={onSelectNone}
            disabled={selectedExportIds.size === 0}
          >
            None
          </Button>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="relative mt-2.5">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            type="text"
            value={siteFilter}
            onChange={(event) => onSiteFilterChange(event.currentTarget.value)}
            placeholder="Filter sites..."
            aria-label="Filter included sites"
            className="h-7 w-full rounded-md border border-white/10 bg-[#0f141b] pl-8 pr-9 text-xs text-white outline-none transition-colors placeholder:text-slate-600 focus:border-amber-300/70 focus:ring-3 focus:ring-amber-300/15"
          />
          {siteFilter ? (
            <button
              type="button"
              className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-slate-500 transition-colors hover:bg-white/6 hover:text-white"
              onClick={() => onSiteFilterChange("")}
              aria-label="Clear site filter"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={cn(
        "mt-2.5 flex flex-col gap-1 overflow-y-auto pr-1",
        isDrawer ? "max-h-[54vh]" : "max-h-[calc(100vh-420px)]",
      )}>
        {isLoading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading sites...
          </div>
        ) : null}
        {filteredItems.map((item) => {
          const target = formatTargetForDisplay(item.normalizedTarget)
          const isIncluded = selectedExportIds.has(item.canonicalTargetId)

          return (
            <div
              key={item.canonicalTargetId}
              className={cn(
                "rounded-md border transition-colors",
                isIncluded
                  ? "border-white/10 bg-white/[0.035] text-slate-300"
                  : "border-white/5 bg-white/[0.02] text-slate-600",
              )}
            >
              <label className="flex min-w-0 cursor-pointer items-center gap-2 px-2 py-1">
                <input
                  type="checkbox"
                  className="size-3.5 rounded border-white/15 bg-[#0f141b] accent-amber-300"
                  checked={isIncluded}
                  onChange={() => onToggleSelection(item.canonicalTargetId)}
                  aria-label={`Include ${target}`}
                />
                <Favicon
                  src={item.faviconUrl}
                  target={target}
                  className="size-5 rounded-[4px]"
                  imageClassName="size-3.5"
                  iconClassName="size-3"
                />
                <span className="min-w-0 truncate font-mono text-xs">{target}</span>
              </label>
            </div>
          )
        })}
        {items.length > 0 && filteredItems.length === 0 ? (
          <p className="rounded-md border border-dashed border-white/10 px-3 py-4 text-sm text-slate-500">
            No included sites match this filter.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function ExportOptionsPopover({
  aspect,
  exportStyle,
  onAspectChange,
  onExportStyleChange,
  triggerClassName,
  triggerLabel = "Options",
}: {
  aspect: ExportAspect
  exportStyle: ExportStyle
  onAspectChange: (aspect: ExportAspect) => void
  onExportStyleChange: (style: ExportStyle) => void
  triggerClassName?: string
  triggerLabel?: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-8 min-w-[104px] border-white/10 bg-white/[0.035] text-slate-200 transition-colors hover:bg-white/[0.07]",
            triggerClassName,
          )}
        >
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64 gap-4 border-white/10 bg-[#151b22] p-3 text-slate-200 shadow-[0_24px_70px_-34px_rgba(0,0,0,0.95)]"
      >
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Canvas</p>
          <div className="grid grid-cols-2 rounded-md border border-white/10 bg-[#0f141b] p-1">
            {(["wide", "square"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={aspect === value}
                className={cn(
                  "rounded-[5px] px-3 py-1.5 text-xs capitalize transition-colors",
                  aspect === value ? "bg-amber-300 text-[#17110b]" : "text-slate-400 hover:text-amber-200",
                )}
                onClick={() => onAspectChange(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/10" />

        <div className="flex flex-col gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Style</p>
          <div role="radiogroup" aria-label="Export style" className="grid gap-1">
            {EXPORT_STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={exportStyle === option.value}
                className={cn(
                  "flex items-center justify-between rounded-md px-2.5 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700/80 hover:text-amber-200",
                  exportStyle === option.value ? "bg-white/[0.06] text-amber-200" : null,
                )}
                onClick={() => onExportStyleChange(option.value)}
              >
                <span>{option.label}</span>
                {exportStyle === option.value ? <Check className="size-3.5" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ExportFrame({
  rootRef,
  aspect,
  exportStyle,
  exportTechnologyLabel,
  exportTechnologies,
  exportItems,
  renderedExportItems,
  isLoading,
  imageSafeExport,
  fixedDesktop = false,
}: {
  rootRef?: Ref<HTMLDivElement>
  aspect: ExportAspect
  exportStyle: ExportStyle
  exportTechnologyLabel: string
  exportTechnologies: Array<{ name: string; iconUrl: string | null }>
  exportItems: TechnologyComparisonItem[]
  renderedExportItems: TechnologyComparisonItem[]
  isLoading: boolean
  imageSafeExport: boolean
  fixedDesktop?: boolean
}) {
  return (
    <div
      ref={rootRef}
      data-technology-export-frame={fixedDesktop ? "desktop-capture" : "preview"}
      className={cn(
        "mx-auto overflow-hidden rounded-2xl border p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
        fixedDesktop ? "rounded-[28px] p-6" : "w-full sm:rounded-[28px] sm:p-6",
        EXPORT_STYLE_FRAME_CLASS[exportStyle],
        aspect === "square"
          ? fixedDesktop ? "w-[760px] aspect-square" : "aspect-square max-w-[760px]"
          : fixedDesktop ? "w-[1040px]" : "max-w-[1040px]",
      )}
    >
      <div className="flex size-full min-w-0 flex-col">
        {exportTechnologyLabel ? (
          <div className={cn(
            "flex items-center gap-3 border-b pb-4",
            fixedDesktop ? "pb-5" : "sm:pb-5",
            EXPORT_STYLE_DIVIDER_CLASS[exportStyle],
          )}>
            <div className="flex shrink-0 -space-x-2">
              {exportTechnologies.slice(0, 3).map((technology) => (
                <TechnologyIcon
                  key={technology.name}
                  iconUrl={technology.iconUrl}
                  technology={technology.name}
                  exportSafe
                  className={cn(
                    "rounded-lg ring-2 ring-[#10151b]",
                    fixedDesktop ? "size-10" : "size-8 sm:size-10",
                  )}
                />
              ))}
            </div>
            <div className="min-w-0">
              <div className={cn(
                "truncate font-semibold tracking-tight text-white",
                fixedDesktop ? "text-2xl" : "text-lg sm:text-2xl",
              )}>
                {exportTechnologyLabel}
              </div>
              {isLoading ? (
                <div className="mt-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-amber-200/75">
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  Preparing matches
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className={cn(
          "grid min-w-0 gap-3 pt-5",
          fixedDesktop
            ? aspect === "square" ? "grid-cols-2" : "grid-cols-3"
            : aspect === "square" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        )}>
          {isLoading && exportItems.length === 0 ? (
            <>
              {(aspect === "square" ? [0, 1, 2, 3] : [0, 1, 2, 3, 4, 5]).map((index) => (
                <ExportSkeletonCard key={index} index={index} exportStyle={exportStyle} />
              ))}
            </>
          ) : null}
          {renderedExportItems.map((item) => (
            <div key={item.canonicalTargetId} className="min-w-0">
              <ExportCard
                item={item}
                disableDirectFaviconFallback={imageSafeExport}
                exportStyle={exportStyle}
              />
            </div>
          ))}
          {!isLoading && exportItems.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-white/12 bg-white/[0.025] px-4 py-5 text-center">
              <p className="text-sm text-slate-400">No sites are currently included in the export.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function MobileComparedSites({
  items,
  exportTechnologyLabel,
  isLoading,
  disableRowNavigation,
  onDismissRowNavigationBlock,
}: {
  items: TechnologyComparisonItem[]
  exportTechnologyLabel: string
  isLoading: boolean
  disableRowNavigation: boolean
  onDismissRowNavigationBlock: () => void
}) {
  return (
    <section className="xl:hidden">
      <div className="mb-2 px-1">
        <div>
          <h2 className="text-sm font-semibold text-white">Compared sites</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {exportTechnologyLabel ? `Real websites using ${exportTechnologyLabel}` : "Included comparison targets"}
          </p>
        </div>
      </div>

      <div className="shadow-[0_24px_70px_-45px_rgba(0,0,0,0.95)]">
        {isLoading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#151b22]/88 py-10 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading sites...
          </div>
        ) : null}
        {items.map((item) => {
          const target = formatTargetForDisplay(item.normalizedTarget)

          return (
            <Link
              key={item.canonicalTargetId}
              href={`/scans/${encodeURIComponent(item.latestScanId)}`}
              aria-disabled={disableRowNavigation}
              tabIndex={disableRowNavigation ? -1 : undefined}
              onPointerDown={(event) => {
                if (disableRowNavigation) {
                  event.preventDefault()
                  event.stopPropagation()
                  onDismissRowNavigationBlock()
                }
              }}
              onClick={(event) => {
                if (disableRowNavigation) {
                  event.preventDefault()
                  event.stopPropagation()
                }
              }}
              className="relative -mt-px grid min-h-[74px] grid-cols-[minmax(112px,42%)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-white/10 bg-[#151b22]/88 p-2 first:mt-0"
            >
              <ScreenshotPreview item={item} compact />
              <div className="flex min-w-0 items-center gap-2">
                <Favicon
                  src={item.faviconUrl}
                  target={target}
                  className="size-8 rounded-md"
                  imageClassName="size-5"
                  iconClassName="size-4"
                />
                <span className="min-w-0 truncate font-mono text-sm font-semibold text-white">
                  {target}
                </span>
              </div>
              <ChevronRight className="size-4 text-slate-400" aria-hidden="true" />
            </Link>
          )
        })}
        {!isLoading && items.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-[#151b22]/88 px-4 py-8 text-center text-sm text-slate-500">
            No sites are currently included.
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function TechnologyCompareClient({
  initialTechnology = "",
  initialTechnologies,
}: TechnologyCompareClientProps) {
  const initialSelectedTechnologies = useMemo(
    () => normalizeTechnologySelection(initialTechnologies ?? [initialTechnology]),
    [initialTechnologies, initialTechnology],
  )
  const [{
    selectedTechnologies,
    selectedExportIds,
    aspect,
    exportStyle,
    exportStatus,
    siteFilter,
    isLoading,
  }, dispatchUi] = useReducer(technologyCompareUiReducer, initialSelectedTechnologies, (selectedTechnologies): TechnologyCompareUiState => ({
    selectedTechnologies,
    selectedExportIds: new Set<string>(),
    aspect: "wide",
    exportStyle: "stackray",
    exportStatus: "idle",
    siteFilter: "",
    isLoading: selectedTechnologies.length > 0,
  }))
  const [technologyOptions, setTechnologyOptions] = useState<TechnologyComparisonOption[]>([])
  const [suggestedCombinations, setSuggestedCombinations] = useState<TechnologyComparisonCombination[]>([])
  const [items, setItems] = useState<TechnologyComparisonItem[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageSafeExport, setImageSafeExport] = useState(false)
  const [isTechnologySelectorOpen, setIsTechnologySelectorOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement | null>(null)
  const restoredStateRef = useRef<PersistedTechnologyCompareState | null>(null)
  const hasInitializedPersistenceRef = useRef(false)
  const isRestoringPersistedStateRef = useRef(false)

  const visibleItems = useMemo(
    () => items.filter((item) => selectedExportIds.has(item.canonicalTargetId)),
    [items, selectedExportIds],
  )

  const exportItems = useMemo(
    () => visibleItems,
    [visibleItems],
  )
  const renderedExportItems = useMemo(
    () => aspect === "square" ? exportItems.slice(0, 4) : exportItems,
    [aspect, exportItems],
  )
  const filteredIncludedSiteItems = useMemo(() => {
    const normalizedFilter = siteFilter.trim().toLowerCase()

    if (!normalizedFilter) {
      return items
    }

    return items.filter((item) => {
      const target = formatTargetForDisplay(item.normalizedTarget).toLowerCase()
      const normalizedTarget = item.normalizedTarget.toLowerCase()
      const title = item.title.toLowerCase()

      return target.includes(normalizedFilter)
        || normalizedTarget.includes(normalizedFilter)
        || title.includes(normalizedFilter)
    })
  }, [items, siteFilter])

  const technologyOptionByNormalizedName = useMemo(
    () => new Map(technologyOptions.map((option) => [normalizeTechnologyValue(option.name), option])),
    [technologyOptions],
  )
  const matchedTechnologyIconByNormalizedName = useMemo(() => {
    const iconByName = new Map<string, string | null>()

    for (const item of exportItems) {
      for (const technology of getItemTechnologyMatches(item)) {
        const normalizedName = normalizeTechnologyValue(technology.name)

        if (!iconByName.has(normalizedName)) {
          iconByName.set(normalizedName, technology.iconUrl)
        }
      }
    }

    return iconByName
  }, [exportItems])
  const exportTechnologies = selectedTechnologies.length > 0
    ? selectedTechnologies.map((technology) => {
      const normalizedTechnology = normalizeTechnologyValue(technology)
      const option = technologyOptionByNormalizedName.get(normalizedTechnology)

      return {
        name: option?.name ?? technology,
        iconUrl: option?.iconUrl ?? matchedTechnologyIconByNormalizedName.get(normalizedTechnology) ?? null,
      }
    })
    : exportItems[0]
      ? getItemTechnologyMatches(exportItems[0])
      : []
  const selectedTechnologyLabel = formatTechnologySet(selectedTechnologies)
  const exportTechnologyLabel = formatTechnologySet(exportTechnologies.map((technology) => technology.name))
  const exportLabel = `${visibleItems.length} included`
  const hasSearched = selectedTechnologies.length > 0
  const setSelectedExportIds = useCallback((selectedExportIds: Set<string>) => {
    dispatchUi({ type: "set-selected-export-ids", selectedExportIds })
  }, [])
  const setSiteFilter = useCallback((siteFilter: string) => {
    dispatchUi({ type: "set-site-filter", siteFilter })
  }, [])
  const setExportStatus = useCallback((exportStatus: ExportStatus) => {
    dispatchUi({ type: "set-export-status", exportStatus })
  }, [])
  const setAspect = useCallback((aspect: ExportAspect) => {
    dispatchUi({ type: "set-aspect", aspect })
  }, [])
  const setExportStyle = useCallback((exportStyle: ExportStyle) => {
    dispatchUi({ type: "set-export-style", exportStyle })
  }, [])
  const setIsLoading = useCallback((isLoading: boolean) => {
    dispatchUi({ type: "set-is-loading", isLoading })
  }, [])

  const updateSelectedTechnologies = useCallback((technologies: string[]) => {
    const nextTechnologies = normalizeTechnologySelection(technologies)
    restoredStateRef.current = null
    isRestoringPersistedStateRef.current = false
    dispatchUi({ type: "select-technologies", technologies: nextTechnologies })
    replaceTechnologyCompareUrl(nextTechnologies)
  }, [])

  useEffect(() => {
    const persistedState = readPersistedTechnologyCompareState()

    if (persistedState) {
      const persistedTechnologies = normalizeTechnologySelection(persistedState.technologies)
      const shouldRestoreSelection = initialSelectedTechnologies.length === 0 && persistedTechnologies.length > 0
      const shouldRestoreSelectionState = shouldRestoreSelection
        || areSameTechnologySelection(persistedTechnologies, initialSelectedTechnologies)

      if (shouldRestoreSelectionState) {
        restoredStateRef.current = {
          ...persistedState,
          technologies: shouldRestoreSelection ? persistedTechnologies : initialSelectedTechnologies,
        }
        isRestoringPersistedStateRef.current = true
      }

      if (shouldRestoreSelection) {
        replaceTechnologyCompareUrl(persistedTechnologies)
      }

      dispatchUi({
        type: "restore-persisted-state",
        persistedState,
        initialSelectedTechnologies,
      })
    }

    hasInitializedPersistenceRef.current = true
  }, [initialSelectedTechnologies])

  useEffect(() => {
    if (!hasInitializedPersistenceRef.current || isRestoringPersistedStateRef.current) {
      return
    }

    writePersistedTechnologyCompareState({
      technologies: selectedTechnologies,
      selectedExportIds: [...selectedExportIds],
      restoreExportSelection: !isLoading && !error,
      aspect,
      exportStyle,
      siteFilter,
    })
  }, [aspect, error, exportStyle, isLoading, selectedExportIds, selectedTechnologies, siteFilter])

  useEffect(() => {
    const controller = new AbortController()

    async function loadOptions() {
      setIsLoadingOptions(true)

      try {
        const response = await fetchTechnologyOptions(controller.signal)
        setTechnologyOptions(response.items)
        setSuggestedCombinations(response.suggestedCombinations ?? [])
      } catch {
        if (!controller.signal.aborted) {
          setTechnologyOptions([])
          setSuggestedCombinations([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingOptions(false)
        }
      }
    }

    void loadOptions()

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (technologyOptions.length === 0 || selectedTechnologies.length === 0) {
      return
    }

    const canonicalTechnologies = selectedTechnologies.map((technology) => (
      technologyOptionByNormalizedName.get(normalizeTechnologyValue(technology))?.name ?? technology
    ))

    if (areSameTechnologySelection(canonicalTechnologies, selectedTechnologies)) {
      return
    }

    updateSelectedTechnologies(canonicalTechnologies)
  }, [selectedTechnologies, technologyOptionByNormalizedName, technologyOptions.length, updateSelectedTechnologies])

  useEffect(() => {
    if (
      exportStatus !== "copied"
      && exportStatus !== "copied-safe"
      && exportStatus !== "downloaded"
      && exportStatus !== "downloaded-safe"
      && exportStatus !== "error"
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => setExportStatus("idle"), 2200)

    return () => window.clearTimeout(timeoutId)
  }, [exportStatus, setExportStatus])

  useEffect(() => {
    if (selectedTechnologies.length === 0) {
      if (isRestoringPersistedStateRef.current) {
        return
      }

      setItems([])
      setIsLoading(false)
      setError(null)
      setSiteFilter("")
      return
    }

    const controller = new AbortController()
    const restoredState = restoredStateRef.current
    const canRestoreStateForSelection = restoredState
      ? areSameTechnologySelection(restoredState.technologies, selectedTechnologies)
      : false

    async function loadComparison() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetchTechnologyComparison(selectedTechnologies, controller.signal)
        const availableIds = new Set(response.items.map((item) => item.canonicalTargetId))
        const restoredExportIds = canRestoreStateForSelection && restoredState?.restoreExportSelection
          ? restoredState.selectedExportIds.filter((id) => availableIds.has(id))
          : null

        setItems(response.items)
        setSelectedExportIds(
          restoredExportIds
            ? new Set(restoredExportIds)
            : new Set(response.items.map((item) => item.canonicalTargetId)),
        )
        setSiteFilter(canRestoreStateForSelection && restoredState ? restoredState.siteFilter : "")
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return
        }

        setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch comparison")
        setItems([])
        setSelectedExportIds(new Set())
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
          isRestoringPersistedStateRef.current = false
        }
      }
    }

    void loadComparison()

    return () => {
      controller.abort()
    }
  }, [selectedTechnologies, setIsLoading, setSelectedExportIds, setSiteFilter])

  const toggleExportSelection = (id: string) => {
    const next = new Set(selectedExportIds)

    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }

    setSelectedExportIds(next)
  }
  const selectAllExportItems = () => setSelectedExportIds(new Set(items.map((item) => item.canonicalTargetId)))
  const clearExportItems = () => setSelectedExportIds(new Set())

  const withImageSafeRetry = async <T,>(createImage: () => Promise<T>): Promise<{ value: T; usedSafeMode: boolean }> => {
    try {
      return {
        value: await createImage(),
        usedSafeMode: false,
      }
    } catch {
      setImageSafeExport(true)
      await waitForNextFrame()
      await waitForNextFrame()

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

  const downloadExport = async () => {
    if (!exportRef.current || exportItems.length === 0) {
      return
    }

    setExportStatus("downloading")

    try {
      const { value: dataUrl, usedSafeMode } = await withImageSafeRetry(async () => {
        if (!exportRef.current) {
          throw new Error("Export frame unavailable.")
        }

        await waitForImages(exportRef.current)

        return toPng(exportRef.current, imageExportOptions)
      })
      const anchor = document.createElement("a")
      anchor.href = dataUrl
      anchor.download = getExportFileName(selectedTechnologyLabel)
      anchor.click()
      setExportStatus(usedSafeMode ? "downloaded-safe" : "downloaded")
    } catch {
      setExportStatus("error")
    }
  }

  const copyExport = async () => {
    if (!exportRef.current || exportItems.length === 0) {
      return
    }

    setExportStatus("copying")

    try {
      if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
        throw new Error("Clipboard image copy is unavailable.")
      }

      const { value: blob, usedSafeMode } = await withImageSafeRetry(async () => {
        if (!exportRef.current) {
          throw new Error("Export frame unavailable.")
        }

        await waitForImages(exportRef.current)

        return toBlob(exportRef.current, imageExportOptions)
      })

      if (!blob) {
        throw new Error("Export image could not be created.")
      }

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ])
      setExportStatus(usedSafeMode ? "copied-safe" : "copied")
    } catch {
      setExportStatus("error")
    }
  }

  const isCopying = exportStatus === "copying"
  const isCopied = exportStatus === "copied" || exportStatus === "copied-safe"
  const retrySearch = () => updateSelectedTechnologies([...selectedTechnologies])

  return (
    <div className="mx-auto max-w-[88rem] overflow-x-hidden text-white">
      <section className="grid min-w-0 items-stretch gap-5 xl:grid-cols-[minmax(360px,420px)_1fr]">
        <div className={cn(
          "flex min-w-0 flex-col gap-4",
          hasSearched ? "self-start" : "h-full",
        )}>
          <div className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#151b22]/96 p-3 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.95)]">
            <TechnologySelector
              options={technologyOptions}
              selected={selectedTechnologies}
              onSelectedChange={updateSelectedTechnologies}
              open={isTechnologySelectorOpen}
              onOpenChange={setIsTechnologySelectorOpen}
            />
            {selectedTechnologies.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {selectedTechnologies.map((name) => {
                  const option = technologyOptions.find((entry) => entry.name === name)
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => updateSelectedTechnologies(selectedTechnologies.filter((value) => value !== name))}
                      className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/35 bg-amber-300/10 px-1.5 py-1 text-xs font-medium text-amber-100 transition-colors hover:border-amber-300/60 hover:bg-amber-300/20"
                      aria-label={`Remove ${name}`}
                    >
                      <TechnologyIcon
                        iconUrl={option?.iconUrl ?? null}
                        technology={name}
                        className="size-3.5 rounded-[3px]"
                      />
                      <span className="truncate">{name}</span>
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => updateSelectedTechnologies([])}
                  className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-400 transition-colors hover:bg-white/6 hover:text-white"
                >
                  <X className="size-3" aria-hidden="true" />
                  Clear all
                </button>
              </div>
            ) : null}
          </div>

          {hasSearched ? (
            <div className="grid grid-cols-4 gap-2 xl:hidden">
              <Drawer>
                <DrawerTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 min-w-0 gap-1 border-white/10 bg-white/[0.035] px-2 text-slate-200 hover:bg-white/[0.07]"
                  >
                    <Globe className="size-3.5" aria-hidden="true" />
                    <span className="shrink-0">Sites</span>
                    <span className="rounded-full bg-amber-300/15 px-1.5 font-mono text-[10px] text-amber-200">
                      {visibleItems.length}
                    </span>
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="border-white/10 bg-[#151b22] text-white">
                  <DrawerHeader className="px-4 pb-2 text-left">
                    <DrawerTitle className="text-base font-semibold text-white">Included sites</DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-400">
                      View, search, and manage the sites included in this comparison.
                    </DrawerDescription>
                  </DrawerHeader>
                  <IncludedSitesControls
                    items={items}
                    filteredItems={filteredIncludedSiteItems}
                    selectedExportIds={selectedExportIds}
                    exportLabel={exportLabel}
                    isLoading={isLoading}
                    siteFilter={siteFilter}
                    onSiteFilterChange={setSiteFilter}
                    onSelectAll={selectAllExportItems}
                    onSelectNone={clearExportItems}
                    onToggleSelection={toggleExportSelection}
                    surface="drawer"
                  />
                </DrawerContent>
              </Drawer>
              <ExportOptionsPopover
                aspect={aspect}
                exportStyle={exportStyle}
                onAspectChange={setAspect}
                onExportStyleChange={setExportStyle}
                triggerClassName="h-9 min-w-0 px-2"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 min-w-0 border-white/10 bg-white/[0.035] px-2 text-slate-200 transition-colors hover:bg-white/[0.07]",
                  isCopied ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/12" : null,
                )}
                onClick={copyExport}
                disabled={exportItems.length === 0 || exportStatus === "copying" || exportStatus === "downloading"}
                aria-label={isCopying ? "Copying export image" : isCopied ? "Copied export image" : "Copy export image"}
              >
                {isCopying ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                {isCopied ? <Check className="size-3.5" aria-hidden="true" /> : null}
                {!isCopying && !isCopied ? <Clipboard className="size-3.5" aria-hidden="true" /> : null}
                <span>Copy</span>
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 min-w-0 bg-amber-300 px-2 text-[#17110b] hover:bg-amber-200"
                onClick={downloadExport}
                disabled={exportItems.length === 0 || exportStatus === "copying" || exportStatus === "downloading"}
                aria-label="Export desktop PNG"
              >
                <ImageDown className="size-3.5" aria-hidden="true" />
                <span>Export</span>
              </Button>
            </div>
          ) : null}

          {hasSearched ? (
            <div className="hidden xl:block">
              <IncludedSitesControls
                items={items}
                filteredItems={filteredIncludedSiteItems}
                selectedExportIds={selectedExportIds}
                exportLabel={exportLabel}
                isLoading={isLoading}
                siteFilter={siteFilter}
                onSiteFilterChange={setSiteFilter}
                onSelectAll={selectAllExportItems}
                onSelectNone={clearExportItems}
                onToggleSelection={toggleExportSelection}
              />
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#151b22]/90 p-3">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Quick start
              </h2>
              <div className="mt-3">
                <QuickStartChips
                  isLoadingOptions={isLoadingOptions}
                  technologyOptions={technologyOptions}
                  onSelectTechnologies={updateSelectedTechnologies}
                />
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          {hasSearched ? (
          <>
          <MobileComparedSites
            items={exportItems}
            exportTechnologyLabel={exportTechnologyLabel}
            isLoading={isLoading}
            disableRowNavigation={isTechnologySelectorOpen}
            onDismissRowNavigationBlock={() => setIsTechnologySelectorOpen(false)}
          />

          <div className="hidden min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#151b22]/88 p-3 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.95)] xl:block">
            <div className="flex justify-end border-b border-white/10 pb-3">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <ExportOptionsPopover
                  aspect={aspect}
                  exportStyle={exportStyle}
                  onAspectChange={setAspect}
                  onExportStyleChange={setExportStyle}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 min-w-[86px] border-white/10 bg-white/[0.035] text-slate-200 transition-colors hover:bg-white/[0.07]",
                    isCopied ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/12" : null,
                  )}
                  onClick={copyExport}
                  disabled={exportItems.length === 0 || exportStatus === "copying" || exportStatus === "downloading"}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={isCopying ? "copying" : isCopied ? "copied" : "copy"}
                      initial={{ opacity: 0, y: 3, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -3, scale: 0.92 }}
                      transition={{ duration: 0.14 }}
                      className="inline-flex items-center gap-1.5"
                    >
                      {isCopying ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                      {isCopied ? <Check className="size-3.5" aria-hidden="true" /> : null}
                      {!isCopying && !isCopied ? <Clipboard className="size-3.5" aria-hidden="true" /> : null}
                      {isCopying ? "Copying" : isCopied ? "Copied" : "Copy"}
                    </motion.span>
                  </AnimatePresence>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 bg-amber-300 text-[#17110b] hover:bg-amber-200"
                  onClick={downloadExport}
                  disabled={exportItems.length === 0 || exportStatus === "copying" || exportStatus === "downloading"}
                >
                  <ImageDown className="size-3.5" aria-hidden="true" />
                  Export PNG
                </Button>
              </div>
            </div>

            <div className="pt-3">
              <ExportFrame
                aspect={aspect}
                exportStyle={exportStyle}
                exportTechnologyLabel={exportTechnologyLabel}
                exportTechnologies={exportTechnologies}
                exportItems={exportItems}
                renderedExportItems={renderedExportItems}
                isLoading={isLoading}
                imageSafeExport={imageSafeExport}
              />
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {error ? (
              <motion.div key="error" layout>
                <StateBlock state="error" onRetry={retrySearch} />
              </motion.div>
            ) : !isLoading && items.length === 0 ? (
              <motion.div key="none" layout>
                <StateBlock state="none" />
              </motion.div>
            ) : null}
          </AnimatePresence>
          </>
          ) : (
            <EmptyComparisonWorkspace
              isLoadingOptions={isLoadingOptions}
              suggestedCombinations={suggestedCombinations}
              onSelectTechnologies={updateSelectedTechnologies}
            />
          )}
        </div>
      </section>
      {hasSearched ? (
        <div
          className="fixed left-[-12000px] top-0 pointer-events-none"
          aria-hidden="true"
        >
          <ExportFrame
            rootRef={exportRef}
            aspect={aspect}
            exportStyle={exportStyle}
            exportTechnologyLabel={exportTechnologyLabel}
            exportTechnologies={exportTechnologies}
            exportItems={exportItems}
            renderedExportItems={renderedExportItems}
            isLoading={isLoading}
            imageSafeExport={imageSafeExport}
            fixedDesktop
          />
        </div>
      ) : null}
    </div>
  )
}
