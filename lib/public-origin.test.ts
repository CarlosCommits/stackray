import { describe, expect, it } from "vitest"

import { derivePublicOriginFromHeaders, getPublicOriginAllowedHosts, isAllowedPublicHost } from "@/lib/public-origin"

describe("public origin helpers", () => {
  it("includes localhost defaults in the auth allowlist", () => {
    const hosts = getPublicOriginAllowedHosts()

    expect(hosts).toContain("localhost:*")
  })

  it("recognizes configured wildcard hosts while rejecting unknown Railway subdomains by default", () => {
    expect(isAllowedPublicHost("stackray-production.up.railway.app")).toBe(false)
    expect(isAllowedPublicHost("localhost:3000")).toBe(true)
    expect(isAllowedPublicHost("demo.example.com", ["*.example.com"])).toBe(true)
    expect(isAllowedPublicHost("malicious.example.net", ["*.example.com"])).toBe(false)
  })

  it("prefers forwarded host and proto when they match the allowlist", () => {
    const requestHeaders = new Headers({
      host: "internal.railway",
      "x-forwarded-host": "demo.up.railway.app",
      "x-forwarded-proto": "https",
    })

    expect(derivePublicOriginFromHeaders(requestHeaders, ["demo.up.railway.app"])).toBe("https://demo.up.railway.app")
  })

  it("falls back to localhost for non-allowlisted hosts in development", () => {
    const requestHeaders = new Headers({
      host: "custom.example.com",
      "x-forwarded-proto": "https",
    })

    expect(derivePublicOriginFromHeaders(requestHeaders)).toBe("http://localhost:3000")
  })
})
