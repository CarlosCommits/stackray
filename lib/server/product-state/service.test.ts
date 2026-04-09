import { describe, expect, it } from "vitest"

import { mergeCompletedTours } from "@/lib/server/product-state/service"

describe("product state service helpers", () => {
  it("adds a new completed tour without duplicating existing ids", () => {
    expect(mergeCompletedTours([], "dashboard-quick-scan")).toEqual(["dashboard-quick-scan"])
    expect(mergeCompletedTours(["dashboard-quick-scan"], "dashboard-quick-scan")).toEqual(["dashboard-quick-scan"])
    expect(mergeCompletedTours(["dashboard-quick-scan"], "tokens-quickstart")).toEqual([
      "dashboard-quick-scan",
      "tokens-quickstart",
    ])
  })

  it("ignores duplicate tour ids when merging update fallbacks", () => {
    expect(mergeCompletedTours([], "dashboard-quick-scan")).toEqual(["dashboard-quick-scan"])
    expect(mergeCompletedTours(["dashboard-quick-scan"], "dashboard-quick-scan")).toEqual(["dashboard-quick-scan"])
  })
})
