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
    <div className="sticky top-0 z-30 rounded-t-xl bg-[var(--surface-dark)]/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface-dark)]/85">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <InputGroup className="min-w-0 bg-[var(--surface-mid)] border-[var(--gray-border)] sm:max-w-md sm:flex-1">
          <InputGroupAddon align="inline-start">
            <Search className="size-4 text-[var(--text-dim)]" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search runs"
            placeholder="Search latest runs..."
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

        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <Select
            value={filters.status}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, status: value as RunsStatusValue | "all" })
            }
          >
            <SelectTrigger aria-label="Status" className="h-8 w-full shrink-0 border-[var(--gray-border)] bg-[var(--surface-mid)] text-xs sm:w-36">
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
            <SelectTrigger aria-label="Source" className="h-8 w-full shrink-0 border-[var(--gray-border)] bg-[var(--surface-mid)] text-xs sm:w-36">
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

        {(showResultBadge || (hasActiveFilters && onClearFilters)) && (
          <div className="flex shrink-0 items-center gap-2 sm:ml-1">
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
        )}
      </div>
    </div>
  )
}
