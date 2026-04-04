"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { RunsPageHeader } from "./runs-page-header"
import { RunsFilterBar } from "./runs-filter-bar"
import { RunsSurface } from "./runs-surface"
import { RunsEmptyState } from "./runs-empty-state"
import type { RunsRow, RunsStatusValue, RunsSourceValue } from "./types"

interface RunsClientProps {
  initialRows: RunsRow[]
  title?: string
}

interface FilterState {
  search: string
  status: RunsStatusValue | "all"
  source: RunsSourceValue | "all"
}

export function RunsClient({
  initialRows,
  title = "Scan Runs",
}: RunsClientProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    source: "all",
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
        const matchesTargetUrls = row.targetUrls.some((url) =>
          url.toLowerCase().includes(query)
        )

        if (!matchesScanId && !matchesCreatedBy && !matchesTechnologies && !matchesHiddenTargets && !matchesTargetUrls) {
          return false
        }
      }

      if (filters.status !== "all" && row.status.value !== filters.status) {
        return false
      }

      if (filters.source !== "all" && row.source.value !== filters.source) {
        return false
      }

      return true
    })
  }, [initialRows, filters])

  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.status !== "all" ||
    filters.source !== "all"

  const handleClearFilters = () => {
    setFilters({
      search: "",
      status: "all",
      source: "all",
    })
  }

  return (
    <div className="space-y-6">
      <RunsPageHeader title={title} />

      <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader className="pb-4">
          <RunsFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            resultCount={filteredRows.length}
            onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
          />
        </CardHeader>
        <CardContent>
          {filteredRows.length === 0 ? (
            <RunsEmptyState
              hasFilters={hasActiveFilters}
              onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
            />
          ) : (
            <RunsSurface rows={filteredRows} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
