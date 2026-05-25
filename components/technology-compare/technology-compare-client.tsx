"use client"

import { AnimatePresence, motion } from "motion/react"
import {
  ArrowDownToLine,
  Check,
  Clipboard,
  Globe,
  ImageDown,
  Loader2,
  Search,
  X,
} from "lucide-react"
import { type Ref, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toBlob, toPng } from "html-to-image"

import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import { cn } from "@/lib/utils"
import { resolveFaviconPreviewSrc } from "@/lib/favicon"
import { formatTargetForDisplay } from "@/lib/targets/display-target"
import type { TechnologyComparisonItem, TechnologyComparisonOption } from "@/lib/contracts/targets"

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
}

type ExportAspect = "wide" | "square"
type ExportStatus = "idle" | "copying" | "copied" | "copied-safe" | "downloading" | "downloaded" | "downloaded-safe" | "error"

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

function formatTechnologySet(technologies: readonly string[]) {
  return technologies.length > 0 ? technologies.join(" + ") : ""
}

function areSameTechnologySelection(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
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

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

function resolveExportImageSrc(src: string | null): string | null {
  if (!src) {
    return null
  }

  if (src.startsWith("/") || src.startsWith("data:")) {
    return src
  }

  if (/^https?:\/\//i.test(src)) {
    return `/api/v1/image-proxy?${new URLSearchParams({ url: src }).toString()}`
  }

  return null
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"))

  await Promise.all(images.map((image) => {
    if (image.complete && image.naturalWidth > 0) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      let timeoutId: number | null = null
      const finish = () => {
        image.removeEventListener("load", finish)
        image.removeEventListener("error", finish)

        if (timeoutId !== null) {
          window.clearTimeout(timeoutId)
        }

        resolve()
      }

      image.addEventListener("load", finish, { once: true })
      image.addEventListener("error", finish, { once: true })
      timeoutId = window.setTimeout(finish, 1500)
    })
  }))
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
      "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-amber-300/20",
      safeImageSrc ? "bg-white" : "bg-amber-300/10 text-amber-100",
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

function TechnologyMark({
  technology,
  iconUrl,
  forceFallback = false,
  exportSafe = false,
}: {
  technology: string
  iconUrl: string | null
  forceFallback?: boolean
  exportSafe?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/25 bg-amber-300/10 px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-amber-200">
      <TechnologyIcon
        iconUrl={iconUrl}
        technology={technology}
        forceFallback={forceFallback}
        exportSafe={exportSafe}
        className="size-4 rounded-[4px]"
      />
      {technology}
    </span>
  )
}

function TechnologyMarks({
  technologies,
  forceFallback = false,
  exportSafe = false,
}: {
  technologies: Array<{ name: string; iconUrl: string | null }>
  forceFallback?: boolean
  exportSafe?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {technologies.map((technology) => (
        <TechnologyMark
          key={technology.name}
          technology={technology.name}
          iconUrl={technology.iconUrl}
          forceFallback={forceFallback}
          exportSafe={exportSafe}
        />
      ))}
    </div>
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
}: {
  options: TechnologyComparisonOption[]
  selected: string[]
  onSelectedChange: (selected: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const anchorRef = useComboboxAnchor()
  const optionByName = useMemo(
    () => new Map(options.map((option) => [option.name, option])),
    [options],
  )
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
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)

        if (!nextOpen) {
          setQuery("")
        }
      }}
      items={optionNames}
    >
      <ComboboxChips
        ref={anchorRef as Ref<HTMLDivElement>}
        className="min-h-10 border-white/10 bg-[#0f141b] text-white focus-within:border-amber-300/70 focus-within:ring-3 focus-within:ring-amber-300/15"
      >
        <ComboboxValue placeholder="Search and add technologies...">
          {(values) => {
            const selectedValues = values as string[]

            return (
              <>
                {selectedValues.map((value) => {
                  const option = optionByName.get(value)

                  return (
                    <ComboboxChip
                      key={value}
                      className="border border-white/12 bg-white/[0.07] text-slate-100 transition-colors hover:bg-white/[0.1]"
                    >
                      <TechnologyIcon
                        iconUrl={option?.iconUrl ?? null}
                        technology={value}
                        className="size-4 rounded-[4px]"
                      />
                      {value}
                    </ComboboxChip>
                  )
                })}
                <ComboboxChipsInput
                  aria-label="Technology"
                  className="text-sm text-white placeholder:text-slate-600"
                  onChange={(event) => {
                    setOpen(true)
                    setQuery(event.currentTarget.value)
                  }}
                  onFocus={(event) => {
                    setOpen(true)
                    setQuery(event.currentTarget.value)
                  }}
                  placeholder={selectedValues.length === 0 ? "Search technology..." : "Add another..."}
                />
              </>
            )
          }}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchorRef} className="border-white/10 bg-[#151b22] text-white">
        <ComboboxList className="max-h-64">
          <ComboboxEmpty>No technologies found.</ComboboxEmpty>
          {filteredOptions.map((option) => (
            <ComboboxItem
              key={option.name}
              value={option.name}
              className="text-slate-200 transition-colors data-highlighted:bg-slate-700/80 data-highlighted:text-amber-200 data-highlighted:[&_span]:!text-amber-200"
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
  exportSafe = false,
  className,
  imageClassName,
  iconClassName,
}: {
  src: string | null
  target: string
  forceFallback?: boolean
  exportSafe?: boolean
  className?: string
  imageClassName?: string
  iconClassName?: string
}) {
  const [failed, setFailed] = useState(false)
  const previewSrc = resolveFaviconPreviewSrc(src)
  const faviconSrc = failed || forceFallback ? null : exportSafe ? resolveExportImageSrc(previewSrc) : previewSrc

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
        onError={() => setFailed(true)}
      />
      <span className="sr-only">{target} favicon</span>
    </span>
  )
}

function ScreenshotPreview({
  item,
  compact = false,
  forcePlaceholder = false,
}: {
  item: TechnologyComparisonItem
  compact?: boolean
  forcePlaceholder?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const screenshotSrc = failed || forcePlaceholder ? null : item.screenshotUrl
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
            alt={`${target} screenshot`}
            className="size-full object-cover"
            onError={() => setFailed(true)}
          />
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#10151b]/85 to-transparent" />
        </>
      ) : (
        <div className="flex size-full flex-col justify-between bg-[radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.13),transparent_30%),linear-gradient(135deg,#111820,#171d24)] p-3">
          <div className="grid grid-cols-[1.4fr_0.8fr] gap-2 opacity-70">
            <span className="h-2 rounded-full bg-white/18" />
            <span className="h-2 rounded-full bg-amber-200/30" />
            <span className="h-2 rounded-full bg-white/10" />
            <span className="h-2 rounded-full bg-white/14" />
          </div>
          <div className="space-y-1.5">
            <div className="h-12 rounded-md border border-white/10 bg-white/[0.035]" />
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
              Screenshot unavailable
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function ExportCard({
  item,
  forcePlaceholders,
}: {
  item: TechnologyComparisonItem
  forcePlaceholders: boolean
}) {
  const target = formatTargetForDisplay(item.normalizedTarget)
  const matchedTechnologies = getItemTechnologyMatches(item)

  return (
    <article className="min-w-0 rounded-lg border border-white/10 bg-[#151b22] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <ScreenshotPreview item={item} compact forcePlaceholder={forcePlaceholders} />
      <div className="mt-2.5 flex min-w-0 items-start gap-2">
        <Favicon src={item.faviconUrl} target={target} forceFallback={forcePlaceholders} exportSafe />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-[12px] font-semibold text-white">{target}</div>
          <div className="mt-1 flex items-center gap-1.5">
            <TechnologyMarks
              technologies={matchedTechnologies}
              forceFallback={forcePlaceholders}
              exportSafe
            />
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
  state: "empty" | "loading" | "none" | "error"
  onRetry?: () => void
}) {
  const config = {
    empty: {
      title: "Select technologies",
      description: "Add one or more technologies to find sites that use every selected item.",
    },
    loading: {
      title: "Building comparison",
      description: "Stackray is pulling the latest matching site snapshots.",
    },
    none: {
      title: "No matching sites",
      description: "Remove one selected technology or scan more targets with this combination.",
    },
    error: {
      title: "Comparison failed",
      description: "The request did not complete. Retry the search when the API is reachable.",
    },
  }[state]

  if (state === "empty") {
    return (
      <div className="min-h-[290px] overflow-hidden rounded-lg border border-white/10 bg-[#151b22]/82 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="grid h-full min-h-[250px] gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)] lg:items-center">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-md border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-amber-200">
              <Search className="size-3.5" aria-hidden="true" />
              Ready to compare
            </div>
            <h2 className="mt-4 max-w-xl text-2xl font-semibold tracking-tight text-white">
              Select technologies to build a comparison.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
              Add one or more technologies from the selector. Stackray will only show sites that match every selected technology, then format the visible set for export.
            </p>
          </div>

          <div className="relative min-h-[250px] overflow-hidden rounded-lg border border-white/10 bg-[#10151b] p-4">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.055)_1px,transparent_1px)] bg-[size:34px_34px]" />
            <div className="relative grid h-full min-h-[218px] grid-cols-3 items-center gap-3">
              {["app.example.test", "payments.example.test", "fallback-target.example.test"].map((site, index) => (
                <div
                  key={site}
                  className={cn(
                    "rounded-md border border-white/10 bg-white/[0.045] p-3 shadow-[0_16px_34px_-28px_rgba(0,0,0,0.9)]",
                    index === 1 ? "translate-y-5" : null,
                  )}
                >
                  <div className="aspect-[4/3] rounded border border-white/10 bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.16),transparent_34%),linear-gradient(135deg,#161d25,#0f141b)]" />
                  <div className="mt-3 h-2.5 w-3/4 rounded-full bg-white/18" />
                  <div className="mt-2 h-2.5 w-1/2 rounded-full bg-white/10" />
                  <div className="mt-2 h-2.5 w-2/3 rounded-full bg-amber-200/15" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-dashed border-white/12 bg-white/[0.025] p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-amber-200">
        {state === "loading" ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <Search className="size-5" aria-hidden="true" />
        )}
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

export function TechnologyCompareClient({
  initialTechnology = "",
  initialTechnologies,
}: TechnologyCompareClientProps) {
  const initialSelectedTechnologies = useMemo(
    () => normalizeTechnologySelection(initialTechnologies ?? [initialTechnology]),
    [initialTechnologies, initialTechnology],
  )
  const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>(initialSelectedTechnologies)
  const [technologyOptions, setTechnologyOptions] = useState<TechnologyComparisonOption[]>([])
  const [items, setItems] = useState<TechnologyComparisonItem[]>([])
  const [selectedExportIds, setSelectedExportIds] = useState<Set<string>>(() => new Set())
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aspect, setAspect] = useState<ExportAspect>("wide")
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle")
  const [imageSafeExport, setImageSafeExport] = useState(false)
  const [siteFilter, setSiteFilter] = useState("")
  const exportRef = useRef<HTMLDivElement | null>(null)

  const visibleItems = useMemo(
    () => items.filter((item) => selectedExportIds.has(item.canonicalTargetId)),
    [items, selectedExportIds],
  )

  const exportItems = useMemo(
    () => visibleItems,
    [visibleItems],
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

  const updateSelectedTechnologies = useCallback((technologies: string[]) => {
    const nextTechnologies = normalizeTechnologySelection(technologies)
    setSelectedTechnologies(nextTechnologies)
    setSelectedExportIds(new Set())
    setExportStatus("idle")
    setSiteFilter("")

    const params = new URLSearchParams()

    for (const technology of nextTechnologies) {
      params.append("technology", technology)
    }

    const nextUrl = nextTechnologies.length > 0
      ? `/technology-compare?${params.toString()}`
      : "/technology-compare"
    window.history.replaceState(null, "", nextUrl)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadOptions() {
      setIsLoadingOptions(true)

      try {
        const response = await fetchTechnologyOptions(controller.signal)
        setTechnologyOptions(response.items)
      } catch {
        if (!controller.signal.aborted) {
          setTechnologyOptions([])
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
    if (selectedTechnologies.length === 0) {
      setItems([])
      setIsLoading(false)
      setError(null)
      setSiteFilter("")
      return
    }

    const controller = new AbortController()

    async function loadComparison() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetchTechnologyComparison(selectedTechnologies, controller.signal)
        setItems(response.items)
        setSelectedExportIds(new Set(response.items.map((item) => item.canonicalTargetId)))
        setSiteFilter("")
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
        }
      }
    }

    void loadComparison()

    return () => {
      controller.abort()
    }
  }, [selectedTechnologies])

  const toggleExportSelection = (id: string) => {
    setSelectedExportIds((previous) => {
      const next = new Set(previous)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  const exportOptions = {
    cacheBust: true,
    includeQueryParams: true,
    pixelRatio: 2,
    backgroundColor: "#10151b",
  }

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

        return toPng(exportRef.current, exportOptions)
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

        return toBlob(exportRef.current, exportOptions)
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
  const retrySearch = () => setSelectedTechnologies((previous) => [...previous])

  return (
    <div className="mx-auto max-w-[1500px] overflow-x-hidden text-white">
      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(340px,420px)_1fr]">
        <div className="min-w-0 space-y-5">
          <div className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#151b22]/96 p-4 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.95)]">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-slate-200">
                  Technology
                </label>
                {selectedTechnologies.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-slate-400 hover:bg-white/[0.06] hover:text-white"
                    onClick={() => updateSelectedTechnologies([])}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                    Clear all
                  </Button>
                ) : null}
              </div>
              <TechnologySelector
                options={technologyOptions}
                selected={selectedTechnologies}
                onSelectedChange={updateSelectedTechnologies}
              />
              {isLoadingOptions ? (
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">Loading technology index...</p>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#151b22]/90 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Included sites</h2>
                <p className="mt-1 font-mono text-xs text-amber-200/80">{exportLabel}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-slate-400 hover:bg-white/5 hover:text-white"
                  onClick={() => setSelectedExportIds(new Set(items.map((item) => item.canonicalTargetId)))}
                  disabled={items.length === 0}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-slate-400 hover:bg-white/5 hover:text-white"
                  onClick={() => setSelectedExportIds(new Set())}
                  disabled={selectedExportIds.size === 0}
                >
                  None
                </Button>
              </div>
            </div>

            {items.length > 0 ? (
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input
                  type="text"
                  value={siteFilter}
                  onChange={(event) => setSiteFilter(event.currentTarget.value)}
                  placeholder="Filter sites..."
                  aria-label="Filter included sites"
                  className="h-9 w-full rounded-md border border-white/10 bg-[#0f141b] px-9 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-amber-300/70 focus:ring-3 focus:ring-amber-300/15"
                />
                {siteFilter ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white"
                    onClick={() => setSiteFilter("")}
                    aria-label="Clear site filter"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {filteredIncludedSiteItems.map((item) => {
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
                    <label className="flex min-w-0 cursor-pointer items-center gap-3 px-3 py-2">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-white/15 bg-[#0f141b] accent-amber-300"
                        checked={isIncluded}
                        onChange={() => toggleExportSelection(item.canonicalTargetId)}
                        aria-label={`Include ${target}`}
                      />
                      <Favicon
                        src={item.faviconUrl}
                        target={target}
                        className="size-7 rounded-[5px]"
                        imageClassName="size-5"
                        iconClassName="size-3.5"
                      />
                      <span className="min-w-0 truncate font-mono text-xs">{target}</span>
                    </label>
                  </div>
                )
              })}
              {items.length > 0 && filteredIncludedSiteItems.length === 0 ? (
                <p className="rounded-md border border-dashed border-white/10 px-3 py-4 text-sm text-slate-500">
                  No included sites match this filter.
                </p>
              ) : null}
              {items.length === 0 ? (
                <p className="rounded-md border border-dashed border-white/10 px-3 py-4 text-sm text-slate-500">
                  Matching sites will appear here after a search.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <div className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#151b22]/88 p-3 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.95)]">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  {selectedTechnologyLabel ? `${selectedTechnologyLabel} across scanned sites` : "Technology comparison board"}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-grid grid-cols-2 rounded-md border border-white/10 bg-[#0f141b] p-1">
                  {(["wide", "square"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={cn(
                        "rounded-[5px] px-3 py-1.5 text-xs capitalize transition-colors",
                        aspect === value ? "bg-amber-300 text-[#17110b]" : "text-slate-400 hover:text-white",
                      )}
                      onClick={() => setAspect(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
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
              <div
                ref={exportRef}
                className={cn(
                  "mx-auto w-full overflow-hidden rounded-lg border border-white/10 bg-[#10151b] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                  aspect === "square" ? "max-w-[760px]" : "max-w-[1040px]",
                )}
              >
                <div className="flex flex-col">
                  {exportTechnologyLabel ? (
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                      <div className="flex shrink-0 -space-x-2">
                        {exportTechnologies.slice(0, 3).map((technology) => (
                          <TechnologyIcon
                            key={technology.name}
                            iconUrl={technology.iconUrl}
                            technology={technology.name}
                            forceFallback={imageSafeExport}
                            exportSafe
                            className="size-10 rounded-lg ring-2 ring-[#10151b]"
                          />
                        ))}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-2xl font-semibold tracking-tight text-white">
                          {exportTechnologyLabel}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className={cn(
                    "grid gap-3 pt-4",
                    aspect === "square" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
                  )}>
                    {exportItems.map((item) => (
                      <div key={item.canonicalTargetId}>
                        <ExportCard
                          item={item}
                          forcePlaceholders={imageSafeExport}
                        />
                      </div>
                    ))}
                    {exportItems.length === 0 ? (
                      <div className="col-span-full flex items-center justify-center rounded-lg border border-dashed border-white/12 bg-white/[0.025] text-center">
                        <div>
                          <ArrowDownToLine className="mx-auto size-6 text-amber-200" aria-hidden="true" />
                          <p className="mt-3 text-sm text-slate-400">Select at least one visible site to export.</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {isLoading ? (
              <motion.div key="loading" layout>
                <StateBlock state="loading" />
              </motion.div>
            ) : error ? (
              <motion.div key="error" layout>
                <StateBlock state="error" onRetry={retrySearch} />
              </motion.div>
            ) : !hasSearched ? (
              <motion.div key="empty" layout>
                <StateBlock state="empty" />
              </motion.div>
            ) : items.length === 0 ? (
              <motion.div key="none" layout>
                <StateBlock state="none" />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </section>
    </div>
  )
}
