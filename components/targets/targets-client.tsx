"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { trackStackrayEvent } from "@/lib/analytics"
import type { TargetFilterOptionsResponse, TargetResultItem } from "@/lib/contracts/targets"
import { buildTargetRows, TARGETS_DEFAULT_PAGE_LIMIT, type TargetQuery } from "@/lib/targets/shared"
import { formatDateOnlyInTimeZone } from "@/lib/time"
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
  initialFilterOptions: TargetFilterOptionsResponse
}

interface TargetsPageResponse {
  items: TargetResultItem[]
  nextCursor: string | null
}

interface TargetFilterOptionValue {
  label: string
  value: string
  matchCount: number
}

const DEBOUNCE_MS = 275
const TARGETS_TABLE_STORAGE_KEY = "stackray:targets-table:v1"

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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isTargetFilterOption(value: unknown): value is TargetFilterOptionValue {
  if (!value || typeof value !== "object") {
    return false
  }

  const option = value as Partial<TargetFilterOptionValue>

  return typeof option.label === "string"
    && typeof option.value === "string"
    && typeof option.matchCount === "number"
    && Number.isInteger(option.matchCount)
    && option.matchCount >= 0
}

function isTargetFilterOptionArray(value: unknown): value is TargetFilterOptionValue[] {
  return Array.isArray(value) && value.every(isTargetFilterOption)
}

function isTargetFilterOptionsResponse(value: unknown): value is TargetFilterOptionsResponse {
  if (!value || typeof value !== "object") {
    return false
  }

  const options = value as Partial<Record<keyof TargetFilterOptionsResponse, unknown>>

  return isTargetFilterOptionArray(options.technology)
    && isTargetFilterOptionArray(options.cdn)
    && isTargetFilterOptionArray(options.server)
    && isTargetFilterOptionArray(options.plugin)
    && isTargetFilterOptionArray(options.theme)
    && isTargetFilterOptionArray(options.cpe)
    && isTargetFilterOptionArray(options.statusCode)
}

function isStoredTargetsTableState(value: unknown): value is TargetsFilterState {
  if (!value || typeof value !== "object") {
    return false
  }

  const state = value as Partial<Record<keyof TargetsFilterState, unknown>>

  return typeof state.q === "string"
    && isStringArray(state.technology)
    && isStringArray(state.cdn)
    && isStringArray(state.server)
    && isStringArray(state.plugin)
    && isStringArray(state.theme)
    && isStringArray(state.cpe)
    && isStringArray(state.statusCode)
    && typeof state.from === "string"
    && typeof state.to === "string"
}

function readStoredTargetsTableState(): TargetsFilterState | null {
  try {
    const rawValue = window.sessionStorage.getItem(TARGETS_TABLE_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    const parsedValue: unknown = JSON.parse(rawValue)

    return isStoredTargetsTableState(parsedValue) ? parsedValue : null
  } catch {
    return null
  }
}

function isDefaultTargetsTableState(state: TargetsFilterState): boolean {
  return state.q === ""
    && state.technology.length === 0
    && state.cdn.length === 0
    && state.server.length === 0
    && state.plugin.length === 0
    && state.theme.length === 0
    && state.cpe.length === 0
    && state.statusCode.length === 0
    && state.from === ""
    && state.to === ""
}

function writeStoredTargetsTableState(state: TargetsFilterState) {
  if (isDefaultTargetsTableState(state)) {
    window.sessionStorage.removeItem(TARGETS_TABLE_STORAGE_KEY)
    return
  }

  window.sessionStorage.setItem(TARGETS_TABLE_STORAGE_KEY, JSON.stringify(state))
}

function toDateInputValue(value: string | null, timeZone: string | null = null): string {
  if (!value) {
    return ""
  }

  return formatDateOnlyInTimeZone(value, timeZone ?? undefined) ?? ""
}

function buildTargetsSearchParams(
  filters: TargetsFilterState,
  timeZone: string | null = null,
): Record<string, string | undefined> {
  const hasDateFilter = filters.from.trim().length > 0 || filters.to.trim().length > 0

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
    timeZone: hasDateFilter ? timeZone ?? undefined : undefined,
  }
}

function countActiveTargetSearchFilters(searchParams: Record<string, string | undefined>) {
  return Object.entries(searchParams)
    .filter(([key, value]) => key !== "q" && key !== "timeZone" && typeof value === "string" && value.length > 0)
    .length
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

async function fetchTargetFilterOptions(): Promise<TargetFilterOptionsResponse> {
  const response = await fetch("/api/v1/targets/filter-options")

  if (!response.ok) {
    throw new Error("Target filter options request failed.")
  }

  const data: unknown = await response.json()

  if (!isTargetFilterOptionsResponse(data)) {
    throw new Error("Target filter options response was invalid.")
  }

  return data
}

export function TargetsClient({
  initialRows,
  initialNextCursor,
  initialQuery,
  initialFilterOptions,
}: TargetsClientProps) {
  const initialFilters = useMemo<TargetsFilterState>(() => ({
    q: initialQuery?.q ?? "",
    technology: initialQuery?.technology ?? [],
    cdn: initialQuery?.cdn ?? [],
    server: initialQuery?.server ?? [],
    plugin: initialQuery?.plugin ?? [],
    theme: initialQuery?.theme ?? [],
    cpe: initialQuery?.cpe ?? [],
    statusCode: initialQuery?.statusCode.map(String) ?? [],
    from: toDateInputValue(initialQuery?.from ?? null, initialQuery?.timeZone ?? null),
    to: toDateInputValue(initialQuery?.to ?? null, initialQuery?.timeZone ?? null),
  }), [initialQuery])
  const hasHydrated = useHasHydrated()
  const restoredFilters = useMemo(
    () => hasHydrated && isDefaultTargetsTableState(initialFilters)
      ? readStoredTargetsTableState()
      : null,
    [hasHydrated, initialFilters],
  )
  const [filterOverride, setFilterOverride] = useState<TargetsFilterState | null>(null)
  const filters = filterOverride ?? restoredFilters ?? initialFilters
  const [rows, setRows] = useState(initialRows)
  const [cursor, setCursor] = useState<string | null>(initialNextCursor)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialNextCursor !== null)
  const [error, setError] = useState<string | null>(null)
  const [filterOptions, setFilterOptions] = useState(initialFilterOptions)
  const [hasLoadedFilterOptions, setHasLoadedFilterOptions] = useState(() => isDefaultTargetsTableState(initialFilters))
  const [isLoadingFilterOptions, setIsLoadingFilterOptions] = useState(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeQueryKeyRef = useRef("")
  const [debouncedSearch, setDebouncedSearch] = useState(filters.q)

  const clearSearchDebounce = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }

  useEffect(() => {
    if (!hasHydrated) {
      return
    }

    writeStoredTargetsTableState(filters)
  }, [filters, hasHydrated])

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
      from: toDateInputValue(initialQuery.from, initialQuery.timeZone),
      to: toDateInputValue(initialQuery.to, initialQuery.timeZone),
    }, initialQuery.timeZone),
    [initialQuery],
  )

  const searchParams = useMemo(
    () => buildTargetsSearchParams({
      ...filters,
      q: debouncedSearch,
    }, initialQuery.timeZone),
    [debouncedSearch, filters, initialQuery.timeZone],
  )
  const initialQueryKey = useMemo(() => JSON.stringify(initialSearchParams), [initialSearchParams])
  const requestQueryKey = useMemo(() => JSON.stringify(searchParams), [searchParams])

  const usingInitialRows = useMemo(
    () => requestQueryKey === initialQueryKey,
    [initialQueryKey, requestQueryKey],
  )

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

          if (debouncedSearch.trim().length > 0) {
            trackStackrayEvent("search_performed", {
              surface: "targets",
              filter_count: countActiveTargetSearchFilters(searchParams),
              result_count: response.items.length,
              has_more: response.nextCursor !== null,
            })
          }
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
  }, [debouncedSearch, initialNextCursor, initialRows, requestQueryKey, searchParams, usingInitialRows])

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

  const handleClearFilters = () => {
    window.sessionStorage.removeItem(TARGETS_TABLE_STORAGE_KEY)
    clearSearchDebounce()
    setFilterOverride({
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
    setDebouncedSearch("")
  }

  const handleFilterOptionsRequest = useCallback(async () => {
    if (hasLoadedFilterOptions || isLoadingFilterOptions) {
      return
    }

    setIsLoadingFilterOptions(true)

    try {
      const nextFilterOptions = await fetchTargetFilterOptions()
      setFilterOptions(nextFilterOptions)
      setHasLoadedFilterOptions(true)
    } catch {
      setHasLoadedFilterOptions(false)
    } finally {
      setIsLoadingFilterOptions(false)
    }
  }, [hasLoadedFilterOptions, isLoadingFilterOptions])

  return (
    <div>
      <Card size="sm" className="gap-3 overflow-visible bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader className="contents">
            <TargetsFilterBar
              filters={filters}
              onFiltersChange={setFilterOverride}
            filterOptions={filterOptions}
            onFilterOptionsRequest={handleFilterOptionsRequest}
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
