import type { TargetRow as TargetDomainRow } from "@/lib/targets/shared"

export const TARGETS_FILTER_PLACEHOLDER = "Search latest target results...";
export const TARGETS_CLEAR_FILTERS_BUTTON_LABEL = "Clear filters";
export const TARGETS_RESULT_COUNT_LABEL = "results";
export const TARGETS_FILTER_LABELS = {
  q: "Search targets",
  technology: "Technology",
  cdn: "CDN",
  server: "Server",
  plugin: "Plugin",
  theme: "Theme",
  cpe: "CPE",
  statusCode: "Status code",
  from: "From date",
  to: "To date",
} as const;

export const TARGETS_EMPTY_STATE = {
  title: "No targets found",
  description: "Try adjusting your filters or query to find the targets you're looking for.",
} as const;

export const TARGETS_FILTER_EMPTY_STATE = {
  title: "No matching results",
  description: "Try adjusting your filters to find what you're looking for.",
} as const;

export type TargetsRow = TargetDomainRow
