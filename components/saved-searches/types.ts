import type { SavedSearch } from "@/lib/contracts/saved-searches"

export interface SavedSearchRow {
  id: SavedSearch["id"]
  name: SavedSearch["name"]
  pinned: SavedSearch["pinned"]
  queryDescription: SavedSearch["queryDescription"]
}

export const SAVED_SEARCHES_PAGE_TITLE = "Saved Searches"
export const SAVED_SEARCHES_FILTER_LABEL = "Filter saved searches"
export const SAVED_SEARCHES_FILTER_PLACEHOLDER =
  "Filter saved searches by name or query description"
export const SAVED_SEARCHES_CREATE_BUTTON_LABEL = "Create saved search"
export const SAVED_SEARCHES_RENAME_BUTTON_LABEL = "Save name"
export const SAVED_SEARCHES_DELETE_BUTTON_LABEL = "Delete"
export const SAVED_SEARCHES_PIN_BUTTON_LABEL = "Pin to home"
export const SAVED_SEARCHES_UNPIN_BUTTON_LABEL = "Remove from home"
export const SAVED_SEARCHES_PINNED_STATUS_LABEL = "Pinned to home"
export const SAVED_SEARCHES_UNPINNED_STATUS_LABEL = "Not pinned to home"
export const SAVED_SEARCHES_CLEAR_FILTERS_BUTTON_LABEL = "Clear filters"

export const SAVED_SEARCHES_EMPTY_STATE = {
  title: "No saved searches",
  description: "Create a saved search to keep reusable queries close at hand.",
} as const

export const SAVED_SEARCHES_FILTER_EMPTY_STATE = {
  title: "No matching saved searches",
  description: "Try a different name or query description, or clear the filter.",
} as const
