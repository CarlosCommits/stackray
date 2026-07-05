import { describe, expect, it } from "vitest"

import { parseAnalyticsScriptUrl } from "./analytics"

describe("analytics script configuration", () => {
  it("disables analytics when the script URL is missing", () => {
    expect(parseAnalyticsScriptUrl(undefined)).toBeNull()
  })

  it("extracts the Umami website id from a single script URL env var", () => {
    expect(parseAnalyticsScriptUrl("https://analytics.example.com/script.js?websiteId=site_123")).toEqual({
      src: "https://analytics.example.com/script.js",
      websiteId: "site_123",
      domains: undefined,
    })
  })

  it("supports optional domains in the same env var", () => {
    expect(parseAnalyticsScriptUrl("https://analytics.example.com/x.js?website=site_123&domains=stackray.app,www.stackray.app")).toEqual({
      src: "https://analytics.example.com/x.js",
      websiteId: "site_123",
      domains: "stackray.app,www.stackray.app",
    })
  })

  it("does not enable analytics without a website id", () => {
    expect(parseAnalyticsScriptUrl("https://analytics.example.com/script.js")).toBeNull()
  })
})
