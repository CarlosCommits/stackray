import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { OverviewMetrics } from "@/components/dashboard/overview-metrics"
import type { Stat } from "@/components/dashboard/types"

describe("OverviewMetrics", () => {
  it("renders stats in the provided order", () => {
    const stats: Stat[] = [
      { label: "Total Scans", value: "12", href: "/runs", indicator: "static" },
      { label: "Targets Scanned", value: "8", href: "/targets", indicator: "static" },
      { label: "Scans In Flight", value: "2", indicator: "pulse", inFlight: 2 },
    ]

    render(<OverviewMetrics stats={stats} />)

    const headings = screen.getAllByText(/Total Scans|Targets Scanned|Scans In Flight/)
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Total Scans",
      "Targets Scanned",
      "Scans In Flight",
    ])
  })
})
