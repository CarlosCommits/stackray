import { beforeAll, describe, expect, it } from "vitest"
import { render } from "@testing-library/react"

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
    lastScannedAt: {
      iso: "2026-03-23T16:00:12.000Z",
      label: "Mar 23, 2026, 4:00 PM UTC",
    },
    latestScan: {
      scanId: "scn_01J_target_demo",
      href: "/scans/scn_01J_target_demo",
      label: "Open latest scan",
      ariaLabel: "Open latest scan for https://example.com",
    },
    faviconUrl: null,
    ...overrides,
  }
}

describe("TargetsSurface", () => {
  it("renders favicon previews for rows with a valid favicon url", () => {
    const { container } = render(<TargetsSurface rows={[buildRow({ faviconUrl: "https://example.com/favicon.ico" })]} />)

    const images = container.querySelectorAll("img")
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute("src", "https://example.com/favicon.ico")
    expect(images[1]).toHaveAttribute("src", "https://example.com/favicon.ico")
  })

  it("falls back to the globe icon when favicon url is missing or invalid", () => {
    const { rerender, container } = render(<TargetsSurface rows={[buildRow({ faviconUrl: null })]} />)

    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelectorAll("svg")).not.toHaveLength(0)

    rerender(<TargetsSurface rows={[buildRow({ faviconUrl: "-1830687435" })]} />)

    expect(container.querySelector("img")).toBeNull()
  })
})
