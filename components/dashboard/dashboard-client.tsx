"use client"

import { useEffect, useMemo, useReducer, useState } from "react"
import { useRouter } from "next/navigation"

import { OverviewMetrics } from "@/components/dashboard/overview-metrics"
import { RecentScanSequence } from "@/components/dashboard/recent-scan-sequence"
import { SearchCommandBar } from "@/components/dashboard/search-command-bar"
import type { RecentScan, RecentScansPage, Stat } from "@/components/dashboard/types"
import {
  DASHBOARD_INITIAL_RECENT_SCAN_LIMIT,
  DASHBOARD_RECENT_SCAN_PAGE_SIZE,
} from "@/lib/dashboard/recent-scan-pagination"

interface DashboardClientProps {
  initialRecentScans: RecentScan[]
  initialRecentScansNextCursor: string | null
  stats: Stat[]
  demoMode?: boolean
}

const ACTIVE_SCAN_REFRESH_INTERVAL_MS = 2_500

interface RecentScansServerWindow {
  scans: RecentScan[]
  nextCursor: string | null
}

interface RecentScansState {
  serverWindow: RecentScansServerWindow
  optimisticScans: RecentScan[]
}

type RecentScansAction =
  | {
    type: "props-refreshed"
    scans: RecentScan[]
    nextCursor: string | null
  }
  | {
    type: "poll-refreshed"
    page: RecentScansPage
    loadedScanLimit: number
  }
  | {
    type: "page-loaded"
    page: RecentScansPage
  }
  | {
    type: "scan-queued"
    scan: RecentScan
  }

async function fetchRecentScansPage({
  cursor,
  limit,
  signal,
}: {
  cursor: string | null
  limit: number
  signal?: AbortSignal
}): Promise<RecentScansPage> {
  const params = new URLSearchParams({ limit: String(limit) })

  if (cursor) {
    params.set("cursor", cursor)
  }

  const response = await fetch(`/api/v1/dashboard/recent-scans?${params.toString()}`, { signal })

  if (!response.ok) {
    throw new Error("Recent scans request failed.")
  }

  return response.json()
}

async function fetchRecentScansWindow({
  limit,
  signal,
}: {
  limit: number
  signal?: AbortSignal
}): Promise<RecentScansPage> {
  const items: RecentScan[] = []
  let cursor: string | null = null
  let nextCursor: string | null = null

  while (items.length < limit) {
    const page = await fetchRecentScansPage({
      cursor,
      limit: Math.min(DASHBOARD_RECENT_SCAN_PAGE_SIZE, limit - items.length),
      signal,
    })

    items.push(...page.items)
    nextCursor = page.nextCursor

    if (!nextCursor || page.items.length === 0) {
      break
    }

    cursor = nextCursor
  }

  return { items, nextCursor }
}

function mergeRecentScans(current: RecentScan[], nextItems: RecentScan[]) {
  const seen = new Set(current.map((scan) => scan.id))
  return [
    ...current,
    ...nextItems.filter((scan) => {
      if (seen.has(scan.id)) {
        return false
      }

      seen.add(scan.id)
      return true
    }),
  ]
}

function mergeRefreshedRecentScans(current: RecentScan[], refreshedItems: RecentScan[]) {
  const refreshedIds = new Set(refreshedItems.map((scan) => scan.id))
  return [
    ...preserveUnchangedRecentScans(current, refreshedItems),
    ...current.filter((scan) => !refreshedIds.has(scan.id)),
  ]
}

function areRecentScanItemsEqual(current: RecentScan, next: RecentScan) {
  return current.id === next.id
    && current.target === next.target
    && current.ip === next.ip
    && current.status === next.status
    && current.phase === next.phase
    && current.phaseLabel === next.phaseLabel
    && current.phaseDescription === next.phaseDescription
    && current.timestamp === next.timestamp
    && current.progress === next.progress
    && current.error === next.error
    && current.isNew === next.isNew
    && current.statusCode === next.statusCode
    && current.server === next.server
    && current.cdn === next.cdn
    && current.redirectCount === next.redirectCount
    && current.responseTimeMs === next.responseTimeMs
    && current.techCount === next.techCount
    && current.faviconUrl === next.faviconUrl
}

function areRecentScansEqual(current: RecentScan[], next: RecentScan[]) {
  if (current.length !== next.length) {
    return false
  }

  return current.every((currentScan, index) => {
    const nextScan = next[index]

    if (!nextScan) {
      return false
    }

    return areRecentScanItemsEqual(currentScan, nextScan)
  })
}

function preserveUnchangedRecentScans(current: RecentScan[], next: RecentScan[]) {
  const currentById = new Map(current.map((scan) => [scan.id, scan]))

  return next.map((nextScan) => {
    const currentScan = currentById.get(nextScan.id)

    if (currentScan && areRecentScanItemsEqual(currentScan, nextScan)) {
      return currentScan
    }

    return nextScan
  })
}

function pruneOptimisticRecentScans(optimisticScans: RecentScan[], serverScans: RecentScan[]) {
  const serverScanIds = new Set(serverScans.map((scan) => scan.id))
  return optimisticScans.filter((scan) => !serverScanIds.has(scan.id))
}

function recentScansReducer(state: RecentScansState, action: RecentScansAction): RecentScansState {
  switch (action.type) {
    case "props-refreshed": {
      const refreshedScanIds = new Set(action.scans.map((scan) => scan.id))
      const hasLoadedRowsBeyondRefresh = state.serverWindow.scans.some((scan) => !refreshedScanIds.has(scan.id))
      const serverWindow = {
        scans: mergeRefreshedRecentScans(state.serverWindow.scans, action.scans),
        nextCursor: hasLoadedRowsBeyondRefresh ? state.serverWindow.nextCursor : action.nextCursor,
      }

      return {
        serverWindow,
        optimisticScans: pruneOptimisticRecentScans(state.optimisticScans, serverWindow.scans),
      }
    }

    case "poll-refreshed": {
      if (state.serverWindow.scans.length > action.loadedScanLimit) {
        return state
      }

      if (
        state.serverWindow.nextCursor === action.page.nextCursor
        && areRecentScansEqual(state.serverWindow.scans, action.page.items)
      ) {
        return state
      }

      const serverWindow = {
        scans: preserveUnchangedRecentScans(state.serverWindow.scans, action.page.items),
        nextCursor: action.page.nextCursor,
      }

      return {
        serverWindow,
        optimisticScans: pruneOptimisticRecentScans(state.optimisticScans, serverWindow.scans),
      }
    }

    case "page-loaded": {
      const serverWindow = {
        scans: mergeRecentScans(state.serverWindow.scans, action.page.items),
        nextCursor: action.page.nextCursor,
      }

      return {
        serverWindow,
        optimisticScans: pruneOptimisticRecentScans(state.optimisticScans, serverWindow.scans),
      }
    }

    case "scan-queued":
      return {
        ...state,
        optimisticScans: [
          action.scan,
          ...state.optimisticScans.filter((scan) => scan.id !== action.scan.id),
        ],
      }
  }
}

export function DashboardClient({
  initialRecentScans,
  initialRecentScansNextCursor,
  stats,
  demoMode = false,
}: DashboardClientProps) {
  const { refresh } = useRouter()
  const [{ serverWindow, optimisticScans }, dispatchRecentScans] = useReducer(recentScansReducer, {
    serverWindow: {
      scans: initialRecentScans,
      nextCursor: initialRecentScansNextCursor,
    },
    optimisticScans: [],
  })
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const { scans: serverScans, nextCursor } = serverWindow

  const loadedRecentScans = useMemo(() => {
    const serverScanIds = new Set(serverScans.map((scan) => scan.id))
    const pendingScans = optimisticScans.filter((scan) => !serverScanIds.has(scan.id))

    return [...pendingScans, ...serverScans]
  }, [serverScans, optimisticScans])
  const hasActiveRecentScan = useMemo(
    () => loadedRecentScans.some((scan) => scan.status === "analyzing"),
    [loadedRecentScans],
  )
  const loadedScanLimit = useMemo(
    () => Math.max(DASHBOARD_INITIAL_RECENT_SCAN_LIMIT, loadedRecentScans.length),
    [loadedRecentScans.length],
  )

  useEffect(() => {
    dispatchRecentScans({
      type: "props-refreshed",
      scans: initialRecentScans,
      nextCursor: initialRecentScansNextCursor,
    })
  }, [initialRecentScans, initialRecentScansNextCursor])

  useEffect(() => {
    if (!hasActiveRecentScan) {
      return
    }

    let activePollController: AbortController | null = null

    const interval = window.setInterval(() => {
      activePollController?.abort()
      const pollController = new AbortController()
      activePollController = pollController

      fetchRecentScansWindow({ limit: loadedScanLimit, signal: pollController.signal })
        .then((page) => {
          if (pollController.signal.aborted || activePollController !== pollController) {
            return
          }

          dispatchRecentScans({ type: "poll-refreshed", page, loadedScanLimit })
        })
        .catch((error: unknown) => {
          if (
            pollController.signal.aborted
            || (error instanceof DOMException && error.name === "AbortError")
          ) {
            return
          }

          refresh()
        })
    }, ACTIVE_SCAN_REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
      activePollController?.abort()
    }
  }, [hasActiveRecentScan, loadedScanLimit, refresh])

  const handleScanQueued = (scan: RecentScan) => {
    dispatchRecentScans({ type: "scan-queued", scan })
    refresh()
  }

  const handleLoadMoreScans = async () => {
    if (!nextCursor || isLoadingMore) {
      return
    }

    setIsLoadingMore(true)
    setLoadMoreError(null)

    try {
      const page = await fetchRecentScansPage({
        cursor: nextCursor,
        limit: DASHBOARD_RECENT_SCAN_PAGE_SIZE,
      })

      dispatchRecentScans({ type: "page-loaded", page })
    } catch (error) {
      setLoadMoreError(error instanceof Error ? error.message : "Unable to load more scans.")
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <div className="space-y-6">
      <SearchCommandBar demoMode={demoMode} onScanQueued={handleScanQueued} />

      <div className="grid auto-rows-min grid-cols-12 gap-4">
        <OverviewMetrics stats={stats} />

        <RecentScanSequence
          scans={loadedRecentScans}
          hasMore={nextCursor !== null}
          isLoadingMore={isLoadingMore}
          loadMoreError={loadMoreError}
          onLoadMore={handleLoadMoreScans}
        />
      </div>
    </div>
  )
}
