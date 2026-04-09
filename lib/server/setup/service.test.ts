import { describe, expect, it } from "vitest"

import { normalizeHostname, normalizePublicUrl, shouldRedirectToSetup } from "@/lib/server/setup/service"

describe("setup service helpers", () => {
  it("normalizes canonical URLs to origin-only values", () => {
    expect(normalizePublicUrl("https://stackray.example.com/setup?from=invite#done")).toBe("https://stackray.example.com")
  })

  it("redirects admins to setup until setup is complete", () => {
    expect(shouldRedirectToSetup({ pathname: "/dashboard", canManageSetup: true, isSetupComplete: false })).toBe(true)
    expect(shouldRedirectToSetup({ pathname: "/setup", canManageSetup: true, isSetupComplete: false })).toBe(false)
    expect(shouldRedirectToSetup({ pathname: "/dashboard", canManageSetup: false, isSetupComplete: false })).toBe(false)
    expect(shouldRedirectToSetup({ pathname: "/dashboard", canManageSetup: true, isSetupComplete: true })).toBe(false)
  })

  it("normalizes hostnames without protocol or path fragments", () => {
    expect(normalizeHostname("https://stackray.example.com/setup?x=1")).toBe("stackray.example.com")
    expect(normalizeHostname("stackray.example.com")).toBe("stackray.example.com")
  })
})
