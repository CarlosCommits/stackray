"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { TargetResultItem } from "@/lib/contracts/targets"
import { buildTargetRows, TARGETS_DEFAULT_PAGE_LIMIT, type TargetQuery } from "@/lib/targets/shared"
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
  initialNextCursor: string | null
  initialQuery: TargetQuery
}

interface TargetsPageResponse {
  items: TargetResultItem[]
  nextCursor: string | null
}

const DEBOUNCE_MS = 275

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

async function fetchTargetsPage(
  searchParams: Record<string, string | undefined>,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<TargetsPageResponse> {
  const urlSearchParams = new URLSearchParams()

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value) {
      urlSearchParams.set(key, value)
    }
  })

  urlSearchParams.set("limit", String(TARGETS_DEFAULT_PAGE_LIMIT))

  if (cursor) {
    urlSearchParams.set("cursor", cursor)
  }

  const response = await fetch(`/api/v1/targets/results?${urlSearchParams.toString()}`, {
    signal,
  })

  if (!response.ok) {
    throw new Error("Target request failed.")
  }

  return response.json()
}

export function TargetsClient({
  initialRows,
  initialNextCursor,
  initialQuery,
}: TargetsClientProps) {
  const [rows, setRows] = useState(initialRows)
  const [cursor, setCursor] = useState<string | null>(initialNextCursor)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialNextCursor !== null)
  const [error, setError] = useState<string | null>(null)
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
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeQueryKeyRef = useRef("")
  const [debouncedSearch, setDebouncedSearch] = useState(filters.q)

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(filters.q)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [filters.q])

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

  const searchParams = useMemo(
    () => buildTargetsSearchParams({
      ...filters,
      q: debouncedSearch,
    }),
    [debouncedSearch, filters],
  )
  const liveSearchParams = useMemo(() => buildTargetsSearchParams(filters), [filters])
  const initialQueryKey = useMemo(() => JSON.stringify(initialSearchParams), [initialSearchParams])
  const requestQueryKey = useMemo(() => JSON.stringify(searchParams), [searchParams])
  const liveQueryKey = useMemo(() => JSON.stringify(liveSearchParams), [liveSearchParams])
  const [settledQueryKey, setSettledQueryKey] = useState(initialQueryKey)

  const usingInitialRows = useMemo(
    () => requestQueryKey === initialQueryKey,
    [initialQueryKey, requestQueryKey],
  )

  const isShowingSettledRows = liveQueryKey === settledQueryKey

  useEffect(() => {
    let cancelled = false

    if (usingInitialRows) {
      activeQueryKeyRef.current = ""
      queueMicrotask(() => {
        if (cancelled) return
        setRows(initialRows)
        setCursor(initialNextCursor)
        setHasMore(initialNextCursor !== null)
        setIsLoading(false)
        setIsLoadingMore(false)
        setError(null)
        setSettledQueryKey(initialQueryKey)
      })
      return () => {
        cancelled = true
      }
    }

    const controller = new AbortController()

    const doFetch = async () => {
      activeQueryKeyRef.current = requestQueryKey
      setIsLoading(true)
      setError(null)
      setCursor(null)
      setHasMore(false)

      try {
        const response = await fetchTargetsPage(searchParams, null, controller.signal)

        if (!cancelled && activeQueryKeyRef.current === requestQueryKey) {
          setRows(buildTargetRows(response.items))
          setCursor(response.nextCursor)
          setHasMore(response.nextCursor !== null)
          setSettledQueryKey(requestQueryKey)
        }
      } catch (fetchError) {
        if (!cancelled && activeQueryKeyRef.current === requestQueryKey) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch targets")
        }
      } finally {
        if (!cancelled && activeQueryKeyRef.current === requestQueryKey) {
          setIsLoading(false)
        }
      }
    }

    void doFetch()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [initialNextCursor, initialQueryKey, initialRows, requestQueryKey, searchParams, usingInitialRows])

  const handleLoadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore || !cursor) {
      return
    }

    setIsLoadingMore(true)
    setError(null)
    const requestQueryKey = activeQueryKeyRef.current

    try {
      const response = await fetchTargetsPage(searchParams, cursor)

      if (activeQueryKeyRef.current === requestQueryKey) {
        setRows((previous) => [...previous, ...buildTargetRows(response.items)])
        setCursor(response.nextCursor)
        setHasMore(response.nextCursor !== null)
      }
    } catch (fetchError) {
      if (activeQueryKeyRef.current === requestQueryKey) {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch more targets")
      }
    } finally {
      setIsLoadingMore(false)
    }
  }, [cursor, hasMore, isLoading, isLoadingMore, searchParams])

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

  const displayCount = hasActiveFilters && isShowingSettledRows && !isLoading && !hasMore ? rows.length : undefined

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
    <div>
      <Card size="sm" className="gap-3 bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader className="pb-0">
          <TargetsFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            resultCount={displayCount}
            onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
          />
        </CardHeader>
        <CardContent>
          {rows.length === 0 && !isLoading ? (
            <TargetsEmptyState
              hasFilters={hasActiveFilters}
              onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
            />
          ) : (
            <>
              <TargetsSurface rows={rows} />
              {hasMore && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isLoading || isLoadingMore}
                    className="min-w-[120px] border-[var(--gray-border)] bg-[var(--surface-mid)] text-[var(--foreground)] hover:bg-[var(--surface-light)]"
                  >
                    {isLoadingMore ? "Loading..." : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
          {error && (
            <p className="mt-4 text-center text-sm text-red-400">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
