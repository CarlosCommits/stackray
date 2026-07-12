import { describe, expect, it } from "vitest"

import { technologyCardThemeProfiles } from "./scan-detail/technology-card-options"

describe("technology card frame shadows", () => {
  it("keeps every theme free of exterior frame shadows", () => {
    for (const theme of Object.values(technologyCardThemeProfiles)) {
      expect(theme.frameClass).not.toContain("0_26px_90px")
    }
  })
})
