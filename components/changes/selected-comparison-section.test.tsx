import { act, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { SelectedComparisonSection } from "@/components/changes/selected-comparison-section"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

describe("SelectedComparisonSection", () => {
  it("scrolls to and briefly highlights an exact comparison", () => {
    vi.useFakeTimers()
    const scrollIntoView = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0)
      return 1
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined)

    render(
      <SelectedComparisonSection id="comparison-one" labelledBy="heading-one" selected>
        <h2 id="heading-one">July 18 comparison</h2>
      </SelectedComparisonSection>,
    )

    const section = screen.getByRole("region", { name: "July 18 comparison" })
    expect(section).toHaveAttribute("data-highlighted", "true")
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" })

    act(() => vi.advanceTimersByTime(1_800))
    expect(section).toHaveAttribute("data-highlighted", "false")
    vi.useRealTimers()
  })
})
