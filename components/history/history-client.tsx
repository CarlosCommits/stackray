"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { HistoryPageHeader } from "./history-page-header"
import { HistoryFilterBar } from "./history-filter-bar"
import { HistorySurface } from "./history-surface"
import { HistoryEmptyState } from "./history-empty-state"
import type { HistoryRow, HistoryStatusValue, HistorySourceValue, HistoryProfileValue } from "./types"

interface HistoryClientProps {
  initialRows: HistoryRow[]
  title?: string
}

interface FilterState {
  search: string
  status: HistoryStatusValue | "all"
  source: HistorySourceValue | "all"
  profile: HistoryProfileValue | "all"
}

export function HistoryClient({
  initialRows,
  title = "Scan History",
}: HistoryClientProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    source: "all",
    profile: "all",
  })

  const filteredRows = useMemo(() => {
    return initialRows.filter((row) => {
      const query = filters.search.toLowerCase().trim()

      if (query) {
        const matchesScanId = row.scanId.toLowerCase().includes(query)
        const matchesCreatedBy = row.createdBy.label.toLowerCase().includes(query)
        const matchesTechnologies = row.topTechnologies.searchTokens.some((tech) =>
          tech.toLowerCase().includes(query)
        )
        const matchesHiddenTargets = row.filters.hiddenTargets.some((target) =>
          target.toLowerCase().includes(query)
        )

        if (!matchesScanId && !matchesCreatedBy && !matchesTechnologies && !matchesHiddenTargets) {
          return false
        }
      }

      if (filters.status !== "all" && row.status.value !== filters.status) {
        return false
      }

      if (filters.source !== "all" && row.source.value !== filters.source) {
        return false
      }

      if (filters.profile !== "all" && row.filters.profile !== filters.profile) {
        return false
      }

      return true
    })
  }, [initialRows, filters])

  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.status !== "all" ||
    filters.source !== "all" ||
    filters.profile !== "all"

  const handleClearFilters = () => {
    setFilters({
      search: "",
      status: "all",
      source: "all",
      profile: "all",
    })
  }

  return (
    <div className="space-y-6">
      <HistoryPageHeader title={title} />

      <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader className="pb-4">
          <HistoryFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            resultCount={filteredRows.length}
            onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
          />
        </CardHeader>
        <CardContent>
          {filteredRows.length === 0 ? (
            <HistoryEmptyState
              hasFilters={hasActiveFilters}
              onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
            />
          ) : (
            <HistorySurface rows={filteredRows} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
