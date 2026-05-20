import { requireAppSession } from "@/lib/session/app-session";
import { getTargetResults } from "@/lib/server/targets/service";
import { DASHBOARD_INITIAL_RECENT_SCAN_LIMIT } from "@/lib/dashboard/recent-scan-pagination";
import { getDashboardRecentScansPage, getDashboardStats } from "@/lib/server/scans/read-service";

export async function getDashboardSnapshot() {
  const session = await requireAppSession();

  const [recentScansPage, spotlightTargetResults, stats] = await Promise.all([
    getDashboardRecentScansPage(session, { limit: DASHBOARD_INITIAL_RECENT_SCAN_LIMIT }),
    getTargetResults(session, { limit: "3" }),
    getDashboardStats(session),
  ]);

  return {
    recentScans: recentScansPage.items,
    recentScansNextCursor: recentScansPage.nextCursor,
    spotlightResults: spotlightTargetResults.items.slice(0, 3),
    stats,
  };
}
