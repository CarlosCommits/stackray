import type { ActorContext } from "@/lib/session/actor-context";
import { getSearchResults } from "@/lib/server/search/service";
import { getDashboardRecentScans, getDashboardStats } from "@/lib/server/scans/read-service";
import { listSavedSearches } from "@/lib/server/saved-searches/service";

export async function getDashboardSnapshot(actor: ActorContext) {
  const [savedSearches, recentScans, spotlightResults, stats] = await Promise.all([
    listSavedSearches(actor),
    getDashboardRecentScans(actor),
    getSearchResults(actor, { limit: "3" }),
    getDashboardStats(actor),
  ]);

  return {
    savedSearches: savedSearches.filter((search) => search.pinned).slice(0, 4),
    recentScans,
    spotlightResults: spotlightResults.items.slice(0, 3),
    stats,
  };
}
