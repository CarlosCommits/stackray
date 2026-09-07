import { beforeAll, describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { renderToString } from "react-dom/server"

import { TimeZoneProvider } from "@/components/ui/time-zone-provider"
import { TargetsSurface } from "./targets-surface"
import type { TargetsRow } from "./types"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

function buildRow(overrides: Partial<TargetsRow> = {}): TargetsRow {
  return {
    canonicalTargetId: "ctg_01J_target_demo",
    target: "https://example.com",
    title: "Example target",
    technologies: ["Next.js"],
    lastScannedAt: { iso: "2026-03-23T16:00:12.000Z" },
    latestScan: {
      scanId: "scn_01J_target_demo",
      href: "/scans/scn_01J_target_demo",
      label: "Open latest scan",
      ariaLabel: "Open latest scan for https://example.com",
    },
    faviconUrl: null,
    screenshotUrl: null,
    ...overrides,
  }
}

describe("TargetsSurface", () => {
  it("links desktop and mobile target rows to the target profile", () => {
    const { container } = render(<TargetsSurface rows={[buildRow()]} />)

    const profileLinks = screen.getAllByRole("link").filter((link) => link.getAttribute("href") === "/targets/ctg_01J_target_demo")
    const desktopRow = container.querySelector<HTMLTableRowElement>("tbody tr")

    expect(desktopRow).not.toBeNull()
    expect(within(desktopRow!).getAllByRole("link")).toHaveLength(4)
    expect(within(desktopRow!).getAllByRole("link").every((link) => link.getAttribute("href") === "/targets/ctg_01J_target_demo")).toBe(true)
    expect(profileLinks).toHaveLength(5)
    expect(screen.queryByRole("button", { name: /scan history/i })).not.toBeInTheDocument()
  })

  it("keeps desktop rows at the compact height", () => {
    const { container } = render(<TargetsSurface rows={[buildRow()]} />)
    const desktopRow = container.querySelector<HTMLTableRowElement>("tbody tr")

    expect(desktopRow).toHaveClass("h-10")
    expect(desktopRow).not.toHaveClass("h-11")
  })

  it("shows the navigation chevron only in the mobile row", () => {
    const { container } = render(<TargetsSurface rows={[buildRow({ faviconUrl: "https://example.com/favicon.ico" })]} />)

    expect(container.querySelector("tbody tr td:first-child svg")).toBeNull()
    expect(container.querySelector(".lg\\:hidden a > svg")).not.toBeNull()
  })

  it("renders scheme-less target labels", () => {
    render(<TargetsSurface rows={[buildRow({ target: "https://example.com/" })]} />)
    expect(screen.getAllByText("example.com").length).toBeGreaterThan(0)
  })

  it("renders favicon previews for desktop and mobile", () => {
    const { container } = render(<TargetsSurface rows={[buildRow({ faviconUrl: "https://example.com/favicon.ico" })]} />)
    expect(container.querySelectorAll('img[src="https://example.com/favicon.ico"]')).toHaveLength(2)
  })

  it("formats last scanned timestamps in the configured timezone", () => {
    const html = renderToString(
      <TimeZoneProvider initialTimeZone="America/New_York">
        <TargetsSurface rows={[buildRow()]} />
      </TimeZoneProvider>,
    )
    expect(html).toContain("3/23/26, 12:00 PM EDT")
    expect(html).not.toContain("3/23/26, 4:00 PM UTC")
  })

  it("falls back to an icon when favicon data is unavailable", () => {
    const { container } = render(<TargetsSurface rows={[buildRow({ faviconUrl: null })]} />)
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0)
  })
})
