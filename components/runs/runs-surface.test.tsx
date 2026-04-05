import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import type { RunsRow } from "./types"
import { RunsSurface } from "./runs-surface"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

const mockToggleSort = vi.fn()

function buildRow(overrides: Partial<RunsRow> = {}): RunsRow {
  return {
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
    targetUrls: ["example.com", "test-target.example.test", "demo-target.example.test"],
    hiddenTargetCount: 0,
    faviconUrl: null,
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
      totalCount: 3,
      hiddenCount: 0,
      truncated: false,
      overflowLabel: null,
      searchTokens: ["WordPress", "WooCommerce", "PHP"],
    },
    filters: {
      hiddenTargets: [],
    },
    ...overrides,
  }
}

describe("RunsSurface", () => {
  beforeEach(() => {
    mockToggleSort.mockClear()
  })

  describe("favicon rendering", () => {
    it("renders favicon preview for row with a valid favicon url", () => {
      const { container } = render(
        <RunsSurface rows={[buildRow({ faviconUrl: "https://example.com/favicon.ico" })]} sortOrder="newest" onToggleSortOrder={mockToggleSort} />,
      )

      const images = container.querySelectorAll("img")
      expect(images.length).toBeGreaterThan(0)
      expect(images[0]).toHaveAttribute("src", "https://example.com/favicon.ico")
    })

    it("falls back to globe icon when favicon url is missing", () => {
      const { container } = render(<RunsSurface rows={[buildRow({ faviconUrl: null })]} sortOrder="newest" onToggleSortOrder={mockToggleSort} />)

      expect(container.querySelector("img")).toBeNull()
      const svgIcons = container.querySelectorAll("svg")
      expect(svgIcons.length).toBeGreaterThan(0)
    })

    it("falls back to globe icon when favicon url is invalid", () => {
      const { container } = render(
        <RunsSurface rows={[buildRow({ faviconUrl: "not-a-valid-url" })]} sortOrder="newest" onToggleSortOrder={mockToggleSort} />,
      )

      expect(container.querySelector("img")).toBeNull()
    })
  })

  describe("column structure", () => {
    it("does not have a target count column header", () => {
      render(<RunsSurface rows={[buildRow()]} sortOrder="newest" onToggleSortOrder={mockToggleSort} />)

      const headers = screen.getAllByRole("columnheader")
      const headerTexts = headers.map((h) => h.textContent)
      expect(headerTexts).not.toContain("Target count")
    })

    it("has a targets column header", () => {
      render(<RunsSurface rows={[buildRow()]} sortOrder="newest" onToggleSortOrder={mockToggleSort} />)

      const headers = screen.getAllByRole("columnheader")
      const headerTexts = headers.map((h) => h.textContent)
      expect(headerTexts).toContain("Targets")
    })
  })

  describe("row interaction affordance", () => {
    it("renders rows with link role for keyboard navigation", () => {
      render(<RunsSurface rows={[buildRow()]} sortOrder="newest" onToggleSortOrder={mockToggleSort} />)

      const links = screen.getAllByRole("link")
      expect(links.length).toBeGreaterThan(0)
    })

    it("row is keyboard accessible with tabIndex", () => {
      const { container } = render(<RunsSurface rows={[buildRow()]} sortOrder="newest" onToggleSortOrder={mockToggleSort} />)

      const focusableRows = container.querySelectorAll('[tabIndex="0"]')
      expect(focusableRows.length).toBeGreaterThan(0)
    })

    it("does not render chevron arrow buttons", () => {
      const { container } = render(<RunsSurface rows={[buildRow()]} sortOrder="newest" onToggleSortOrder={mockToggleSort} />)

      const chevronIcons = container.querySelectorAll('[data-lucide="chevron-right"]')
      expect(chevronIcons.length).toBe(0)
    })

    it("does not render view details buttons", () => {
      const { container } = render(<RunsSurface rows={[buildRow()]} sortOrder="newest" onToggleSortOrder={mockToggleSort} />)

      const viewDetailsButtons = container.querySelectorAll("button")
      const viewDetailsTexts = Array.from(viewDetailsButtons).map((b) => b.textContent)
      expect(viewDetailsTexts).not.toContain("View details")
    })
  })

  describe("favicon for first displayed target", () => {
    it("shows favicon corresponding to first target url", () => {
      const row = buildRow({
        targetUrls: ["https://first-target.example.test", "https://second-target.example.test"],
        faviconUrl: "https://first-target.example.test/favicon.ico",
      })
      const { container } = render(<RunsSurface rows={[row]} sortOrder="newest" onToggleSortOrder={mockToggleSort} />)

      const images = container.querySelectorAll("img")
      expect(images[0]).toHaveAttribute("src", "https://first-target.example.test/favicon.ico")
    })
  })

  describe("sort header accessibility", () => {
    it("has a sort button in the submitted at column header", () => {
      render(<RunsSurface rows={[buildRow()]} sortOrder="newest" onToggleSortOrder={mockToggleSort} />)

      const sortButton = screen.getByRole("button", { name: /sort by submitted at/i })
      expect(sortButton).toBeInTheDocument()
    })

    it("sort button is keyboard accessible", () => {
      render(<RunsSurface rows={[buildRow()]} sortOrder="newest" onToggleSortOrder={mockToggleSort} />)

      const sortButton = screen.getByRole("button", { name: /sort by submitted at/i })
      expect(sortButton).toHaveAttribute("type", "button")
    })

    it("sort button has accessible label describing current sort state", () => {
      const { rerender } = render(<RunsSurface rows={[buildRow()]} sortOrder="newest" onToggleSortOrder={mockToggleSort} />)

      expect(screen.getByRole("button", { name: /sort by submitted at, currently newest first/i })).toBeInTheDocument()

      rerender(<RunsSurface rows={[buildRow()]} sortOrder="oldest" onToggleSortOrder={mockToggleSort} />)
      expect(screen.getByRole("button", { name: /sort by submitted at, currently oldest first/i })).toBeInTheDocument()
    })
  })

  describe("loading placeholder behavior", () => {
    it("renders 5 placeholder rows when isLoading is true", () => {
      const { container } = render(
        <RunsSurface rows={[]} sortOrder="newest" onToggleSortOrder={mockToggleSort} isLoading={true} />,
      )

      const placeholderRows = container.querySelectorAll('[class*="animate-pulse"]')
      expect(placeholderRows.length).toBeGreaterThanOrEqual(5)
    })

    it("does not render placeholder rows when isLoading is false", () => {
      const { container } = render(
        <RunsSurface rows={[buildRow()]} sortOrder="newest" onToggleSortOrder={mockToggleSort} isLoading={false} />,
      )

      const placeholderRows = container.querySelectorAll('[class*="animate-pulse"]')
      expect(placeholderRows.length).toBe(0)
    })

    it("renders placeholder rows alongside actual rows when isLoading is true with existing rows", () => {
      const { container } = render(
        <RunsSurface rows={[buildRow()]} sortOrder="newest" onToggleSortOrder={mockToggleSort} isLoading={true} />,
      )

      const placeholderRows = container.querySelectorAll('[class*="animate-pulse"]')
      expect(placeholderRows.length).toBeGreaterThanOrEqual(5)
    })
  })
})
