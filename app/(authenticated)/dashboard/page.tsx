import {
  SearchCommandBar,
  OverviewMetrics,
  RecentScanSequence,
} from "@/components/dashboard"
import { getDashboardSnapshot } from "@/lib/queries/dashboard"

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot()

  return (
    <div className="space-y-6">
      <SearchCommandBar />

      <div className="grid grid-cols-12 auto-rows-min gap-4">
        <OverviewMetrics stats={snapshot.stats} />

        <RecentScanSequence scans={snapshot.recentScans} />
      </div>
    </div>
  )
}
