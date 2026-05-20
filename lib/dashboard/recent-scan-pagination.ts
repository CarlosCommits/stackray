export const DASHBOARD_INITIAL_RECENT_SCAN_LIMIT = 16
export const DASHBOARD_RECENT_SCAN_PAGE_SIZE = 32

export function clampDashboardRecentScanPageLimit(limit: number) {
  return Number.isInteger(limit) && limit > 0
    ? Math.min(limit, DASHBOARD_RECENT_SCAN_PAGE_SIZE)
    : DASHBOARD_RECENT_SCAN_PAGE_SIZE
}
