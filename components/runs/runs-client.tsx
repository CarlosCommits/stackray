"use client"

import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { trackStackrayEvent } from "@/lib/analytics"
import { RunsFilterBar } from "./runs-filter-bar"
import { RunsSurface } from "./runs-surface"
import { RunsEmptyState } from "./runs-empty-state"
import type { RunsRow, RunsStatusValue, RunsSourceValue } from "./types"

type SortOrder = "newest" | "oldest"

interface RunsClientProps {
  initialRows: RunsRow[]
  initialNextCursor: string | null
}

interface FilterState {
  search: string
  status: RunsStatusValue | "all"
  source: RunsSourceValue | "all"
}

interface RunsPageResponse {
  items: RunsRow[]
  nextCursor: string | null
}

const DEBOUNCE_MS = 275
const PAGE_SIZE = 50
const RUNS_TABLE_STORAGE_KEY = "stackray:runs-table:v1"
const RUNS_STATUS_VALUES = new Set<RunsStatusValue>(["queued", "running", "completed", "failed", "cancelled"])
const RUNS_SOURCE_VALUES = new Set<RunsSourceValue>(["ui", "cli", "api", "system"])

interface StoredRunsTableState extends FilterState {
  sortOrder: SortOrder
}

const defaultRunsTableState: StoredRunsTableState = {
  search: "",
  status: "all",
  source: "all",
  sortOrder: "newest",
}

function subscribeToHydration(onStoreChange: () => void) {
  queueMicrotask(onStoreChange)
  return () => undefined
}

function getHydratedSnapshot() {
  return true
}

function getServerHydratedSnapshot() {
  return false
}

function useHasHydrated() {
  return useSyncExternalStore(subscribeToHydration, getHydratedSnapshot, getServerHydratedSnapshot)
}

function isStoredRunsTableState(value: unknown): value is StoredRunsTableState {
  if (!value || typeof value !== "object") {
    return false
  }

  const state = value as Partial<Record<keyof StoredRunsTableState, unknown>>

  return typeof state.search === "string"
    && (state.status === "all" || (typeof state.status === "string" && RUNS_STATUS_VALUES.has(state.status as RunsStatusValue)))
    && (state.source === "all" || (typeof state.source === "string" && RUNS_SOURCE_VALUES.has(state.source as RunsSourceValue)))
    && (state.sortOrder === "newest" || state.sortOrder === "oldest")
}

function readStoredRunsTableState(): StoredRunsTableState | null {
  try {
    const rawValue = window.sessionStorage.getItem(RUNS_TABLE_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    const parsedValue: unknown = JSON.parse(rawValue)

    return isStoredRunsTableState(parsedValue) ? parsedValue : null
  } catch {
    return null
  }
}

function writeStoredRunsTableState(state: StoredRunsTableState) {
  window.sessionStorage.setItem(RUNS_TABLE_STORAGE_KEY, JSON.stringify(state))
}

function isDefaultRunsTableState(state: StoredRunsTableState): boolean {
  return state.search === ""
    && state.status === "all"
    && state.source === "all"
    && state.sortOrder === "newest"
}

async function fetchRunsPage(
  search: string,
  status: RunsStatusValue | "all",
  source: RunsSourceValue | "all",
  sort: SortOrder,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<RunsPageResponse> {
  const params = new URLSearchParams()
  if (search) params.set("q", search)
  if (status !== "all") params.set("status", status)
  if (source !== "all") params.set("source", source)
  params.set("sort", sort)
  params.set("limit", String(PAGE_SIZE))
  if (cursor) params.set("cursor", cursor)

  const res = await fetch(`/api/v1/runs?${params.toString()}`, { signal })
  if (!res.ok) throw new Error(`Failed to fetch runs: ${res.statusText}`)
  return res.json()
}

export function RunsClient({
  initialRows,
  initialNextCursor,
}: RunsClientProps) {
  const hasHydrated = useHasHydrated()
  const restoredTableState = useMemo(
    () => hasHydrated ? readStoredRunsTableState() : null,
    [hasHydrated],
  )
  const [tableStateOverride, setTableStateOverride] = useState<StoredRunsTableState | null>(null)
  const tableState = tableStateOverride ?? restoredTableState ?? defaultRunsTableState
  const filters = useMemo<FilterState>(() => ({
    search: tableState.search,
    status: tableState.status,
    source: tableState.source,
  }), [tableState])
  const sortOrder = tableState.sortOrder

  const [rows, setRows] = useState<RunsRow[]>(initialRows)
  const [cursor, setCursor] = useState<string | null>(initialNextCursor)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialNextCursor !== null)
  const [error, setError] = useState<string | null>(null)

  const [serverQueryKey, setServerQueryKey] = useState<string>("")
  const isUsingServerData = serverQueryKey !== ""

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeQueryKeyRef = useRef("")
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search)

  const clearSearchDebounce = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }

  const updateTableState = useCallback((nextFilters: FilterState) => {
    setTableStateOverride((current) => ({
      ...(current ?? restoredTableState ?? defaultRunsTableState),
      ...nextFilters,
    }))
  }, [restoredTableState])

  const updateSortOrder = useCallback((updater: (current: SortOrder) => SortOrder) => {
    setTableStateOverride((current) => {
      const previous = current ?? restoredTableState ?? defaultRunsTableState
      return {
        ...previous,
        sortOrder: updater(previous.sortOrder),
      }
    })
  }, [restoredTableState])

  useEffect(() => {
    if (!hasHydrated) {
      return
    }

    const state = {
      ...filters,
      sortOrder,
    }

    if (isDefaultRunsTableState(state)) {
      window.sessionStorage.removeItem(RUNS_TABLE_STORAGE_KEY)
      return
    }

    writeStoredRunsTableState(state)
  }, [filters, hasHydrated, sortOrder])

  // Update debounced search when filter.search changes
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(filters.search)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [filters.search])

  // Fetch first page when filters/sort change (reset pagination)
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const requestQueryKey = `${debouncedSearch}-${filters.status}-${filters.source}-${sortOrder}`

    const doFetch = async () => {
      activeQueryKeyRef.current = requestQueryKey
      setIsLoading(true)
      setError(null)
      setCursor(null)
      setHasMore(false)
      setServerQueryKey("")
      try {
        const data = await fetchRunsPage(
          debouncedSearch,
          filters.status,
          filters.source,
          sortOrder,
          null,
          controller.signal,
        )
        if (!cancelled && activeQueryKeyRef.current === requestQueryKey) {
          setRows(data.items)
          setCursor(data.nextCursor)
          setHasMore(data.nextCursor !== null)
          setServerQueryKey(requestQueryKey)

          if (debouncedSearch.trim().length > 0) {
            trackStackrayEvent("search_performed", {
              surface: "runs",
              has_status_filter: filters.status !== "all",
              has_source_filter: filters.source !== "all",
              sort: sortOrder,
              result_count: data.items.length,
              has_more: data.nextCursor !== null,
            })
          }
        }
      } catch (err) {
        if (!cancelled && activeQueryKeyRef.current === requestQueryKey) {
          setError(err instanceof Error ? err.message : "Failed to fetch runs")
        }
      } finally {
        if (!cancelled && activeQueryKeyRef.current === requestQueryKey) {
          setIsLoading(false)
        }
      }
    }

    // Always fetch when sort changes to get properly sorted data from server
    if (debouncedSearch || filters.status !== "all" || filters.source !== "all" || sortOrder !== "newest") {
      doFetch()
    } else {
      // Reset to initial rows when no filters active and sort is default
      activeQueryKeyRef.current = ""
      queueMicrotask(() => {
        if (cancelled) return
        setRows(initialRows)
        setCursor(initialNextCursor)
        setHasMore(initialNextCursor !== null)
        setServerQueryKey("")
      })
    }

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [debouncedSearch, filters.status, filters.source, sortOrder, initialRows, initialNextCursor])

  const handleLoadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore || !cursor) return

    setIsLoadingMore(true)
    setError(null)
    const requestQueryKey = activeQueryKeyRef.current
    try {
      const data = await fetchRunsPage(
        debouncedSearch,
        filters.status,
        filters.source,
        sortOrder,
        cursor,
        undefined,
      )
      if (activeQueryKeyRef.current === requestQueryKey) {
        setRows((prev) => [...prev, ...data.items])
        setCursor(data.nextCursor)
        setHasMore(data.nextCursor !== null)
      }
    } catch (err) {
      if (activeQueryKeyRef.current === requestQueryKey) {
        setError(err instanceof Error ? err.message : "Failed to fetch more runs")
      }
    } finally {
      setIsLoadingMore(false)
    }
  }, [debouncedSearch, filters.status, filters.source, sortOrder, cursor, isLoading, isLoadingMore, hasMore])

  const hasActiveSearch = filters.search.trim().length > 0

  const hasActiveFilters =
    hasActiveSearch ||
    filters.status !== "all" ||
    filters.source !== "all"
  const hasActiveDropdownFilters =
    filters.status !== "all" ||
    filters.source !== "all"

  // Show total count only when using server data (filtered/paginated)
  const displayCount = isUsingServerData && !hasMore ? rows.length : undefined

  const handleClearFilters = () => {
    window.sessionStorage.removeItem(RUNS_TABLE_STORAGE_KEY)
    clearSearchDebounce()
    setTableStateOverride({
      search: "",
      status: "all",
      source: "all",
      sortOrder: "newest",
    })
    setDebouncedSearch("")
  }

  const toggleSortOrder = () => {
    updateSortOrder((current) => (current === "newest" ? "oldest" : "newest"))
  }

  const isEmpty = rows.length === 0 && !isLoading

  return (
    <div>
      <Card size="sm" className="gap-3 overflow-visible bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader className="contents">
            <RunsFilterBar
              filters={filters}
              onFiltersChange={updateTableState}
            resultCount={displayCount}
            onClearFilters={hasActiveDropdownFilters ? handleClearFilters : undefined}
            hasActiveSearch={hasActiveSearch}
          />
        </CardHeader>
        <CardContent>
          {isEmpty ? (
            <RunsEmptyState
              hasFilters={hasActiveFilters}
              onClearFilters={hasActiveDropdownFilters ? handleClearFilters : undefined}
            />
          ) : (
            <>
              <RunsSurface rows={rows} sortOrder={sortOrder} onToggleSortOrder={toggleSortOrder} isLoading={isLoading} />
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
