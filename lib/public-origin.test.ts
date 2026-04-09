import { describe, expect, it } from "vitest"

import { derivePublicOriginFromHeaders, getPublicOriginAllowedHosts, isAllowedPublicHost } from "@/lib/public-origin"

describe("public origin helpers", () => {
  it("includes Railway and localhost defaults in the auth allowlist", () => {
    const hosts = getPublicOriginAllowedHosts()

    expect(hosts).toContain("*.up.railway.app")
    expect(hosts).toContain("localhost:*")
  })

  it("recognizes Railway and configured wildcard hosts", () => {
    expect(isAllowedPublicHost("stackray-production.up.railway.app")).toBe(true)
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

    expect(derivePublicOriginFromHeaders(requestHeaders)).toBe("https://demo.up.railway.app")
  })

  it("falls back to localhost for non-allowlisted hosts in development", () => {
    const requestHeaders = new Headers({
      host: "custom.example.com",
      "x-forwarded-proto": "https",
    })

    expect(derivePublicOriginFromHeaders(requestHeaders)).toBe("http://localhost:3000")
  })
})
