"use client"

import * as React from "react"
import { Search, X, Filter, Code, Globe, Server, Hash } from "lucide-react"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
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
  { label: "Yoast SEO", value: "yoast seo" },
  { label: "WooCommerce Gateway Stripe", value: "woocommerce gateway stripe" },
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
                <ComboboxChip key={value}>{value}</ComboboxChip>
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
    filters.statusCode.length > 0 ||
    filters.from.trim().length > 0 ||
    filters.to.trim().length > 0

  const activeFilterCount =
    filters.technology.length +
    filters.cdn.length +
    filters.server.length +
    filters.statusCode.length +
    (filters.from.trim().length > 0 || filters.to.trim().length > 0 ? 1 : 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
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

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-[var(--text-dim)]" />
          <span className="text-[10px] font-mono text-[var(--text-dim)]">Filters:</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
              {activeFilterCount}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="technology-filter" className="sr-only">
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
            className="min-w-[140px] bg-[var(--surface-mid)] border-[var(--gray-border)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="cdn-filter" className="sr-only">
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
            className="min-w-[120px] bg-[var(--surface-mid)] border-[var(--gray-border)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="server-filter" className="sr-only">
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
            className="min-w-[120px] bg-[var(--surface-mid)] border-[var(--gray-border)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="status-filter" className="sr-only">
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
            className="min-w-[100px] bg-[var(--surface-mid)] border-[var(--gray-border)]"
          />
        </div>

        <div className="flex items-center gap-2 ml-4">
          <Label htmlFor="from-filter" className="sr-only">
            {TARGETS_FILTER_LABELS.from}
          </Label>
          <DatePicker
            id="from-filter"
            value={filters.from}
            onChange={(value) => onFiltersChange({ ...filters, from: value })}
            aria-label={TARGETS_FILTER_LABELS.from}
            className="bg-[var(--surface-mid)] border-[var(--gray-border)]"
          />
          <span className="text-xs text-[var(--text-dim)]">to</span>
          <Label htmlFor="to-filter" className="sr-only">
            {TARGETS_FILTER_LABELS.to}
          </Label>
          <DatePicker
            id="to-filter"
            value={filters.to}
            onChange={(value) => onFiltersChange({ ...filters, to: value })}
            aria-label={TARGETS_FILTER_LABELS.to}
            className="bg-[var(--surface-mid)] border-[var(--gray-border)]"
          />
        </div>
      </div>
    </div>
  )
}
