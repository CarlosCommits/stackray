import { describe, expect, it } from "vitest"

import { isMissingUserProductStateSchemaError, mergeCompletedTours } from "@/lib/server/product-state/service"

function createErrorWithCode(message: string, code: string) {
  return Object.assign(new Error(message), { code })
}

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

  it("recognizes missing product state schema errors through nested drizzle causes", () => {
    const missingTableCause = createErrorWithCode('relation "user_product_state" does not exist', "42P01")
    const missingColumnCause = createErrorWithCode('column "completed_tours" does not exist', "42703")

    const wrappedMissingTableError = Object.assign(new Error("Failed query: select ..."), {
      cause: missingTableCause,
    })
    const wrappedMissingColumnError = Object.assign(new Error("Failed query: select ..."), {
      cause: missingColumnCause,
    })

    expect(isMissingUserProductStateSchemaError(wrappedMissingTableError)).toBe(true)
    expect(isMissingUserProductStateSchemaError(wrappedMissingColumnError)).toBe(true)
  })

  it("recognizes direct product state schema error messages", () => {
    expect(isMissingUserProductStateSchemaError(new Error('relation "public.user_product_state" does not exist'))).toBe(true)
    expect(isMissingUserProductStateSchemaError(new Error('column "last_seen_release_version" does not exist'))).toBe(true)
  })

  it("does not swallow unrelated errors", () => {
    expect(isMissingUserProductStateSchemaError(createErrorWithCode("duplicate key value violates unique constraint", "23505"))).toBe(
      false,
    )
    expect(isMissingUserProductStateSchemaError(createErrorWithCode('relation "saved_searches" does not exist', "42P01"))).toBe(false)
    expect(isMissingUserProductStateSchemaError(createErrorWithCode('column "email" does not exist', "42703"))).toBe(false)
    expect(
      isMissingUserProductStateSchemaError(
        Object.assign(new Error("Failed query: select ..."), {
          cause: createErrorWithCode('relation "saved_searches" does not exist', "42P01"),
        }),
      ),
    ).toBe(false)
    expect(isMissingUserProductStateSchemaError(new Error('column "email" does not exist'))).toBe(false)
    expect(isMissingUserProductStateSchemaError("not an error")).toBe(false)
  })
})
