import type { Metadata } from "next"

import {
  DashboardClient,
} from "@/components/dashboard"
import { getDashboardSnapshot } from "@/lib/queries/dashboard"
import { isDemoModeEnabled } from "@/lib/demo-mode"

export const metadata: Metadata = {
  title: "Dashboard | Stackray",
  description: "Review Stackray scan activity, recent targets, and site intelligence metrics.",
}

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot()

  return (
    <DashboardClient
      initialRecentScans={snapshot.recentScans}
      initialRecentScansNextCursor={snapshot.recentScansNextCursor}
      stats={snapshot.stats}
      demoMode={isDemoModeEnabled()}
    />
  )
}
