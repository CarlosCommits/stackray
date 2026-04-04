import type { SavedSearchRow } from "@/components/saved-searches/types"
import type { SavedSearch } from "@/lib/contracts/saved-searches"

function cloneSavedSearchRow(row: SavedSearchRow): SavedSearchRow {
  return { ...row }
}

export function buildSavedSearchRow(savedSearch: SavedSearch): SavedSearchRow {
  return {
    id: savedSearch.id,
    name: savedSearch.name,
    pinned: savedSearch.pinned,
    queryDescription: savedSearch.queryDescription,
  }
}

export function buildSavedSearchRows(savedSearches: readonly SavedSearch[]): SavedSearchRow[] {
  return savedSearches.map((savedSearch) => buildSavedSearchRow(savedSearch))
}

export function filterSavedSearchRows(
  rows: readonly SavedSearchRow[],
  searchValue: string,
): SavedSearchRow[] {
  const normalizedSearchValue = searchValue.trim().toLowerCase()

  if (!normalizedSearchValue) {
    return rows.map((row) => cloneSavedSearchRow(row))
  }

  return rows
    .filter((row) => {
      return (
        row.name.toLowerCase().includes(normalizedSearchValue) ||
        row.queryDescription.toLowerCase().includes(normalizedSearchValue)
      )
    })
    .map((row) => cloneSavedSearchRow(row))
}

export function createSavedSearch(
  rows: readonly SavedSearchRow[],
  savedSearch: SavedSearch,
): SavedSearchRow[] {
  return [...rows.map((row) => cloneSavedSearchRow(row)), buildSavedSearchRow(savedSearch)]
}

export function renameSavedSearch(
  rows: readonly SavedSearchRow[],
  savedSearchId: string,
  nextName: string,
): SavedSearchRow[] {
  return rows.map((row) => {
    if (row.id !== savedSearchId) {
      return cloneSavedSearchRow(row)
    }

    return {
      ...row,
      name: nextName,
    }
  })
}

export function setSavedSearchPinned(
  rows: readonly SavedSearchRow[],
  savedSearchId: string,
  pinned: boolean,
): SavedSearchRow[] {
  return rows.map((row) => {
    if (row.id !== savedSearchId) {
      return cloneSavedSearchRow(row)
    }

    return {
      ...row,
      pinned,
    }
  })
}

export function deleteSavedSearch(
  rows: readonly SavedSearchRow[],
  savedSearchId: string,
): SavedSearchRow[] {
  return rows.filter((row) => row.id !== savedSearchId).map((row) => cloneSavedSearchRow(row))
}
