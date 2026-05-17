import { describe, expect, it } from "vitest"

import customFingerprints from "./custom-wappalyzer-fingerprints.json" with { type: "json" }

describe("custom Wappalyzer fingerprints", () => {
  it("detects Clerk with conservative auth-specific signals", () => {
    const clerk = customFingerprints.apps.Clerk

    expect(clerk.cats).toEqual([69])
    expect(clerk.cookies).toEqual({ __client_uat: "" })
    expect(clerk.html).toEqual(
      expect.arrayContaining([
        expect.stringContaining("data-clerk-publishable-key"),
        expect.stringContaining("/npm/@clerk/(?:clerk-js|ui)"),
      ]),
    )
    expect(clerk.scriptSrc).toEqual([
      expect.stringContaining("/npm/@clerk/(?:clerk-js|ui)"),
    ])
    expect(clerk.js).toEqual({
      "Clerk.authenticateWithMetamask": "",
      "Clerk.openSignIn": "",
      "Clerk.version": "([\\d.]+)\\;version:\\1",
      __clerk_publishable_key: "",
    })
    expect(clerk.scripts).toEqual(["\\b__clerk_publishable_key\\b"])
  })

  it("detects Cloudflare Web Analytics from the official beacon snippet", () => {
    const cloudflareWebAnalytics = customFingerprints.apps["Cloudflare Web Analytics"]

    expect(cloudflareWebAnalytics.cats).toEqual([10, 78])
    expect(cloudflareWebAnalytics.html).toEqual(
      expect.arrayContaining([
        expect.stringContaining("data-cf-beacon"),
        expect.stringContaining("static\\.cloudflareinsights\\.com/beacon"),
      ]),
    )
    expect(cloudflareWebAnalytics.scriptSrc).toEqual([
      expect.stringContaining("static\\.cloudflareinsights\\.com/beacon"),
    ])
  })
})
