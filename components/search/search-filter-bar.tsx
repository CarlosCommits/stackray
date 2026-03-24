"use client"

import { Search, X, Filter, Code, Globe, Server, Blocks, Hash, Calendar } from "lucide-react"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  SEARCH_FILTER_LABELS,
  SEARCH_FILTER_PLACEHOLDER,
  SEARCH_CLEAR_FILTERS_BUTTON_LABEL,
  SEARCH_RESULT_COUNT_LABEL,
} from "./types"
import type { SearchModeValue } from "./types"

interface FilterState {
  q: string
  technology: string
  cdn: string
  server: string
  plugin: string
  cpe: string
  statusCode: string
  from: string
  to: string
  mode: SearchModeValue
}

interface SearchFilterBarProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onClearFilters?: () => void
  resultCount?: number
}

export function SearchFilterBar({
  filters,
  onFiltersChange,
  onClearFilters,
  resultCount,
}: SearchFilterBarProps) {
  const hasActiveFilters =
    filters.q.trim().length > 0 ||
    filters.technology.trim().length > 0 ||
    filters.cdn.trim().length > 0 ||
    filters.server.trim().length > 0 ||
    filters.plugin.trim().length > 0 ||
    filters.cpe.trim().length > 0 ||
    filters.statusCode.trim().length > 0 ||
    filters.from.trim().length > 0 ||
    filters.to.trim().length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <InputGroup className="flex-1 max-w-md bg-[var(--surface-mid)] border-[var(--gray-border)]">
          <InputGroupAddon align="inline-start">
            <Search className="size-4 text-[var(--text-dim)]" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={SEARCH_FILTER_LABELS.q}
            placeholder={SEARCH_FILTER_PLACEHOLDER}
            value={filters.q}
            onChange={(e) => onFiltersChange({ ...filters, q: e.target.value })}
            className="text-[var(--foreground)] placeholder:text-[var(--text-dim)]/50"
          />
          {filters.q && (
            <InputGroupAddon align="inline-end">
              <Button
                aria-label="Clear search"
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
          {resultCount !== undefined && (
            <Badge variant="outline" className="text-[10px] border-[var(--gray-border)] text-[var(--text-dim)]">
              {resultCount} {SEARCH_RESULT_COUNT_LABEL}
            </Badge>
          )}

          {hasActiveFilters && onClearFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)]"
              onClick={onClearFilters}
            >
              {SEARCH_CLEAR_FILTERS_BUTTON_LABEL}
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-[var(--text-dim)]" />
          <span className="text-[10px] font-mono text-[var(--text-dim)]">Filters:</span>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="technology-filter" className="sr-only">
            {SEARCH_FILTER_LABELS.technology}
          </Label>
          <div className="relative">
            <Code className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-[var(--text-dim)]" />
            <Input
              id="technology-filter"
              type="text"
              placeholder="Technology..."
              value={filters.technology}
              onChange={(e) => onFiltersChange({ ...filters, technology: e.target.value })}
              aria-label={SEARCH_FILTER_LABELS.technology}
              className="h-8 w-32 pl-8 pr-2 text-xs bg-[var(--surface-mid)] border-[var(--gray-border)]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="cdn-filter" className="sr-only">
            {SEARCH_FILTER_LABELS.cdn}
          </Label>
          <div className="relative">
            <Globe className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-[var(--text-dim)]" />
            <Input
              id="cdn-filter"
              type="text"
              placeholder="CDN..."
              value={filters.cdn}
              onChange={(e) => onFiltersChange({ ...filters, cdn: e.target.value })}
              aria-label={SEARCH_FILTER_LABELS.cdn}
              className="h-8 w-28 pl-8 pr-2 text-xs bg-[var(--surface-mid)] border-[var(--gray-border)]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="server-filter" className="sr-only">
            {SEARCH_FILTER_LABELS.server}
          </Label>
          <div className="relative">
            <Server className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-[var(--text-dim)]" />
            <Input
              id="server-filter"
              type="text"
              placeholder="Server..."
              value={filters.server}
              onChange={(e) => onFiltersChange({ ...filters, server: e.target.value })}
              aria-label={SEARCH_FILTER_LABELS.server}
              className="h-8 w-28 pl-8 pr-2 text-xs bg-[var(--surface-mid)] border-[var(--gray-border)]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="plugin-filter" className="sr-only">
            {SEARCH_FILTER_LABELS.plugin}
          </Label>
          <div className="relative">
            <Blocks className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-[var(--text-dim)]" />
            <Input
              id="plugin-filter"
              type="text"
              placeholder="WP Plugin..."
              value={filters.plugin}
              onChange={(e) => onFiltersChange({ ...filters, plugin: e.target.value })}
              aria-label={SEARCH_FILTER_LABELS.plugin}
              className="h-8 w-32 pl-8 pr-2 text-xs bg-[var(--surface-mid)] border-[var(--gray-border)]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="cpe-filter" className="sr-only">
            {SEARCH_FILTER_LABELS.cpe}
          </Label>
          <div className="relative">
            <Hash className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-[var(--text-dim)]" />
            <Input
              id="cpe-filter"
              type="text"
              placeholder="CPE..."
              value={filters.cpe}
              onChange={(e) => onFiltersChange({ ...filters, cpe: e.target.value })}
              aria-label={SEARCH_FILTER_LABELS.cpe}
              className="h-8 w-28 pl-8 pr-2 text-xs bg-[var(--surface-mid)] border-[var(--gray-border)]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="status-filter" className="sr-only">
            {SEARCH_FILTER_LABELS.statusCode}
          </Label>
          <div className="relative">
            <Hash className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-[var(--text-dim)]" />
            <Input
              id="status-filter"
              type="text"
              placeholder="Status..."
              value={filters.statusCode}
              onChange={(e) => onFiltersChange({ ...filters, statusCode: e.target.value })}
              aria-label={SEARCH_FILTER_LABELS.statusCode}
              className="h-8 w-24 pl-8 pr-2 text-xs bg-[var(--surface-mid)] border-[var(--gray-border)]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="size-3.5 text-[var(--text-dim)]" />
          <Label htmlFor="from-filter" className="sr-only">
            {SEARCH_FILTER_LABELS.from}
          </Label>
          <Input
            id="from-filter"
            type="date"
            value={filters.from}
            onChange={(e) => onFiltersChange({ ...filters, from: e.target.value })}
            aria-label={SEARCH_FILTER_LABELS.from}
            className="h-8 w-[132px] px-2 text-xs bg-[var(--surface-mid)] border-[var(--gray-border)]"
          />
          <span className="text-xs text-[var(--text-dim)]">to</span>
          <Label htmlFor="to-filter" className="sr-only">
            {SEARCH_FILTER_LABELS.to}
          </Label>
          <Input
            id="to-filter"
            type="date"
            value={filters.to}
            onChange={(e) => onFiltersChange({ ...filters, to: e.target.value })}
            aria-label={SEARCH_FILTER_LABELS.to}
            className="h-8 w-[132px] px-2 text-xs bg-[var(--surface-mid)] border-[var(--gray-border)]"
          />
        </div>
      </div>
    </div>
  )
}
