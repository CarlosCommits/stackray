import { NextRequest } from "next/server"
import { describe, expect, it, vi } from "vitest"

import { proxy } from "./proxy"

vi.mock("better-auth/cookies", () => ({
  getSessionCookie: () => null,
}))

describe("proxy authentication redirects", () => {
  it("preserves the full protected destination for sign-in", () => {
    const request = new NextRequest(
      "https://stackray.example/targets/target-1/changes?comparison=comparison-1&item=item-1",
    )

    const response = proxy(request)

    expect(response.headers.get("location")).toBe(
      "https://stackray.example/?returnTo=%2Ftargets%2Ftarget-1%2Fchanges%3Fcomparison%3Dcomparison-1%26item%3Ditem-1",
    )
  })
})
