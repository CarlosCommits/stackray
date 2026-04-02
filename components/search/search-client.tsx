"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { buildSearchRows, type SearchQuery } from "@/lib/search/shared"
import { SearchPageHeader } from "./search-page-header"
import { SearchModeTabs } from "./search-mode-tabs"
import { SearchFilterBar } from "./search-filter-bar"
import { SearchEmptyState } from "./search-empty-state"
import { SearchSurface } from "./search-surface"
import type { SearchRow, SearchModeValue } from "./types"
import { SEARCH_MODE_DESCRIPTION, SEARCH_PAGE_TITLE } from "./types"

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

interface SearchClientProps {
  initialRows: SearchRow[]
  initialQuery: SearchQuery
  title?: string
}

function toDateInputValue(value: string | null): string {
  if (!value) {
    return ""
  }

  return value.slice(0, 10)
}

function buildSearchParams(filters: FilterState): Record<string, string | undefined> {
  return {
    q: filters.q.trim() || undefined,
    technology: filters.technology.trim() || undefined,
    cdn: filters.cdn.trim() || undefined,
    server: filters.server.trim() || undefined,
    plugin: filters.plugin.trim() || undefined,
    cpe: filters.cpe.trim() || undefined,
    statusCode: filters.statusCode.trim() || undefined,
    from: filters.from.trim() || undefined,
    to: filters.to.trim() || undefined,
    mode: filters.mode,
  }
}

export function SearchClient({
  initialRows,
  initialQuery,
  title = SEARCH_PAGE_TITLE,
}: SearchClientProps) {
  const [rows, setRows] = useState(initialRows)
  const [filters, setFilters] = useState<FilterState>({
    q: initialQuery?.q ?? "",
    technology: initialQuery?.technology.join(", ") ?? "",
    cdn: initialQuery?.cdn.join(", ") ?? "",
    server: initialQuery?.server.join(", ") ?? "",
    plugin: initialQuery?.plugin.join(", ") ?? "",
    cpe: initialQuery?.cpe.join(", ") ?? "",
    statusCode: initialQuery?.statusCode.join(", ") ?? "",
    from: toDateInputValue(initialQuery?.from ?? null),
    to: toDateInputValue(initialQuery?.to ?? null),
    mode: initialQuery?.mode ?? "latest",
  })

  const initialSearchParams = useMemo(() => buildSearchParams({
    q: initialQuery.q ?? "",
    technology: initialQuery.technology.join(", "),
    cdn: initialQuery.cdn.join(", "),
    server: initialQuery.server.join(", "),
    plugin: initialQuery.plugin.join(", "),
    cpe: initialQuery.cpe.join(", "),
    statusCode: initialQuery.statusCode.join(", "),
    from: toDateInputValue(initialQuery.from),
    to: toDateInputValue(initialQuery.to),
    mode: initialQuery.mode,
  }), [initialQuery])

  const searchParams = useMemo(() => buildSearchParams(filters), [filters])

  const usingInitialRows = useMemo(
    () => JSON.stringify(searchParams) === JSON.stringify(initialSearchParams),
    [initialSearchParams, searchParams],
  )

  const filteredRows = useMemo(() => (usingInitialRows ? initialRows : rows), [initialRows, rows, usingInitialRows])

  useEffect(() => {
    if (usingInitialRows) {
      return
    }

    const controller = new AbortController()
    const urlSearchParams = new URLSearchParams()

    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) {
        urlSearchParams.set(key, value)
      }
    })

    void fetch(`/api/v1/search/results?${urlSearchParams.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Search request failed.")
        }

        return response.json()
      })
      .then((response) => {
        setRows(buildSearchRows(response.items))
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return
        }

        throw error
      })

    return () => {
      controller.abort()
    }
  }, [searchParams, usingInitialRows])

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

  const handleClearFilters = () => {
    setFilters({
      q: "",
      technology: "",
      cdn: "",
      server: "",
      plugin: "",
      cpe: "",
      statusCode: "",
      from: "",
      to: "",
      mode: filters.mode,
    })
  }

  const handleModeChange = (mode: SearchModeValue) => {
    setFilters((prev) => ({ ...prev, mode }))
  }

  return (
    <div className="space-y-6">
      <SearchPageHeader title={title} />

      <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center justify-between gap-4">
              <SearchModeTabs mode={filters.mode} onModeChange={handleModeChange} />
            </div>
            <p className="text-xs text-[var(--text-dim)]">
              {SEARCH_MODE_DESCRIPTION[filters.mode]}
            </p>
          </div>
          <Separator className="mb-4" />
          <SearchFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            resultCount={filteredRows.length}
            onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
          />
        </CardHeader>
        <CardContent>
          {filteredRows.length === 0 ? (
            <SearchEmptyState
              hasFilters={hasActiveFilters}
              onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
            />
          ) : (
            <SearchSurface rows={filteredRows} mode={filters.mode} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
