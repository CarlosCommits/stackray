import { describe, expect, it } from "vitest"

import { getTourById, getTourForRoute, tours } from "@/components/tour"

describe("tour definitions", () => {
  it("defines the three expected product tours", () => {
    expect(tours.map((tour) => tour.id)).toEqual([
      "dashboard-quick-scan",
      "tokens-quickstart",
      "users-management",
    ])
  })

  it("resolves tours by route and id", () => {
    expect(getTourForRoute("/dashboard")?.id).toBe("dashboard-quick-scan")
    expect(getTourForRoute("/settings/tokens")?.id).toBe("tokens-quickstart")
    expect(getTourById("users-management")?.route).toBe("/settings/users")
  })
})
