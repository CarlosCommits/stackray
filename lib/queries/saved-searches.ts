import type { SavedSearchRow } from "@/components/saved-searches/types"
import { requireAppSession } from "@/lib/session/app-session"
import type { SavedSearch } from "@/lib/contracts/search"
import {
  buildSavedSearchRow,
  buildSavedSearchRows,
  createSavedSearch,
  deleteSavedSearch,
  filterSavedSearchRows,
  renameSavedSearch,
  setSavedSearchPinned,
} from "@/lib/saved-searches/shared"
import { listSavedSearches } from "@/lib/server/saved-searches/service"

export interface SavedSearchesPageData {
  rows: SavedSearchRow[]
}

function compareSavedSearches(left: SavedSearch, right: SavedSearch): number {
  if (left.pinned !== right.pinned) {
    return left.pinned ? -1 : 1
  }

  return left.name.localeCompare(right.name)
}
export {
  buildSavedSearchRow,
  buildSavedSearchRows,
  createSavedSearch,
  deleteSavedSearch,
  filterSavedSearchRows,
  renameSavedSearch,
  setSavedSearchPinned,
}

export async function getSavedSearchesPageData(): Promise<SavedSearchesPageData> {
  const session = await requireAppSession()

  return {
    rows: buildSavedSearchRows(
      (await listSavedSearches(session)).sort(compareSavedSearches),
    ),
  }
}
