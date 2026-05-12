"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

const REFRESH_EVENT_NAMES = ["scan.status", "scan.progress", "scan.result"] as const
const TERMINAL_EVENT_NAMES = ["scan.complete", "scan.failed", "scan.cancelled"] as const

interface ScanDetailLiveClientProps {
  scanId: string
  active: boolean
}

export function ScanDetailLiveClient({ scanId, active }: ScanDetailLiveClientProps) {
  const { refresh: refreshRoute } = useRouter()

  useEffect(() => {
    if (!active) {
      return
    }

    const events = new EventSource(`/api/v1/scans/${scanId}/events`)
    const refreshScanDetails = () => {
      refreshRoute()
    }
    const refreshAndClose = () => {
      refreshScanDetails()
      events.close()
    }
    const close = () => {
      events.close()
    }

    for (const eventName of REFRESH_EVENT_NAMES) {
      events.addEventListener(eventName, refreshScanDetails)
    }
    for (const eventName of TERMINAL_EVENT_NAMES) {
      events.addEventListener(eventName, refreshAndClose)
    }
    events.onerror = close

    return () => {
      for (const eventName of REFRESH_EVENT_NAMES) {
        events.removeEventListener(eventName, refreshScanDetails)
      }
      for (const eventName of TERMINAL_EVENT_NAMES) {
        events.removeEventListener(eventName, refreshAndClose)
      }
      events.onerror = null
      events.close()
    }
  }, [active, refreshRoute, scanId])

  return null
}
