import {
  DashboardClient,
} from "@/components/dashboard"
import { getDashboardSnapshot } from "@/lib/queries/dashboard"

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot()

  return <DashboardClient initialRecentScans={snapshot.recentScans} stats={snapshot.stats} />
}
