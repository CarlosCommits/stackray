import { describe, expect, it } from "vitest"

import { generateTemporaryPassword } from "@/lib/auth/passwords"

describe("generateTemporaryPassword", () => {
  it("returns a 12-character temporary password with no separators", () => {
    const password = generateTemporaryPassword()

    expect(password).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{12}$/)
    expect(password).toHaveLength(12)
  })

  it("always returns the fixed Better Auth-compatible length", () => {
    for (let index = 0; index < 25; index += 1) {
      expect(generateTemporaryPassword()).toHaveLength(12)
    }
  })
})
