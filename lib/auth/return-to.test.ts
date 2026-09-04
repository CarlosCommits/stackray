import { describe, expect, it } from "vitest"

import { buildSignInHref, getSafeReturnTo } from "@/lib/auth/return-to"

describe("sign-in return destinations", () => {
  it("keeps an internal path, query, and hash", () => {
    expect(getSafeReturnTo("/targets/target-1/changes?comparison=change-1#details")).toBe(
      "/targets/target-1/changes?comparison=change-1#details",
    )
  })

  it.each([
    "https://attacker.example/steal-session",
    "//attacker.example/steal-session",
    "/\\attacker.example/steal-session",
    "dashboard",
    "",
  ])("rejects unsafe return destination %s", (returnTo) => {
    expect(getSafeReturnTo(returnTo)).toBe("/dashboard")
  })

  it("builds a sign-in URL without losing the protected query string", () => {
    expect(buildSignInHref("/scans/scan-1?section=changes")).toBe(
      "/?returnTo=%2Fscans%2Fscan-1%3Fsection%3Dchanges",
    )
  })
})
