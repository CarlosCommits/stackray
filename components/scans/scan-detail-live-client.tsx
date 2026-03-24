"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

interface ScanDetailLiveClientProps {
  scanId: string
  active: boolean
}

export function ScanDetailLiveClient({ scanId, active }: ScanDetailLiveClientProps) {
  const router = useRouter()

  useEffect(() => {
    if (!active) {
      return
    }

    const events = new EventSource(`/api/v1/scans/${scanId}/events`)
    const refresh = () => {
      router.refresh()
    }

    events.addEventListener("scan.status", refresh)
    events.addEventListener("scan.progress", refresh)
    events.addEventListener("scan.result", refresh)
    events.addEventListener("scan.complete", () => {
      refresh()
      events.close()
    })
    events.addEventListener("scan.failed", () => {
      refresh()
      events.close()
    })
    events.addEventListener("scan.cancelled", () => {
      refresh()
      events.close()
    })
    events.onerror = () => {
      events.close()
    }

    return () => {
      events.close()
    }
  }, [active, router, scanId])

  return null
}
