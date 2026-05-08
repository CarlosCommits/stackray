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
  TARGETS_RESULT_COUNT_LABEL,
} from "./types"

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

const TECHNOLOGY_OPTIONS = [
  { label: "WordPress", value: "wordpress" },
  { label: "WooCommerce", value: "woocommerce" },
  { label: "PHP", value: "php" },
  { label: "Next.js", value: "next.js" },
  { label: "React", value: "react" },
  { label: "Vercel", value: "vercel" },
  { label: "Astro", value: "astro" },
  { label: "Tailwind CSS", value: "tailwind css" },
  { label: "MySQL", value: "mysql" },
  { label: "BullMQ", value: "bullmq" },
  { label: "Redis", value: "redis" },
  { label: "Jetpack", value: "jetpack" },
  { label: "Akismet", value: "akismet" },
  { label: "Yoast SEO", value: "yoast-seo" },
  { label: "WooCommerce Gateway Stripe", value: "woocommerce-gateway-stripe" },
]

const CDN_OPTIONS = [
  { label: "Cloudflare", value: "cloudflare" },
  { label: "Fastly", value: "fastly" },
  { label: "Vercel Edge", value: "vercel edge" },
  { label: "AWS CloudFront", value: "aws cloudfront" },
  { label: "Akamai", value: "akamai" },
]

const SERVER_OPTIONS = [
  { label: "nginx", value: "nginx" },
  { label: "Apache", value: "apache" },
  { label: "Vercel", value: "vercel" },
  { label: "cloudflare", value: "cloudflare" },
  { label: "Flywheel", value: "flywheel" },
]

const PLUGIN_OPTIONS = [
  { label: "Jetpack", value: "jetpack" },
  { label: "Akismet", value: "akismet" },
  { label: "Yoast SEO", value: "yoast-seo" },
  { label: "WooCommerce Gateway Stripe", value: "woocommerce-gateway-stripe" },
]

const THEME_OPTIONS = [
  { label: "Co-op Classic", value: "co-op-classic" },
  { label: "Storefront", value: "storefront" },
  { label: "Twenty Twenty-Four", value: "twentytwentyfour" },
]

const CPE_OPTIONS = [
  { label: "WordPress", value: "wordpress" },
  { label: "WooCommerce", value: "woocommerce" },
  { label: "Next.js", value: "next.js" },
  { label: "Cloudflare", value: "cloudflare" },
]

const STATUS_CODE_OPTIONS = [
  { label: "200", value: "200" },
  { label: "301", value: "301" },
  { label: "302", value: "302" },
  { label: "404", value: "404" },
  { label: "500", value: "500" },
  { label: "503", value: "503" },
]

interface FilterOption {
  label: string
  value: string
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
  const anchorRef = useComboboxAnchor()
  const optionLabelMap = React.useMemo(
    () => new Map(options.map((option) => [option.value, option.label])),
    [options],
  )

  const handleValueChange = (value: string[]) => {
    onSelectedChange(value)
  }

  return (
    <Combobox
      multiple
      value={selected}
      onValueChange={handleValueChange}
      open={open}
      onOpenChange={setOpen}
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
                  className="text-xs"
                  placeholder={`+${values.length}`}
                />
              )}
            </React.Fragment>
          )}
        </ComboboxValue>
        {selected.length === 0 && (
          <ComboboxChipsInput
            id={id}
            aria-label={ariaLabel}
            className="text-xs"
            placeholder={placeholder}
          />
        )}
      </ComboboxChips>
      <ComboboxContent anchor={anchorRef}>
        <ComboboxList className="max-h-48">
          <ComboboxEmpty>No results found.</ComboboxEmpty>
          {options.map((opt) => (
            <ComboboxItem key={opt.value} value={opt.value as string}>
              {opt.label}
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

function getFilterOptionLabelMap() {
  return {
    technology: new Map(TECHNOLOGY_OPTIONS.map((option) => [option.value, option.label])),
    cdn: new Map(CDN_OPTIONS.map((option) => [option.value, option.label])),
    server: new Map(SERVER_OPTIONS.map((option) => [option.value, option.label])),
    plugin: new Map(PLUGIN_OPTIONS.map((option) => [option.value, option.label])),
    theme: new Map(THEME_OPTIONS.map((option) => [option.value, option.label])),
    cpe: new Map(CPE_OPTIONS.map((option) => [option.value, option.label])),
    statusCode: new Map(STATUS_CODE_OPTIONS.map((option) => [option.value, option.label])),
  } as const
}

interface TargetsFilterBarProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onClearFilters?: () => void
  resultCount?: number
}

export function TargetsFilterBar({
  filters,
  onFiltersChange,
  onClearFilters,
  resultCount,
}: TargetsFilterBarProps) {
  const hasActiveFilters =
    filters.q.trim().length > 0 ||
    filters.technology.length > 0 ||
    filters.cdn.length > 0 ||
    filters.server.length > 0 ||
    filters.plugin.length > 0 ||
    filters.theme.length > 0 ||
    filters.cpe.length > 0 ||
    filters.statusCode.length > 0 ||
    filters.from.trim().length > 0 ||
    filters.to.trim().length > 0

  const hiddenFilterCount = getHiddenFilterCount(filters)
  const hiddenChips = getHiddenFilterChips(filters)
  const filterOptionLabelMaps = React.useMemo(() => getFilterOptionLabelMap(), [])

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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <InputGroup className="flex-1 max-w-md bg-[var(--surface-mid)] border-[var(--gray-border)]">
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

        <Popover>
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
          <PopoverContent align="end" className="w-[340px] p-4">
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
                    options={TECHNOLOGY_OPTIONS}
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
                    options={CDN_OPTIONS}
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
                    options={SERVER_OPTIONS}
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
                    options={STATUS_CODE_OPTIONS}
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
                    options={PLUGIN_OPTIONS}
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
                    options={THEME_OPTIONS}
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
                    options={CPE_OPTIONS}
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

        <div className="flex items-center gap-3">
          {resultCount !== undefined && hasActiveFilters && (
            <Badge variant="outline" className="text-[10px] border-[var(--gray-border)] text-[var(--text-dim)]">
              {resultCount} {TARGETS_RESULT_COUNT_LABEL}
            </Badge>
          )}

          {hasActiveFilters && onClearFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)]"
              onClick={onClearFilters}
            >
              {TARGETS_CLEAR_FILTERS_BUTTON_LABEL}
            </Button>
          )}
        </div>
      </div>

{hiddenChips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {hiddenChips.map((chip) => (
            <Badge
              key={chip.key}
              variant="secondary"
              className="gap-1 pr-1 text-[10px] bg-[var(--surface-mid)] border border-[var(--gray-border)] text-[var(--text-dim)]"
            >
              <span className="font-medium text-[var(--foreground)]">{chip.label}:</span>
              <span>
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
        </div>
      )}
    </div>
  )
}
