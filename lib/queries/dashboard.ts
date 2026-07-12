import { requireAppSession } from "@/lib/session/app-session";
import { DASHBOARD_INITIAL_RECENT_SCAN_LIMIT } from "@/lib/dashboard/recent-scan-pagination";
import { getDashboardRecentScansPage, getDashboardStats } from "@/lib/server/scans/read-service";

export async function getDashboardSnapshot() {
  const session = await requireAppSession();

  const [recentScansPage, stats] = await Promise.all([
    getDashboardRecentScansPage(session, { limit: DASHBOARD_INITIAL_RECENT_SCAN_LIMIT }),
    getDashboardStats(session),
  ]);

  return {
    recentScans: recentScansPage.items,
    recentScansNextCursor: recentScansPage.nextCursor,
    stats,
  };
}
