"use client"

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Badge } from "@/components/ui/badge"
import { Search, X, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { HistoryStatusValue, HistorySourceValue } from "./types"
import {
  HISTORY_STATUS_LABELS,
  HISTORY_SOURCE_LABELS,
} from "./types"

interface FilterState {
  search: string
  status: HistoryStatusValue | "all"
  source: HistorySourceValue | "all"
}

interface HistoryFilterBarProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onClearFilters?: () => void
  resultCount?: number
}

export function HistoryFilterBar({
  filters,
  onFiltersChange,
  onClearFilters,
  resultCount,
}: HistoryFilterBarProps) {
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.status !== "all" ||
    filters.source !== "all"

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <InputGroup className="flex-1 max-w-md bg-[var(--surface-mid)] border-[var(--gray-border)]">
          <InputGroupAddon align="inline-start">
            <Search className="size-4 text-[var(--text-dim)]" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search scans"
            placeholder="Search scan ID, creator, technologies, or targets..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="text-[var(--foreground)] placeholder:text-[var(--text-dim)]/50"
          />
          {filters.search && (
            <InputGroupAddon align="inline-end">
              <Button
                aria-label="Clear search"
                variant="ghost"
                size="icon-xs"
                className="text-[var(--text-dim)] hover:text-[var(--foreground)]"
                onClick={() => onFiltersChange({ ...filters, search: "" })}
              >
                <X className="size-3.5" />
              </Button>
            </InputGroupAddon>
          )}
        </InputGroup>

        <div className="flex items-center gap-3">
          {resultCount !== undefined && (
            <Badge
              variant="outline"
              className="text-[10px] border-[var(--gray-border)] text-[var(--text-dim)]"
            >
              {resultCount} results
            </Badge>
          )}

          {hasActiveFilters && onClearFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)]"
              onClick={onClearFilters}
            >
              Clear
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
          <Label htmlFor="status-filter" className="text-[10px] font-mono text-[var(--text-dim)] sr-only">
            Status
          </Label>
          <select
            id="status-filter"
            value={filters.status}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as HistoryStatusValue | "all" })}
            className="h-7 px-2 text-[10px] font-mono bg-[var(--surface-mid)] border border-[var(--gray-border)] rounded text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            <option value="all">All statuses</option>
            {Object.entries(HISTORY_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="source-filter" className="text-[10px] font-mono text-[var(--text-dim)] sr-only">
            Source
          </Label>
          <select
            id="source-filter"
            value={filters.source}
            onChange={(e) => onFiltersChange({ ...filters, source: e.target.value as HistorySourceValue | "all" })}
            className="h-7 px-2 text-[10px] font-mono bg-[var(--surface-mid)] border border-[var(--gray-border)] rounded text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            <option value="all">All sources</option>
            {Object.entries(HISTORY_SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
