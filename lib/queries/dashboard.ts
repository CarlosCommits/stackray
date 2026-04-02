import { requireAppSession } from "@/lib/session/app-session";
import { getSearchResults } from "@/lib/server/search/service";
import { getDashboardRecentScans, getDashboardStats } from "@/lib/server/scans/read-service";
import { listSavedSearches } from "@/lib/server/saved-searches/service";

export async function getDashboardSnapshot() {
  const session = await requireAppSession();

  const [savedSearches, recentScans, spotlightResults, stats] = await Promise.all([
    listSavedSearches(session),
    getDashboardRecentScans(session),
    getSearchResults(session, { limit: "3" }),
    getDashboardStats(),
  ]);

  return {
    savedSearches: savedSearches.filter((search) => search.pinned).slice(0, 4),
    recentScans,
    spotlightResults: spotlightResults.items.slice(0, 3),
    stats,
  };
}
