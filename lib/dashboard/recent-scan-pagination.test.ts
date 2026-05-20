import { describe, expect, it } from "vitest"

import {
  clampDashboardRecentScanPageLimit,
  DASHBOARD_RECENT_SCAN_PAGE_SIZE,
} from "@/lib/dashboard/recent-scan-pagination"

describe("dashboard recent scan pagination", () => {
  it("clamps oversized or invalid page limits to the dashboard page size", () => {
    expect(clampDashboardRecentScanPageLimit(1_000_000)).toBe(DASHBOARD_RECENT_SCAN_PAGE_SIZE)
    expect(clampDashboardRecentScanPageLimit(Number.NaN)).toBe(DASHBOARD_RECENT_SCAN_PAGE_SIZE)
    expect(clampDashboardRecentScanPageLimit(0)).toBe(DASHBOARD_RECENT_SCAN_PAGE_SIZE)
    expect(clampDashboardRecentScanPageLimit(16)).toBe(16)
  })
})
