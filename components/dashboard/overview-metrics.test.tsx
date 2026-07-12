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
    expect(sparkline?.getAttribute("data-scale-max")).toBe("15.85")
    expect(sparkline?.querySelector("path")?.getAttribute("d")).toContain("160 25.77")
  })

  it("lets the sparkline use the full metric value column height", () => {
    const stats: Stat[] = [
      { label: "Tech discoveries", value: "184", icon: "technologies", indicator: "static", sparkline: [120, 148, 171, 184] },
    ]

    const { container } = render(<OverviewMetrics stats={stats} />)
    const valueColumn = container.querySelector('[data-slot="dashboard-metric-value-column"]')
    const sparkline = container.querySelector('[data-slot="dashboard-metric-sparkline"]')

    expect(valueColumn?.className).toContain("relative")
    expect(valueColumn?.className).toContain("isolate")
    expect(valueColumn?.className).toContain("min-h-14")
    expect(sparkline?.className).toContain("absolute")
    expect(sparkline?.className).toContain("top-0")
    expect(sparkline?.className).toContain("bottom-0")
  })

  it("keeps metric label text layered above the sparkline without a background chip", () => {
    const stats: Stat[] = [
      { label: "Tech discoveries", value: "184", icon: "technologies", indicator: "static", sparkline: [120, 148, 171, 184] },
    ]

    const { container } = render(<OverviewMetrics stats={stats} />)
    const label = container.querySelector('[data-slot="dashboard-metric-label-text"]')
    const labelRow = label?.closest("p")
    const value = container.querySelector('[data-slot="dashboard-metric-counter"]')?.closest("p")
    const sparkline = container.querySelector('[data-slot="dashboard-metric-sparkline"]')

    expect(label).toBeTruthy()
    expect(label?.className).toContain("drop-shadow")
    expect(label?.className).not.toContain("bg-[color-mix")
    expect(labelRow?.className).toContain("z-20")
    expect(value?.className).toContain("drop-shadow")
    expect(value?.className).toContain("z-20")
    expect(sparkline?.className).toContain("z-0")
  })

  it("uses local metric ranges to keep smaller sparkline movements visible", () => {
    const stats: Stat[] = [
      { label: "Total scans", value: "61", icon: "runs", indicator: "static", sparkline: [42, 48, 54, 61] },
      { label: "Sites analyzed", value: "31", icon: "targets", indicator: "static", sparkline: [20, 24, 28, 31] },
      { label: "Active scans", value: "1", icon: "active", indicator: "pulse", sparkline: [0, 0, 0, 1] },
      { label: "Tech discoveries", value: "184", icon: "technologies", indicator: "static", sparkline: [120, 148, 171, 184] },
    ]

    const { container } = render(<OverviewMetrics stats={stats} />)
    const sparklines = Array.from(container.querySelectorAll('[data-slot="dashboard-metric-sparkline"]'))
    const totalPath = sparklines[0]?.querySelector("path")?.getAttribute("d")
    const sitesPath = sparklines[1]?.querySelector("path")?.getAttribute("d")
    const activePath = sparklines[2]?.querySelector("path")?.getAttribute("d")
    const technologyPath = sparklines[3]?.querySelector("path")?.getAttribute("d")

    expect(sparklines[0]?.getAttribute("data-scale-min")).toBe("35.35")
    expect(sparklines[0]?.getAttribute("data-scale-max")).toBe("67.65")
    expect(sparklines[2]?.getAttribute("data-scale-min")).toBe("0")
    expect(sparklines[2]?.getAttribute("data-scale-max")).toBe("1.35")
    expect(totalPath).toContain("160 24.59")
    expect(sitesPath).toContain("160 24.59")
    expect(activePath).toContain("160 26.3")
    expect(technologyPath).toContain("160 24.59")
  })

  it("starts the sparkline with a short decorative value lead-in", () => {
    const stats: Stat[] = [
      { label: "Tech discoveries", value: "355", icon: "technologies", indicator: "static", sparkline: [300, 322, 340, 355] },
    ]

    const { container } = render(<OverviewMetrics stats={stats} />)

    const counter = container.querySelector('[data-slot="dashboard-metric-counter"]')
    const valueColumn = counter?.closest('[data-slot="dashboard-metric-value-column"]')
    const path = valueColumn?.querySelector('[data-slot="dashboard-metric-sparkline"] path')?.getAttribute("d")

    expect(valueColumn?.querySelector('[data-slot="dashboard-metric-sparkline"]')).toBeTruthy()
    expect(path).toContain("M 0 45")
    expect(path).toContain("32 45")
    expect(path).not.toContain("54 45")
    expect(path).toContain("43 45, 43 43.41")
    expect(path).toContain("54 43.41")
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

    const link = screen.getByRole("link", { name: "Sites analyzed: 8" })

    expect(link.getAttribute("href")).toBe("/targets")
    expect(link.querySelector('[data-slot="dashboard-metric-navigation-cue"]')).toBeTruthy()
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
