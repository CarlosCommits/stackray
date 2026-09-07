import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"

import { BaselineInfoPopover } from "@/components/targets/profile/baseline-info-popover"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

describe("BaselineInfoPopover", () => {
  it("explains an automatic baseline when activated", () => {
    render(<BaselineInfoPopover baselineMode="previous" />)

    fireEvent.click(screen.getByRole("button", { name: "Explain comparison baseline" }))

    expect(screen.getByText("Comparison baseline")).toBeVisible()
    expect(screen.getByText("Compared with the previous completed scan.")).toBeVisible()
  })

  it("explains a pinned baseline when activated", () => {
    render(<BaselineInfoPopover baselineMode="pinned" />)

    fireEvent.click(screen.getByRole("button", { name: "Explain comparison baseline" }))

    expect(screen.getByText("Compared with the selected pinned scan.")).toBeVisible()
  })
})
