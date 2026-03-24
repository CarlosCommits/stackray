import type { ActorContext } from "@/lib/server/actor-context";
import { getWorkspaceSearchResults } from "@/lib/server/search/service";
import { getDashboardRecentScans, getDashboardStats } from "@/lib/server/scans/read-service";
import { listWorkspaceSavedSearches } from "@/lib/server/saved-searches/service";

export async function getWorkspaceDashboardSnapshot(actor: ActorContext) {
  const [savedSearches, recentScans, spotlightResults, stats] = await Promise.all([
    listWorkspaceSavedSearches(actor),
    getDashboardRecentScans(actor),
    getWorkspaceSearchResults(actor, { limit: "3" }),
    getDashboardStats(actor),
  ]);

  return {
    savedSearches: savedSearches.filter((search) => search.pinned).slice(0, 4),
    recentScans,
    spotlightResults: spotlightResults.items.slice(0, 3),
    stats,
  };
}
