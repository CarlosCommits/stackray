"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { buildTargetRows, type TargetQuery } from "@/lib/targets/shared"
import { TargetsFilterBar } from "./targets-filter-bar"
import { TargetsEmptyState } from "./targets-empty-state"
import { TargetsSurface } from "./targets-surface"
import type { TargetsRow } from "./types"

interface TargetsFilterState {
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

interface TargetsClientProps {
  initialRows: TargetsRow[]
  initialQuery: TargetQuery
}

function toDateInputValue(value: string | null): string {
  if (!value) {
    return ""
  }

  return value.slice(0, 10)
}

function buildTargetsSearchParams(filters: TargetsFilterState): Record<string, string | undefined> {
  return {
    q: filters.q.trim() || undefined,
    technology: filters.technology.length > 0 ? filters.technology.join(", ") : undefined,
    cdn: filters.cdn.length > 0 ? filters.cdn.join(", ") : undefined,
    server: filters.server.length > 0 ? filters.server.join(", ") : undefined,
    plugin: filters.plugin.length > 0 ? filters.plugin.join(", ") : undefined,
    theme: filters.theme.length > 0 ? filters.theme.join(", ") : undefined,
    cpe: filters.cpe.length > 0 ? filters.cpe.join(", ") : undefined,
    statusCode: filters.statusCode.length > 0 ? filters.statusCode.join(", ") : undefined,
    from: filters.from.trim() || undefined,
    to: filters.to.trim() || undefined,
  }
}

export function TargetsClient({
  initialRows,
  initialQuery,
}: TargetsClientProps) {
  const [rows, setRows] = useState(initialRows)
  const [filters, setFilters] = useState<TargetsFilterState>({
    q: initialQuery?.q ?? "",
    technology: initialQuery?.technology ?? [],
    cdn: initialQuery?.cdn ?? [],
    server: initialQuery?.server ?? [],
    plugin: initialQuery?.plugin ?? [],
    theme: initialQuery?.theme ?? [],
    cpe: initialQuery?.cpe ?? [],
    statusCode: initialQuery?.statusCode.map(String) ?? [],
    from: toDateInputValue(initialQuery?.from ?? null),
    to: toDateInputValue(initialQuery?.to ?? null),
  })

  const initialSearchParams = useMemo(
    () => buildTargetsSearchParams({
      q: initialQuery.q ?? "",
      technology: initialQuery.technology,
      cdn: initialQuery.cdn,
      server: initialQuery.server,
      plugin: initialQuery.plugin,
      theme: initialQuery.theme,
      cpe: initialQuery.cpe,
      statusCode: initialQuery.statusCode.map(String),
      from: toDateInputValue(initialQuery.from),
      to: toDateInputValue(initialQuery.to),
    }),
    [initialQuery],
  )

  const searchParams = useMemo(() => buildTargetsSearchParams(filters), [filters])

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

    void fetch(`/api/v1/targets/results?${urlSearchParams.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Target request failed.")
        }

        return response.json()
      })
      .then((response) => {
        setRows(buildTargetRows(response.items))
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
    filters.technology.length > 0 ||
    filters.cdn.length > 0 ||
    filters.server.length > 0 ||
    filters.plugin.length > 0 ||
    filters.theme.length > 0 ||
    filters.cpe.length > 0 ||
    filters.statusCode.length > 0 ||
    filters.from.trim().length > 0 ||
    filters.to.trim().length > 0

  const handleClearFilters = () => {
    setFilters({
      q: "",
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
  }

  return (
    <div className="space-y-6">
      <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader className="pb-4">
          <TargetsFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            resultCount={filteredRows.length}
            onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
          />
        </CardHeader>
        <CardContent>
          {filteredRows.length === 0 ? (
            <TargetsEmptyState
              hasFilters={hasActiveFilters}
              onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
            />
          ) : (
            <TargetsSurface rows={filteredRows} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
