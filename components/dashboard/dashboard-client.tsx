"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { OverviewMetrics } from "@/components/dashboard/overview-metrics"
import { RecentScanSequence } from "@/components/dashboard/recent-scan-sequence"
import { SearchCommandBar } from "@/components/dashboard/search-command-bar"
import type { RecentScan, Stat } from "@/components/dashboard/types"

interface DashboardClientProps {
  initialRecentScans: RecentScan[]
  stats: Stat[]
}

const ACTIVE_SCAN_REFRESH_INTERVAL_MS = 2_500

export function DashboardClient({ initialRecentScans, stats }: DashboardClientProps) {
  const { refresh } = useRouter()
  const [optimisticScans, setOptimisticScans] = useState<RecentScan[]>([])

  const recentScans = useMemo(() => {
    const serverScanIds = new Set(initialRecentScans.map((scan) => scan.id))
    const pendingScans = optimisticScans.filter((scan) => !serverScanIds.has(scan.id))

    return [...pendingScans, ...initialRecentScans].slice(0, 8)
  }, [initialRecentScans, optimisticScans])

  useEffect(() => {
    if (!recentScans.some((scan) => scan.status === "analyzing")) {
      return
    }

    const interval = window.setInterval(() => {
      refresh()
    }, ACTIVE_SCAN_REFRESH_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [recentScans, refresh])

  const handleScanQueued = (scan: RecentScan) => {
    setOptimisticScans((current) => [scan, ...current.filter((item) => item.id !== scan.id)].slice(0, 8))
    refresh()
  }

  return (
    <div className="space-y-6">
      <SearchCommandBar onScanQueued={handleScanQueued} />

      <div className="grid auto-rows-min grid-cols-12 gap-4">
        <OverviewMetrics stats={stats} />

        <RecentScanSequence scans={recentScans} />
      </div>
    </div>
  )
}
