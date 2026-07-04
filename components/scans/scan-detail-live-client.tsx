"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

const REFRESH_EVENT_NAMES = ["scan.status", "scan.phase", "scan.progress", "scan.result"] as const
const TERMINAL_EVENT_NAMES = ["scan.complete", "scan.failed", "scan.cancelled"] as const
const REFRESH_DEBOUNCE_MS = 1000
const STREAM_ERROR_REFRESH_LIMIT = 3

interface ScanDetailLiveClientProps {
  scanId: string
  active: boolean
  latestEventId: number
}

export function ScanDetailLiveClient({ scanId, active, latestEventId }: ScanDetailLiveClientProps) {
  const { refresh: refreshRoute } = useRouter()

  useEffect(() => {
    if (!active) {
      return
    }

    const eventsUrl = new URL(`/api/v1/scans/${scanId}/events`, window.location.origin)
    if (latestEventId > 0) {
      eventsUrl.searchParams.set("after", String(latestEventId))
    }

    const events = new EventSource(`${eventsUrl.pathname}${eventsUrl.search}`)
    let refreshTimer: number | null = null
    let closed = false
    let streamErrorRefreshCount = 0

    const clearRefreshTimer = () => {
      if (!refreshTimer) {
        return
      }

      window.clearTimeout(refreshTimer)
      refreshTimer = null
    }

    const refreshScanDetails = () => {
      if (closed || refreshTimer) {
        return false
      }

      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        if (!closed) {
          refreshRoute()
        }
      }, REFRESH_DEBOUNCE_MS)

      return true
    }
    const refreshAfterStreamError = () => {
      if (closed) {
        return
      }

      if (streamErrorRefreshCount >= STREAM_ERROR_REFRESH_LIMIT) {
        close()
        return
      }

      if (refreshScanDetails()) {
        streamErrorRefreshCount += 1
      }
    }
    const resetStreamErrors = () => {
      streamErrorRefreshCount = 0
    }
    const refreshAndClose = () => {
      clearRefreshTimer()
      refreshRoute()
      closed = true
      events.close()
    }
    const close = () => {
      closed = true
      clearRefreshTimer()
      events.close()
    }

    for (const eventName of REFRESH_EVENT_NAMES) {
      events.addEventListener(eventName, refreshScanDetails)
    }
    for (const eventName of TERMINAL_EVENT_NAMES) {
      events.addEventListener(eventName, refreshAndClose)
    }
    events.onopen = resetStreamErrors
    events.onerror = refreshAfterStreamError

    return () => {
      for (const eventName of REFRESH_EVENT_NAMES) {
        events.removeEventListener(eventName, refreshScanDetails)
      }
      for (const eventName of TERMINAL_EVENT_NAMES) {
        events.removeEventListener(eventName, refreshAndClose)
      }
      events.onopen = null
      events.onerror = null
      close()
    }
  }, [active, latestEventId, refreshRoute, scanId])

  return null
}
