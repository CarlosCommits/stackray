"use client"

import { Search, X } from "lucide-react"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { RunsStatusValue, RunsSourceValue } from "./types"
import { RUNS_STATUS_LABELS, RUNS_SOURCE_LABELS } from "./types"

interface FilterState {
  search: string
  status: RunsStatusValue | "all"
  source: RunsSourceValue | "all"
}

interface RunsFilterBarProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onClearFilters?: () => void
  resultCount?: number
  hasActiveFilters: boolean
  hasActiveSearch: boolean
}

export function RunsFilterBar({
  filters,
  onFiltersChange,
  onClearFilters,
  resultCount,
  hasActiveFilters,
  hasActiveSearch,
}: RunsFilterBarProps) {
  const showResultBadge = hasActiveSearch && resultCount !== undefined
  const resultLabel = resultCount === 1 ? "1 run" : `${resultCount} runs`

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <InputGroup className="flex-1 max-w-md min-w-0 bg-[var(--surface-mid)] border-[var(--gray-border)]">
          <InputGroupAddon align="inline-start">
            <Search className="size-4 text-[var(--text-dim)]" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search runs"
            placeholder="Search by scan ID, creator, technology, or target..."
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

        <Select
          value={filters.status}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, status: value as RunsStatusValue | "all" })
          }
        >
          <SelectTrigger aria-label="Status" className="h-8 w-36 text-xs shrink-0 bg-[var(--surface-mid)] border-[var(--gray-border)]">
            <SelectValue placeholder="Status..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(RUNS_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.source}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, source: value as RunsSourceValue | "all" })
          }
        >
          <SelectTrigger aria-label="Source" className="h-8 w-36 text-xs shrink-0 bg-[var(--surface-mid)] border-[var(--gray-border)]">
            <SelectValue placeholder="Source..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {Object.entries(RUNS_SOURCE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {showResultBadge && (
          <Badge variant="outline" className="text-[10px] border-[var(--gray-border)] text-[var(--text-dim)]">
            {resultLabel}
          </Badge>
        )}

        {hasActiveFilters && onClearFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)]"
            onClick={onClearFilters}
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}
