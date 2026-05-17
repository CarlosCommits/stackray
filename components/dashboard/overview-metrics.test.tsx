import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { OverviewMetrics } from "@/components/dashboard/overview-metrics"
import type { Stat } from "@/components/dashboard/types"

describe("OverviewMetrics", () => {
  it("renders stats in the provided order", () => {
    const stats: Stat[] = [
      { label: "Total scans", value: "12", href: "/runs", icon: "runs", indicator: "static" },
      { label: "Sites analyzed", value: "8", href: "/targets", icon: "targets", indicator: "static" },
      { label: "Active scans", value: "2", icon: "active", indicator: "pulse", inFlight: 2 },
      { label: "Tech discoveries", value: "14", icon: "technologies", indicator: "static" },
    ]

    render(<OverviewMetrics stats={stats} />)

    const headings = screen.getAllByText(/Total scans|Sites analyzed|Active scans|Tech discoveries/)
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Total scans",
      "Sites analyzed",
      "Active scans",
      "Tech discoveries",
    ])
  })

  it("renders a compact metrics banner", () => {
    const stats: Stat[] = [
      { label: "A", value: "1", indicator: "static" },
      { label: "B", value: "2", indicator: "static" },
    ]

    render(<OverviewMetrics stats={stats} />)

    const banner = screen.getByRole("region", { name: "Dashboard metrics" })
    expect(banner.className).toContain("col-span-12")
    expect(banner.className).toContain("overflow-hidden")
    expect(screen.getByRole("list").className).toContain("xl:grid-cols-4")
  })

  it("uses floating dividers instead of connected grid gaps", () => {
    const stats: Stat[] = [
      { label: "Total scans", value: "12", icon: "runs", indicator: "static" },
      { label: "Sites analyzed", value: "8", icon: "targets", indicator: "static" },
    ]

    const { container } = render(<OverviewMetrics stats={stats} />)
    const separators = container.querySelectorAll('[data-slot="dashboard-metric-separator"]')

    expect(screen.getByRole("list").className).not.toContain("gap-px")
    expect(separators.length).toBeGreaterThan(0)
    expect(separators[0]?.className).toContain("right-4")
    expect(separators[1]?.className).toContain("top-4")
    expect(separators[1]?.className).toContain("bottom-4")
  })

  it("renders an icon for each metric", () => {
    const stats: Stat[] = [
      { label: "Total scans", value: "12", icon: "runs", indicator: "static" },
      { label: "Sites analyzed", value: "8", icon: "targets", indicator: "static" },
      { label: "Active scans", value: "2", icon: "active", indicator: "pulse", inFlight: 2 },
      { label: "Tech discoveries", value: "14", icon: "technologies", indicator: "static" },
    ]

    const { container } = render(<OverviewMetrics stats={stats} />)

    expect(container.querySelectorAll('[data-slot="dashboard-metric-icon"]')).toHaveLength(4)
  })

  it("renders metric values with animated counters", () => {
    const stats: Stat[] = [
      { label: "Total scans", value: "12", icon: "runs", indicator: "static" },
    ]

    const { container } = render(<OverviewMetrics stats={stats} />)
    const counter = container.querySelector('[data-slot="dashboard-metric-counter"]')

    expect(counter).toBeTruthy()
    expect(counter?.textContent).toContain("12")
    expect(counter?.querySelector('[aria-hidden="true"]')).toBeTruthy()
  })

  it("renders a decorative glowy sparkline for each metric", () => {
    const stats: Stat[] = [
      { label: "Total scans", value: "12", icon: "runs", indicator: "static" },
      { label: "Sites analyzed", value: "8", icon: "targets", indicator: "static" },
      { label: "Active scans", value: "2", icon: "active", indicator: "pulse", inFlight: 2 },
      { label: "Tech discoveries", value: "14", icon: "technologies", indicator: "static" },
    ]

    const { container } = render(<OverviewMetrics stats={stats} />)
    const sparklines = Array.from(container.querySelectorAll('[data-slot="dashboard-metric-sparkline"]'))

    expect(sparklines).toHaveLength(4)
    expect(sparklines.every((sparkline) => sparkline.getAttribute("aria-hidden") === "true")).toBe(true)
    expect(sparklines[0]?.querySelectorAll("path")).toHaveLength(2)
    expect(sparklines[0]?.querySelector('[data-slot="dashboard-metric-sparkline-endpoint"]')).toBeTruthy()
    expect(sparklines[0]?.querySelector('[data-slot="dashboard-metric-sparkline-endpoint"]')?.className).toContain("rounded-full")
    expect(sparklines[0]?.querySelector('[data-slot="dashboard-metric-sparkline-endpoint"]')?.className).toContain("dashboard-sparkline-endpoint")
    expect(sparklines[0]?.querySelectorAll(".dashboard-sparkline-draw")).toHaveLength(2)
    expect(sparklines[0]?.querySelectorAll('path[fill="none"]')).toHaveLength(2)
  })

  it("renders provided seven-day sparkline values", () => {
    const stats: Stat[] = [
      { label: "Total scans", value: "12", icon: "runs", indicator: "static", sparkline: [1, 1, 2, 4, 7, 9, 12] },
    ]

    const { container } = render(<OverviewMetrics stats={stats} />)
    const sparkline = container.querySelector('[data-slot="dashboard-metric-sparkline"]')

    expect(sparkline?.getAttribute("data-points")).toBe("7")
    expect(sparkline?.getAttribute("data-trend")).toBe("rising")
  })

  it("places each sparkline in the metric text column under the number", () => {
    const stats: Stat[] = [
      { label: "Total scans", value: "12", icon: "runs", indicator: "static" },
    ]

    const { container } = render(<OverviewMetrics stats={stats} />)

    const counter = container.querySelector('[data-slot="dashboard-metric-counter"]')
    const valueColumn = counter?.closest('[data-slot="dashboard-metric-value-column"]')
    expect(valueColumn?.querySelector('[data-slot="dashboard-metric-sparkline"]')).toBeTruthy()
  })

  it("uses a flat sparkline for zero active scans", () => {
    const stats: Stat[] = [
      { label: "Active scans", value: "0", icon: "active", indicator: "pulse", inFlight: 0 },
    ]

    const { container } = render(<OverviewMetrics stats={stats} />)
    const sparkline = container.querySelector('[data-slot="dashboard-metric-sparkline"]')

    expect(sparkline?.getAttribute("data-trend")).toBe("flat")
  })

  it("uses distinct icon colors for each metric", () => {
    const stats: Stat[] = [
      { label: "Total scans", value: "12", icon: "runs", indicator: "static" },
      { label: "Sites analyzed", value: "8", icon: "targets", indicator: "static" },
      { label: "Active scans", value: "2", icon: "active", indicator: "pulse", inFlight: 2 },
      { label: "Tech discoveries", value: "14", icon: "technologies", indicator: "static" },
    ]

    const { container } = render(<OverviewMetrics stats={stats} />)
    const iconShells = Array.from(container.querySelectorAll('[data-slot="dashboard-metric-icon"]'))

    expect(iconShells[0]?.className).toContain("bg-cyan-400/10")
    expect(iconShells[1]?.className).toContain("bg-emerald-400/10")
    expect(iconShells[2]?.className).toContain("bg-amber-400/10")
    expect(iconShells[3]?.className).toContain("bg-violet-400/10")
    expect(iconShells[0]?.getAttribute("data-metric-icon")).toBe("runs")
    expect(iconShells[1]?.getAttribute("data-metric-icon")).toBe("targets")
  })

  it("keeps linked metrics navigable", () => {
    const stats: Stat[] = [
      { label: "Sites analyzed", value: "8", href: "/targets", subvalue: "sites", indicator: "static" },
    ]

    render(<OverviewMetrics stats={stats} />)

    expect(screen.getByRole("link", { name: "Sites analyzed: 8" }).getAttribute("href")).toBe("/targets")
  })

  it("does not render metric subtitles or value suffixes", () => {
    const stats: Stat[] = [
      {
        label: "Tech discoveries",
        value: "14",
        subvalue: "unique",
        meta: "Unique technologies",
        indicator: "static",
      },
    ]

    render(<OverviewMetrics stats={stats} />)

    expect(screen.getByText("14")).toBeTruthy()
    expect(screen.queryByText("unique")).toBeNull()
    expect(screen.queryByText("Unique technologies")).toBeNull()
  })

  it("does not render the previous active scan pulse dots", () => {
    const stats: Stat[] = [
      { label: "Active scans", value: "2", indicator: "pulse", inFlight: 2 },
      { label: "Idle scans", value: "0", indicator: "pulse", inFlight: 0 },
    ]

    const { container } = render(<OverviewMetrics stats={stats} />)

    expect(container.querySelectorAll(".motion-safe\\:animate-pulse")).toHaveLength(0)
    expect(container.querySelectorAll('[data-slot="dashboard-metric-sparkline"]')).toHaveLength(2)
  })
})
