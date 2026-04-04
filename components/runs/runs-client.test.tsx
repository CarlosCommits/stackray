import { beforeAll, describe, expect, it } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import type { RunsRow } from "./types"
import { RunsClient } from "./runs-client"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

const mockRows: RunsRow[] = [
  {
    scanId: "scn_001",
    href: "/scans/scn_001",
    submittedAt: {
      iso: "2026-03-23T14:00:00.000Z",
      label: "Mar 23, 2026, 2:00 PM",
    },
    targetCount: {
      value: 3,
      label: "3 targets",
    },
    targetUrls: ["example.com", "test.com", "demo.com"],
    hiddenTargetCount: 0,
    status: {
      rawValue: "completed",
      value: "completed",
      label: "Completed",
    },
    source: {
      value: "ui",
      label: "UI",
    },
    createdBy: {
      label: "Ada Lovelace",
      kind: "user",
      userId: "usr_001",
      tokenId: null,
    },
    duration: {
      label: "12.0s",
      milliseconds: 12000,
      submittedAtIso: "2026-03-23T14:00:00.000Z",
      completedAtIso: "2026-03-23T14:00:12.000Z",
    },
    topTechnologies: {
      visibleItems: ["WordPress", "WooCommerce", "PHP"],
      totalCount: 5,
      hiddenCount: 2,
      truncated: true,
      overflowLabel: "+2 more",
      searchTokens: ["WordPress", "WooCommerce", "PHP", "Jetpack", "MySQL"],
    },
    filters: {
      hiddenTargets: ["example.com", "test.com", "demo.com"],
    },
  },
  {
    scanId: "scn_002",
    href: "/scans/scn_002",
    submittedAt: {
      iso: "2026-03-23T13:00:00.000Z",
      label: "Mar 23, 2026, 1:00 PM",
    },
    targetCount: {
      value: 1,
      label: "1 target",
    },
    targetUrls: ["api.example.com"],
    hiddenTargetCount: 0,
    status: {
      rawValue: "running",
      value: "running",
      label: "Running",
    },
    source: {
      value: "api",
      label: "API",
    },
    createdBy: {
      label: "automation-token",
      kind: "token",
      userId: null,
      tokenId: "tok_001",
    },
    duration: {
      label: "--",
      milliseconds: null,
      submittedAtIso: "2026-03-23T13:00:00.000Z",
      completedAtIso: null,
    },
    topTechnologies: {
      visibleItems: ["Next.js", "PostgreSQL"],
      totalCount: 2,
      hiddenCount: 0,
      truncated: false,
      overflowLabel: null,
      searchTokens: ["Next.js", "PostgreSQL"],
    },
    filters: {
      hiddenTargets: ["api.example.com"],
    },
  },
]

describe("RunsClient", () => {
  it("renders the default runs title and target column", () => {
    render(<RunsClient initialRows={mockRows} />)

    expect(screen.getByText("Scan Runs")).toBeInTheDocument()
    expect(screen.getAllByRole("columnheader").some((header) => header.textContent?.includes("Targets"))).toBe(true)
  })

  it("renders a custom title when provided", () => {
    render(<RunsClient initialRows={mockRows} title="Custom Runs Title" />)

    expect(screen.getByText("Custom Runs Title")).toBeInTheDocument()
  })

  it("filters by target url substring", () => {
    render(<RunsClient initialRows={mockRows} />)

    fireEvent.change(screen.getByPlaceholderText(/search by scan id, creator, technology, or target/i), {
      target: { value: "api.example" },
    })

    expect(screen.getAllByRole("link", { name: /view details for scan scn_002/i }).length).toBeGreaterThan(0)
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument()
  })

  it("filters by status", () => {
    render(<RunsClient initialRows={mockRows} />)

    fireEvent.click(screen.getByRole("combobox", { name: /status/i }))
    fireEvent.click(screen.getByRole("option", { name: "Completed" }))

    expect(screen.getAllByRole("link", { name: /view details for scan scn_001/i }).length).toBeGreaterThan(0)
  })

  it("clears active filters", () => {
    render(<RunsClient initialRows={mockRows} />)

    fireEvent.change(screen.getByPlaceholderText(/search by scan id, creator, technology, or target/i), {
      target: { value: "scn_001" },
    })

    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }))

    expect(screen.getByText("2 runs")).toBeInTheDocument()
  })
})
