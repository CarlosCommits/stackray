import {
  SEARCH_LATEST_SCAN_LINK_LABEL as SEARCH_QUERY_LATEST_SCAN_LINK_LABEL,
  getSearchScanDetailHref as getQuerySearchScanDetailHref,
  type SearchRow,
  type SearchRowLastScannedAt,
  type SearchRowLatestScan,
} from "@/lib/search/shared";

export const SEARCH_PAGE_TITLE = "Cross-Scan Search";
export const SEARCH_FILTER_PLACEHOLDER = "Search across all scan results...";
export const SEARCH_CLEAR_FILTERS_BUTTON_LABEL = "Clear filters";
export const SEARCH_RESULT_COUNT_LABEL = "results";
export const SEARCH_LATEST_SCAN_LINK_LABEL = SEARCH_QUERY_LATEST_SCAN_LINK_LABEL;
export const SEARCH_MODE_DESCRIPTION = {
  latest: "Latest successful result per canonical target.",
  snapshots: "Every completed historical match across stored snapshots.",
} as const;
export const SEARCH_FILTER_LABELS = {
  q: "Search results",
  technology: "Technology",
  cdn: "CDN",
  server: "Server",
  plugin: "WordPress plugin",
  cpe: "CPE",
  statusCode: "Status code",
  from: "From date",
  to: "To date",
} as const;

export const SEARCH_EMPTY_STATE = {
  title: "No search results",
  description: "Try adjusting your filters or search query to find what you're looking for.",
} as const;

export const SEARCH_FILTER_EMPTY_STATE = {
  title: "No matching results",
  description: "Try adjusting your filters to find what you're looking for.",
} as const;

export const SEARCH_MODE_LABELS = {
  latest: "Latest",
  snapshots: "Snapshots",
} as const;

export const SEARCH_COLUMNS = [
  { key: "target", label: "Target" },
  { key: "title", label: "Title" },
  { key: "technologies", label: "Technologies" },
  { key: "lastScannedAt", label: "Last scanned at" },
  { key: "latestScan", label: "Latest scan" },
] as const;

export type SearchColumnKey = (typeof SEARCH_COLUMNS)[number]["key"];
export type SearchModeValue = "latest" | "snapshots";

export function getSearchScanDetailHref(scanId: string): string {
  return getQuerySearchScanDetailHref(scanId);
}

export type { SearchRow, SearchRowLastScannedAt, SearchRowLatestScan };
