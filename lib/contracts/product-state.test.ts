import { describe, expect, it } from "vitest"

import { productStateResponseSchema, updateProductStateRequestSchema } from "@/lib/contracts/product-state"

describe("product state contract", () => {
  it("locks the response shape to include release version and getting-started dismissal", () => {
    expect(productStateResponseSchema.parse({ lastSeenReleaseVersion: null, gettingStartedDismissedAt: null })).toEqual({
      lastSeenReleaseVersion: null,
      gettingStartedDismissedAt: null,
    })
    expect(productStateResponseSchema.parse({ lastSeenReleaseVersion: "1.2.3", gettingStartedDismissedAt: null })).toEqual({
      lastSeenReleaseVersion: "1.2.3",
      gettingStartedDismissedAt: null,
    })
    expect(productStateResponseSchema.parse({ lastSeenReleaseVersion: "1.2.3", gettingStartedDismissedAt: "2025-04-10T00:00:00.000Z" })).toEqual({
      lastSeenReleaseVersion: "1.2.3",
      gettingStartedDismissedAt: "2025-04-10T00:00:00.000Z",
    })
    expect(() =>
      productStateResponseSchema.parse({
        completedTours: ["dashboard-quick-scan"],
        lastSeenReleaseVersion: "1.2.3",
        gettingStartedDismissedAt: null,
      }),
    ).toThrow()
  })

  it("accepts lastSeenReleaseVersion and gettingStartedDismissedAt updates", () => {
    expect(updateProductStateRequestSchema.parse({ lastSeenReleaseVersion: " 1.2.3 " })).toEqual({
      lastSeenReleaseVersion: "1.2.3",
    })
    expect(updateProductStateRequestSchema.parse({ lastSeenReleaseVersion: null })).toEqual({
      lastSeenReleaseVersion: null,
    })
    expect(updateProductStateRequestSchema.parse({ gettingStartedDismissedAt: "2025-04-10T00:00:00.000Z" })).toEqual({
      gettingStartedDismissedAt: "2025-04-10T00:00:00.000Z",
    })
    expect(updateProductStateRequestSchema.parse({ gettingStartedDismissedAt: null })).toEqual({
      gettingStartedDismissedAt: null,
    })
    expect(updateProductStateRequestSchema.parse({ lastSeenReleaseVersion: "1.2.3", gettingStartedDismissedAt: "2025-04-10T00:00:00.000Z" })).toEqual({
      lastSeenReleaseVersion: "1.2.3",
      gettingStartedDismissedAt: "2025-04-10T00:00:00.000Z",
    })
    expect(() => updateProductStateRequestSchema.parse({})).toThrow()
    expect(() => updateProductStateRequestSchema.parse({ completeTourId: "dashboard-quick-scan" })).toThrow()
  })
})