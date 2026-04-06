import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StatCard } from "@/components/dashboard/stat-card"
import type { Stat } from "@/components/dashboard/types"

describe("StatCard", () => {
  it("renders stat label and value", () => {
    const stat: Stat = {
      label: "Total Scans",
      value: "1,234",
      indicator: "static",
    }

    render(<StatCard stat={stat} />)

    expect(screen.getByText("Total Scans")).toBeTruthy()
    expect(screen.getByText("1,234")).toBeTruthy()
  })

  it("renders subvalue when provided", () => {
    const stat: Stat = {
      label: "Active Jobs",
      value: "42",
      subvalue: "running",
      indicator: "pulse",
    }

    render(<StatCard stat={stat} />)

    expect(screen.getByText("running")).toBeTruthy()
  })

  it("renders meta text when provided", () => {
    const stat: Stat = {
      label: "Uptime",
      value: "99.9%",
      meta: "Last 30 days",
      indicator: "static",
    }

    render(<StatCard stat={stat} />)

    expect(screen.getByText("Last 30 days")).toBeTruthy()
  })

  it("renders trend-up indicator with change", () => {
    const stat: Stat = {
      label: "Growth",
      value: "+15%",
      change: "+2.3%",
      indicator: "trend-up",
    }

    render(<StatCard stat={stat} />)

    expect(screen.getByText("+2.3%")).toBeTruthy()
  })

  it("renders trend-down indicator with change", () => {
    const stat: Stat = {
      label: "Errors",
      value: "23",
      change: "-5%",
      indicator: "trend-down",
    }

    render(<StatCard stat={stat} />)

    expect(screen.getByText("-5%")).toBeTruthy()
  })

  it("renders pulse indicator", () => {
    const stat: Stat = {
      label: "Live Connections",
      value: "89",
      inFlight: 89,
      indicator: "pulse",
    }

    const { container } = render(<StatCard stat={stat} />)

    expect(screen.getByText("Live Connections")).toBeTruthy()
    expect(screen.getByText("89")).toBeTruthy()
    expect(container.querySelectorAll(".motion-safe\\:animate-pulse")).toHaveLength(3)
  })

  it("hides the pulse indicator when no scans are active", () => {
    const stat: Stat = {
      label: "Scans In Flight",
      value: "0",
      inFlight: 0,
      indicator: "pulse",
    }

    const { container } = render(<StatCard stat={stat} />)

    expect(screen.getByText("0")).toBeTruthy()
    expect(container.querySelectorAll(".motion-safe\\:animate-pulse")).toHaveLength(0)
  })

  it("value has tabular-nums class for numeric alignment", () => {
    const stat: Stat = {
      label: "Count",
      value: "123",
      indicator: "static",
    }

    render(<StatCard stat={stat} />)

    const value = screen.getByText("123")
    expect(value.classList.contains("tabular-nums")).toBe(true)
  })

  it("wraps the card in a link when href is provided", () => {
    const stat: Stat = {
      label: "Total Scans",
      value: "123",
      href: "/runs",
      indicator: "static",
    }

    render(<StatCard stat={stat} />)

    expect(screen.getByRole("link", { name: /total scans/i }).getAttribute("href")).toBe("/runs")
  })
})
