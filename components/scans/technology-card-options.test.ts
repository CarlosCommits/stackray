import { describe, expect, it } from "vitest"

import { classicTechnologyCardThemeProfiles } from "./scan-detail/technology-card-classic-options"
import { technologyCardThemeProfiles } from "./scan-detail/technology-card-options"

describe("technology card dossier themes", () => {
  it("keeps every theme free of decorative glow and shadow utilities", () => {
    for (const theme of Object.values(technologyCardThemeProfiles)) {
      expect(Object.values(theme).join(" ")).not.toContain("shadow")
    }
  })
})

describe("technology card classic themes", () => {
  it("keeps the removed exterior frame shadow out of every restored theme", () => {
    for (const theme of Object.values(classicTechnologyCardThemeProfiles)) {
      expect(theme.frameClass).not.toContain("0_26px_90px")
    }
  })
})
