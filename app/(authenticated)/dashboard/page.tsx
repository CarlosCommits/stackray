import Link from "next/link"
import {
  SearchCommandBar,
  OverviewMetrics,
  RecentScanSequence,
} from "@/components/dashboard"
import { stats, recentScans } from "./data"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <SearchCommandBar />

      <div className="grid grid-cols-12 auto-rows-min gap-4">
        <OverviewMetrics stats={stats} />

        <RecentScanSequence scans={recentScans} />
      </div>
    </div>
  )
}
