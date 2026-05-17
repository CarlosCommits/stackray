import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AnimatedMetricValue } from "@/components/dashboard/animated-metric-value"

describe("AnimatedMetricValue", () => {
  it("renders the final value accessibly and one animated digit column per place", () => {
    const { container } = render(<AnimatedMetricValue value="123" />)

    expect(screen.getByText("123").className).toContain("sr-only")
    expect(container.querySelectorAll('[data-slot="dashboard-metric-counter-digit"]')).toHaveLength(3)
    expect(container.querySelectorAll('[data-slot="dashboard-metric-counter-number"]')).toHaveLength(30)
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy()
  })

  it("falls back to static text for unsupported values", () => {
    const { container } = render(<AnimatedMetricValue value="12.5" />)

    expect(screen.getByText("12.5")).toBeTruthy()
    expect(container.querySelector('[data-slot="dashboard-metric-counter"]')).toBeNull()
  })
})
