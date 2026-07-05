"use client"

import * as React from "react"
import { Search, X, Filter, Code, Globe, Server, Hash, Puzzle, Palette, Shield } from "lucide-react"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxList,
  ComboboxEmpty,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import {
  TARGETS_FILTER_LABELS,
  TARGETS_FILTER_PLACEHOLDER,
  TARGETS_CLEAR_FILTERS_BUTTON_LABEL,
} from "./types"
import type { TargetFilterOptionsResponse } from "@/lib/contracts/targets"

interface FilterState {
  q: string
  technology: string[]
  cdn: string[]
  server: string[]
  plugin: string[]
  theme: string[]
  cpe: string[]
  statusCode: string[]
  from: string
  to: string
}

interface FilterOption {
  label: string
  value: string
  matchCount: number
}

interface MultiSelectComboboxProps {
  id?: string
  options: FilterOption[]
  selected: string[]
  onSelectedChange: (selected: string[]) => void
  placeholder?: string
  icon?: React.ReactNode
  className?: string
  "aria-label"?: string
}

function useDesktopComboboxPopupSide() {
  const [isDesktop, setIsDesktop] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }

    const query = window.matchMedia("(min-width: 768px)")
    const handleChange = () => setIsDesktop(query.matches)

    handleChange()
    query.addEventListener("change", handleChange)

    return () => {
      query.removeEventListener("change", handleChange)
    }
  }, [])

  return isDesktop
}

function MultiSelectCombobox({
  id,
  options,
  selected,
  onSelectedChange,
  placeholder = "Select...",
  icon,
  className,
  "aria-label": ariaLabel,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const useDesktopPopupSide = useDesktopComboboxPopupSide()
  const anchorRef = useComboboxAnchor()
  const optionLabelMap = React.useMemo(
    () => new Map(options.map((option) => [option.value, option.label])),
    [options],
  )
  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return options
    }

    return options.filter((option) => {
      return option.label.toLowerCase().includes(normalizedQuery)
        || option.value.toLowerCase().includes(normalizedQuery)
    })
  }, [options, query])
  const filteredValues = React.useMemo(
    () => filteredOptions.map((option) => option.value),
    [filteredOptions],
  )

  const handleValueChange = (value: string[]) => {
    onSelectedChange(value)
    setQuery("")
  }
  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || !query.trim()) {
      return
    }

    const firstOption = filteredOptions[0]

    if (!firstOption) {
      return
    }

    event.preventDefault()

    if (!selected.includes(firstOption.value)) {
      onSelectedChange([...selected, firstOption.value])
    }

    setQuery("")
  }

  return (
    <Combobox
      multiple
      autoHighlight
      value={selected}
      onValueChange={handleValueChange}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)

        if (!nextOpen) {
          setQuery("")
        }
      }}
      items={filteredValues}
    >
      <ComboboxChips
        ref={anchorRef as React.Ref<HTMLDivElement>}
        className={className}
      >
        {icon && <span className="shrink-0 size-3.5 mr-1">{icon}</span>}
        <ComboboxValue placeholder={placeholder}>
          {(values: string[]) => (
            <React.Fragment>
              {values.length === 0 ? null : values.slice(0, 3).map((value) => (
                <ComboboxChip key={value}>{optionLabelMap.get(value) ?? value}</ComboboxChip>
              ))}
              {values.length > 3 && (
                <Badge variant="secondary" className="h-[22px] px-1.5 text-[10px]">
                  +{values.length - 3}
                </Badge>
              )}
              {values.length > 0 && (
                <ComboboxChipsInput
                  id={id}
                  aria-label={ariaLabel}
                  className="text-base md:text-xs"
                  placeholder={`+${values.length}`}
                  onChange={(event) => {
                    setOpen(true)
                    setQuery(event.currentTarget.value)
                  }}
                  onFocus={(event) => {
                    setOpen(true)
                    setQuery(event.currentTarget.value)
                  }}
                  onKeyDown={handleInputKeyDown}
                />
              )}
            </React.Fragment>
          )}
        </ComboboxValue>
        {selected.length === 0 && (
          <ComboboxChipsInput
            id={id}
            aria-label={ariaLabel}
            className="text-base md:text-xs"
            placeholder={placeholder}
            onChange={(event) => {
              setOpen(true)
              setQuery(event.currentTarget.value)
            }}
            onFocus={(event) => {
              setOpen(true)
              setQuery(event.currentTarget.value)
            }}
            onKeyDown={handleInputKeyDown}
          />
        )}
      </ComboboxChips>
      <ComboboxContent
        anchor={anchorRef}
        side={useDesktopPopupSide ? "right" : "bottom"}
        align="start"
        sideOffset={8}
      >
        <ComboboxList aria-label={ariaLabel ? `${ariaLabel} options` : undefined} className="max-h-48">
          <ComboboxEmpty>No results found.</ComboboxEmpty>
          {filteredOptions.map((opt) => (
            <ComboboxItem key={opt.value} value={opt.value as string}>
              <span className="min-w-0 flex-1 truncate">{opt.label}</span>
              <span className="ml-auto text-[10px] text-[var(--text-dim)]">{opt.matchCount}</span>
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

type HiddenFilterKey = "technology" | "cdn" | "server" | "plugin" | "theme" | "cpe" | "statusCode" | "dateRange"

interface FilterChipData {
  key: HiddenFilterKey
  label: string
  values: string[]
}

function getHiddenFilterChips(filters: FilterState): FilterChipData[] {
  const chips: FilterChipData[] = []

  if (filters.technology.length > 0) {
    chips.push({ key: "technology", label: TARGETS_FILTER_LABELS.technology, values: filters.technology })
  }
  if (filters.cdn.length > 0) {
    chips.push({ key: "cdn", label: TARGETS_FILTER_LABELS.cdn, values: filters.cdn })
  }
  if (filters.server.length > 0) {
    chips.push({ key: "server", label: TARGETS_FILTER_LABELS.server, values: filters.server })
  }
  if (filters.plugin.length > 0) {
    chips.push({ key: "plugin", label: TARGETS_FILTER_LABELS.plugin, values: filters.plugin })
  }
  if (filters.theme.length > 0) {
    chips.push({ key: "theme", label: TARGETS_FILTER_LABELS.theme, values: filters.theme })
  }
  if (filters.cpe.length > 0) {
    chips.push({ key: "cpe", label: TARGETS_FILTER_LABELS.cpe, values: filters.cpe })
  }
  if (filters.statusCode.length > 0) {
    chips.push({ key: "statusCode", label: TARGETS_FILTER_LABELS.statusCode, values: filters.statusCode })
  }
  if (filters.from.trim().length > 0 || filters.to.trim().length > 0) {
    const dateParts: string[] = []
    if (filters.from.trim()) dateParts.push(filters.from.trim())
    if (filters.to.trim()) dateParts.push(filters.to.trim())
    chips.push({ key: "dateRange", label: "Date", values: dateParts })
  }

  return chips
}

function getHiddenFilterCount(filters: FilterState): number {
  let count = 0
  if (filters.technology.length > 0) count++
  if (filters.cdn.length > 0) count++
  if (filters.server.length > 0) count++
  if (filters.plugin.length > 0) count++
  if (filters.theme.length > 0) count++
  if (filters.cpe.length > 0) count++
  if (filters.statusCode.length > 0) count++
  if (filters.from.trim().length > 0 || filters.to.trim().length > 0) count++
  return count
}

type FilterOptionKey = Exclude<HiddenFilterKey, "dateRange">

function mergeSelectedOptions(options: readonly FilterOption[], selected: readonly string[]): FilterOption[] {
  const optionByValue = new Map(options.map((option) => [option.value, option]))
  const selectedFallbackOptions = selected.flatMap((value) => {
    if (!value || optionByValue.has(value)) {
      return []
    }

    return [{
      label: value,
      value,
      matchCount: 0,
    }]
  })

  return [...options, ...selectedFallbackOptions]
}

function getScopedFilterOptions(
  filterOptions: TargetFilterOptionsResponse,
  filters: FilterState,
): Record<FilterOptionKey, FilterOption[]> {
  return {
    technology: mergeSelectedOptions(filterOptions.technology, filters.technology),
    cdn: mergeSelectedOptions(filterOptions.cdn, filters.cdn),
    server: mergeSelectedOptions(filterOptions.server, filters.server),
    plugin: mergeSelectedOptions(filterOptions.plugin, filters.plugin),
    theme: mergeSelectedOptions(filterOptions.theme, filters.theme),
    cpe: mergeSelectedOptions(filterOptions.cpe, filters.cpe),
    statusCode: mergeSelectedOptions(filterOptions.statusCode, filters.statusCode),
  }
}

function getFilterOptionLabelMap(options: Record<FilterOptionKey, FilterOption[]>) {
  return {
    technology: new Map(options.technology.map((option) => [option.value, option.label])),
    cdn: new Map(options.cdn.map((option) => [option.value, option.label])),
    server: new Map(options.server.map((option) => [option.value, option.label])),
    plugin: new Map(options.plugin.map((option) => [option.value, option.label])),
    theme: new Map(options.theme.map((option) => [option.value, option.label])),
    cpe: new Map(options.cpe.map((option) => [option.value, option.label])),
    statusCode: new Map(options.statusCode.map((option) => [option.value, option.label])),
  }
}

interface TargetsFilterBarProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  filterOptions: TargetFilterOptionsResponse
  onFilterOptionsRequest?: () => void
  onClearFilters?: () => void
}

export function TargetsFilterBar({
  filters,
  onFiltersChange,
  filterOptions,
  onFilterOptionsRequest,
  onClearFilters,
}: TargetsFilterBarProps) {
  const hiddenFilterCount = getHiddenFilterCount(filters)
  const hiddenChips = getHiddenFilterChips(filters)
  const scopedFilterOptions = React.useMemo(
    () => getScopedFilterOptions(filterOptions, filters),
    [filterOptions, filters],
  )
  const filterOptionLabelMaps = React.useMemo(() => getFilterOptionLabelMap(scopedFilterOptions), [scopedFilterOptions])

  const removeChipValues = (key: HiddenFilterKey) => {
    switch (key) {
      case "technology":
        onFiltersChange({ ...filters, technology: [] })
        break
      case "cdn":
        onFiltersChange({ ...filters, cdn: [] })
        break
      case "server":
        onFiltersChange({ ...filters, server: [] })
        break
      case "plugin":
        onFiltersChange({ ...filters, plugin: [] })
        break
      case "theme":
        onFiltersChange({ ...filters, theme: [] })
        break
      case "cpe":
        onFiltersChange({ ...filters, cpe: [] })
        break
      case "statusCode":
        onFiltersChange({ ...filters, statusCode: [] })
        break
      case "dateRange":
        onFiltersChange({ ...filters, from: "", to: "" })
        break
    }
  }

  const renderActiveFilterSummary = () => (
    <div className="flex max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-[var(--gray-border)]/65 bg-[var(--surface-dark)]/35 px-2.5 py-2 sm:w-fit">
      <span className="mr-1 font-heading text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
        {hiddenFilterCount} active {hiddenFilterCount === 1 ? "filter" : "filters"}
      </span>
      {hiddenChips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 pr-1 text-[10px] bg-[var(--surface-mid)] border border-[var(--gray-border)] text-[var(--text-dim)]"
        >
          <span className="font-medium text-[var(--foreground)]">{chip.label}:</span>
          <span className="truncate">
            {chip.values
              .map((value) => {
                if (chip.key === "dateRange") {
                  return value
                }

                return filterOptionLabelMaps[chip.key].get(value) ?? value
              })
              .join(", ")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Remove ${chip.label} filter`}
            className="ml-0.5 size-4 rounded-full text-[var(--text-dim)] hover:bg-[var(--surface-light)] hover:text-[var(--foreground)]"
            onClick={() => removeChipValues(chip.key)}
          >
            <X className="size-3" />
          </Button>
        </Badge>
      ))}
      {onClearFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)]"
          onClick={onClearFilters}
        >
          {TARGETS_CLEAR_FILTERS_BUTTON_LABEL}
        </Button>
      )}
    </div>
  )

  return (
    <>
      <div className="sticky top-0 z-30 rounded-t-xl bg-[var(--surface-dark)]/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface-dark)]/85">
        <div className="flex items-center gap-2 sm:gap-3">
          <InputGroup className="min-w-0 flex-1 bg-[var(--surface-mid)] border-[var(--gray-border)] sm:max-w-md">
            <InputGroupAddon align="inline-start">
              <Search className="size-4 text-[var(--text-dim)]" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={TARGETS_FILTER_LABELS.q}
              placeholder={TARGETS_FILTER_PLACEHOLDER}
              value={filters.q}
              onChange={(e) => onFiltersChange({ ...filters, q: e.target.value })}
              className="text-[var(--foreground)] placeholder:text-[var(--text-dim)]/50"
            />
            {filters.q && (
              <InputGroupAddon align="inline-end">
                <Button
                  aria-label="Clear target query"
                  variant="ghost"
                  size="icon-xs"
                  className="text-[var(--text-dim)] hover:text-[var(--foreground)]"
                  onClick={() => onFiltersChange({ ...filters, q: "" })}
                >
                  <X className="size-3.5" />
                </Button>
              </InputGroupAddon>
            )}
          </InputGroup>

          <Popover
            onOpenChange={(open) => {
              if (open) {
                onFilterOptionsRequest?.()
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="relative h-8 gap-1.5 border-[var(--gray-border)] bg-[var(--surface-mid)] text-[var(--text-dim)] hover:text-[var(--foreground)] hover:bg-[var(--surface-light)]"
              >
                <Filter className="size-3.5" />
                <span className="text-xs">Filters</span>
                {hiddenFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[9px]">
                    {hiddenFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              onOpenAutoFocus={(event) => event.preventDefault()}
              className="w-[min(340px,calc(100vw-2rem))] p-4"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--foreground)]">Filters</span>
                  {hiddenFilterCount > 0 && onClearFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)]"
                      onClick={() => {
                        onFiltersChange({
                          ...filters,
                          technology: [],
                          cdn: [],
                          server: [],
                          plugin: [],
                          theme: [],
                          cpe: [],
                          statusCode: [],
                          from: "",
                          to: "",
                        })
                      }}
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="technology-filter" className="text-xs text-[var(--text-dim)] w-20 shrink-0">
                      {TARGETS_FILTER_LABELS.technology}
                    </Label>
                    <MultiSelectCombobox
                      id="technology-filter"
                      options={scopedFilterOptions.technology}
                      selected={filters.technology}
                      onSelectedChange={(value) => onFiltersChange({ ...filters, technology: value })}
                      placeholder="Technology..."
                      icon={<Code className="size-3.5" />}
                      aria-label={TARGETS_FILTER_LABELS.technology}
                      className="flex-1 bg-[var(--surface-mid)] border-[var(--gray-border)]"
                    />
                  </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="cdn-filter" className="text-xs text-[var(--text-dim)] w-20 shrink-0">
                    {TARGETS_FILTER_LABELS.cdn}
                  </Label>
                  <MultiSelectCombobox
                    id="cdn-filter"
                    options={scopedFilterOptions.cdn}
                    selected={filters.cdn}
                    onSelectedChange={(value) => onFiltersChange({ ...filters, cdn: value })}
                    placeholder="CDN..."
                    icon={<Globe className="size-3.5" />}
                    aria-label={TARGETS_FILTER_LABELS.cdn}
                    className="flex-1 bg-[var(--surface-mid)] border-[var(--gray-border)]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="server-filter" className="text-xs text-[var(--text-dim)] w-20 shrink-0">
                    {TARGETS_FILTER_LABELS.server}
                  </Label>
                  <MultiSelectCombobox
                    id="server-filter"
                    options={scopedFilterOptions.server}
                    selected={filters.server}
                    onSelectedChange={(value) => onFiltersChange({ ...filters, server: value })}
                    placeholder="Server..."
                    icon={<Server className="size-3.5" />}
                    aria-label={TARGETS_FILTER_LABELS.server}
                    className="flex-1 bg-[var(--surface-mid)] border-[var(--gray-border)]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="status-filter" className="text-xs text-[var(--text-dim)] w-20 shrink-0">
                    {TARGETS_FILTER_LABELS.statusCode}
                  </Label>
                  <MultiSelectCombobox
                    id="status-filter"
                    options={scopedFilterOptions.statusCode}
                    selected={filters.statusCode}
                    onSelectedChange={(value) => onFiltersChange({ ...filters, statusCode: value })}
                    placeholder="Status..."
                    icon={<Hash className="size-3.5" />}
                    aria-label={TARGETS_FILTER_LABELS.statusCode}
                    className="flex-1 bg-[var(--surface-mid)] border-[var(--gray-border)]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="plugin-filter" className="text-xs text-[var(--text-dim)] w-20 shrink-0">
                    {TARGETS_FILTER_LABELS.plugin}
                  </Label>
                  <MultiSelectCombobox
                    id="plugin-filter"
                    options={scopedFilterOptions.plugin}
                    selected={filters.plugin}
                    onSelectedChange={(value) => onFiltersChange({ ...filters, plugin: value })}
                    placeholder="Plugin..."
                    icon={<Puzzle className="size-3.5" />}
                    aria-label={TARGETS_FILTER_LABELS.plugin}
                    className="flex-1 bg-[var(--surface-mid)] border-[var(--gray-border)]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="theme-filter" className="text-xs text-[var(--text-dim)] w-20 shrink-0">
                    {TARGETS_FILTER_LABELS.theme}
                  </Label>
                  <MultiSelectCombobox
                    id="theme-filter"
                    options={scopedFilterOptions.theme}
                    selected={filters.theme}
                    onSelectedChange={(value) => onFiltersChange({ ...filters, theme: value })}
                    placeholder="Theme..."
                    icon={<Palette className="size-3.5" />}
                    aria-label={TARGETS_FILTER_LABELS.theme}
                    className="flex-1 bg-[var(--surface-mid)] border-[var(--gray-border)]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="cpe-filter" className="text-xs text-[var(--text-dim)] w-20 shrink-0">
                    {TARGETS_FILTER_LABELS.cpe}
                  </Label>
                  <MultiSelectCombobox
                    id="cpe-filter"
                    options={scopedFilterOptions.cpe}
                    selected={filters.cpe}
                    onSelectedChange={(value) => onFiltersChange({ ...filters, cpe: value })}
                    placeholder="CPE..."
                    icon={<Shield className="size-3.5" />}
                    aria-label={TARGETS_FILTER_LABELS.cpe}
                    className="flex-1 bg-[var(--surface-mid)] border-[var(--gray-border)]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="from-filter" className="text-xs text-[var(--text-dim)] w-20 shrink-0">
                    {TARGETS_FILTER_LABELS.from}
                  </Label>
                  <DatePicker
                    id="from-filter"
                    value={filters.from}
                    onChange={(value) => onFiltersChange({ ...filters, from: value })}
                    aria-label={TARGETS_FILTER_LABELS.from}
                    wrapperClassName="flex-1"
                    className="bg-[var(--surface-mid)] border-[var(--gray-border)]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="to-filter" className="text-xs text-[var(--text-dim)] w-20 shrink-0">
                    {TARGETS_FILTER_LABELS.to}
                  </Label>
                  <DatePicker
                    id="to-filter"
                    value={filters.to}
                    onChange={(value) => onFiltersChange({ ...filters, to: value })}
                    aria-label={TARGETS_FILTER_LABELS.to}
                    wrapperClassName="flex-1"
                    className="bg-[var(--surface-mid)] border-[var(--gray-border)]"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      </div>

      {hiddenChips.length > 0 && (
        <div className="px-3 sm:sticky sm:top-12 sm:z-20 sm:border-b sm:border-[var(--gray-border)]/55 sm:bg-[var(--surface-dark)]/95 sm:py-2 sm:backdrop-blur sm:supports-[backdrop-filter]:bg-[var(--surface-dark)]/85">
          {renderActiveFilterSummary()}
        </div>
      )}
    </>
  )
}
