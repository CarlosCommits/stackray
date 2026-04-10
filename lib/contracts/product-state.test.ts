import { describe, expect, it } from "vitest"

import { productStateResponseSchema, updateProductStateRequestSchema } from "@/lib/contracts/product-state"

describe("product state contract", () => {
  it("locks the release-notice-only response shape", () => {
    expect(productStateResponseSchema.parse({ lastSeenReleaseVersion: null })).toEqual({
      lastSeenReleaseVersion: null,
    })
    expect(productStateResponseSchema.parse({ lastSeenReleaseVersion: "1.2.3" })).toEqual({
      lastSeenReleaseVersion: "1.2.3",
    })
    expect(() =>
      productStateResponseSchema.parse({
        completedTours: ["dashboard-quick-scan"],
        lastSeenReleaseVersion: "1.2.3",
      }),
    ).toThrow()
  })

  it("accepts only lastSeenReleaseVersion updates", () => {
    expect(updateProductStateRequestSchema.parse({ lastSeenReleaseVersion: " 1.2.3 " })).toEqual({
      lastSeenReleaseVersion: "1.2.3",
    })
    expect(updateProductStateRequestSchema.parse({ lastSeenReleaseVersion: null })).toEqual({
      lastSeenReleaseVersion: null,
    })
    expect(() => updateProductStateRequestSchema.parse({})).toThrow()
    expect(() => updateProductStateRequestSchema.parse({ completeTourId: "dashboard-quick-scan" })).toThrow()
    expect(() =>
      updateProductStateRequestSchema.parse({
        completeTourId: "dashboard-quick-scan",
        lastSeenReleaseVersion: "1.2.3",
      }),
    ).toThrow()
  })
})
