import { describe, expect, it } from "vitest"

import { isMissingUserProductStateSchemaError, resolveProductState } from "@/lib/server/product-state/service"

function createErrorWithCode(message: string, code: string) {
  return Object.assign(new Error(message), { code })
}

describe("product state service helpers", () => {
  it("preserves or updates the release-notice version without any tour state", () => {
    expect(resolveProductState({ lastSeenReleaseVersion: null }, {})).toEqual({
      lastSeenReleaseVersion: null,
    })
    expect(resolveProductState({ lastSeenReleaseVersion: "1.0.0" }, {})).toEqual({
      lastSeenReleaseVersion: "1.0.0",
    })
    expect(resolveProductState({ lastSeenReleaseVersion: "1.0.0" }, { lastSeenReleaseVersion: "1.1.0" })).toEqual({
      lastSeenReleaseVersion: "1.1.0",
    })
    expect(resolveProductState({ lastSeenReleaseVersion: "1.1.0" }, { lastSeenReleaseVersion: null })).toEqual({
      lastSeenReleaseVersion: null,
    })
  })

  it("recognizes missing product state schema errors through nested drizzle causes", () => {
    const missingTableCause = createErrorWithCode('relation "user_product_state" does not exist', "42P01")
    const missingColumnCause = createErrorWithCode('column "last_seen_release_version" does not exist', "42703")

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
