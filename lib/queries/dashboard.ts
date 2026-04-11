import { requireAppSession } from "@/lib/session/app-session";
import { getTargetResults } from "@/lib/server/targets/service";
import { getDashboardRecentScans, getDashboardStats } from "@/lib/server/scans/read-service";

export async function getDashboardSnapshot() {
  const session = await requireAppSession();

  const [recentScans, spotlightTargetResults, stats] = await Promise.all([
    getDashboardRecentScans(session, 8),
    getTargetResults(session, { limit: "3" }),
    getDashboardStats(session),
  ]);

  return {
    recentScans,
    spotlightResults: spotlightTargetResults.items.slice(0, 3),
    stats,
  };
}
