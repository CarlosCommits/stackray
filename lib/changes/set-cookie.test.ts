import { describe, expect, it } from "vitest"

import {
  canonicalizeSetCookieForComparison,
  parseSetCookieHeaderValues,
  setCookieHeaderValuesMatch,
  splitCombinedSetCookieHeader,
} from "@/lib/changes/set-cookie"

describe("Set-Cookie parsing", () => {
  it("splits combined cookies without splitting an Expires date", () => {
    expect(splitCombinedSetCookieHeader(
      "first=one; Expires=Wed, 03 Sep 2026 12:00:00 GMT; Secure, second=two; Path=/",
    )).toEqual([
      "first=one; Expires=Wed, 03 Sep 2026 12:00:00 GMT; Secure",
      "second=two; Path=/",
    ])
  })

  it("parses cookie values and named attributes", () => {
    expect(parseSetCookieHeaderValues([
      "session=secret=value; Domain=.Example.com; Path=/Admin; Secure; HttpOnly; SameSite=Lax",
    ])).toEqual([{
      name: "session",
      value: "secret=value",
      attributes: {
        domain: ".Example.com",
        path: "/Admin",
        secure: true,
        httponly: true,
        samesite: "Lax",
      },
      raw: "session=secret=value; Domain=.Example.com; Path=/Admin; Secure; HttpOnly; SameSite=Lax",
    }])
  })

  it("omits values and rotating expiry timestamps from semantic comparison", () => {
    const before = canonicalizeSetCookieForComparison(
      "session=first; Path=/; Max-Age=60; SameSite=Lax; Secure",
    )
    const after = canonicalizeSetCookieForComparison(
      "session=second; Path=/; Max-Age=60; SameSite=lax; Secure",
    )

    expect(before).toBe(after)
  })

  it("retains positive Max-Age policy changes but normalizes expired values", () => {
    const oneDay = canonicalizeSetCookieForComparison("session=first; Path=/; Max-Age=86400")
    const oneHour = canonicalizeSetCookieForComparison("session=second; Path=/; Max-Age=3600")
    const expired = canonicalizeSetCookieForComparison("session=third; Path=/; Max-Age=0")
    const negativeExpired = canonicalizeSetCookieForComparison("session=fourth; Path=/; Max-Age=-100")

    expect(oneDay).not.toBe(oneHour)
    expect(oneDay).not.toBe(expired)
    expect(expired).toBe(negativeExpired)
  })

  it("tolerates small positive Max-Age drift without hiding policy changes", () => {
    expect(setCookieHeaderValuesMatch(
      ["session=one; Path=/; Max-Age=14400"],
      ["session=two; Path=/; Max-Age=14399"],
    )).toBe(true)
    expect(setCookieHeaderValuesMatch(
      ["session=one; Path=/; Max-Age=86400"],
      ["session=two; Path=/; Max-Age=3600"],
    )).toBe(false)
    expect(setCookieHeaderValuesMatch(
      ["session=one; Path=/; Max-Age=86400"],
      ["session=two; Path=/; Max-Age=0"],
    )).toBe(false)
  })
})
