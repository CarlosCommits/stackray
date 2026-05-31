import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react"

import type { RunsRow } from "./types"
import { RunsClient } from "./runs-client"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

const DEBOUNCE_MS = 275

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

beforeEach(() => {
  mockFetch.mockReset()
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
      apiKeyId: null,
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
    faviconUrl: null,
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
      label: "automation-api-key",
      kind: "apiKey",
      userId: null,
      apiKeyId: "key_001",
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
  it("renders the target column header", () => {
    render(<RunsClient initialRows={mockRows} initialNextCursor={null} />)

    expect(screen.getAllByRole("columnheader").some((header) => header.textContent?.includes("Targets"))).toBe(true)
  })

  it("shows result badge when server returns filtered results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ items: [mockRows[1]], nextCursor: null }),
    })

    render(<RunsClient initialRows={mockRows} initialNextCursor={null} />)

    fireEvent.change(screen.getByPlaceholderText(/search by scan id, creator, technology, or target/i), {
      target: { value: "api.example" },
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 50))
    })

    expect(screen.getByText("1 run")).toBeInTheDocument()
  })

  it("does not show result badge when no active filters", () => {
    render(<RunsClient initialRows={mockRows} initialNextCursor={null} />)

    expect(screen.queryByText(/runs/)).not.toBeInTheDocument()
  })

  it("filters by status and shows filtered results", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("status=completed")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [mockRows[0]], nextCursor: null }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: mockRows, nextCursor: null }),
      })
    })

    render(<RunsClient initialRows={mockRows} initialNextCursor={null} />)

    const statusSelect = screen.getByRole("combobox", { name: /status/i })
    fireEvent.click(statusSelect)
    const option = screen.getByRole("option", { name: "Completed" })
    fireEvent.click(option)

    await waitFor(() => {
      expect(screen.queryAllByText("automation-api-key")).toHaveLength(0)
    })
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0)
  })

  it("clears active filters and hides result badge", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ items: [mockRows[0]], nextCursor: null }),
    })

    render(<RunsClient initialRows={mockRows} initialNextCursor={null} />)

    fireEvent.change(screen.getByPlaceholderText(/search by scan id, creator, technology, or target/i), {
      target: { value: "scn_001" },
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 50))
    })

    expect(screen.getByText("1 run")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 50))
    })

    expect(screen.queryByText(/run/)).not.toBeInTheDocument()
  })

  it("displays rows in default newest-first order", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: mockRows, nextCursor: null }),
    })

    render(<RunsClient initialRows={mockRows} initialNextCursor={null} />)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 50))
    })

    const submittedAtLabels = screen.getAllByText(/Mar 23, 2026/)
    expect(submittedAtLabels[0].textContent).toBe("Mar 23, 2026, 2:00 PM")
    expect(submittedAtLabels[1].textContent).toBe("Mar 23, 2026, 1:00 PM")
  })

  it("toggles to oldest-first order when sort button is clicked", async () => {
    const sortedByOldest = [...mockRows].sort(
      (a, b) => new Date(a.submittedAt.iso).getTime() - new Date(b.submittedAt.iso).getTime(),
    )

    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: sortedByOldest, nextCursor: null }),
      }),
    )

    render(<RunsClient initialRows={mockRows} initialNextCursor={null} />)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 100))
    })

    fireEvent.click(screen.getByRole("button", { name: /sort by submitted at/i }))

    await waitFor(() => {
      const submittedAtLabels = screen.getAllByText(/Mar 23, 2026/)
      expect(submittedAtLabels[0].textContent).toBe("Mar 23, 2026, 1:00 PM")
    })
  })

  it("returns to newest-first after second click on sort button", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: mockRows, nextCursor: null }),
    })

    render(<RunsClient initialRows={mockRows} initialNextCursor={null} />)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 50))
    })

    fireEvent.click(screen.getByRole("button", { name: /sort by submitted at/i }))
    fireEvent.click(screen.getByRole("button", { name: /sort by submitted at/i }))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 50))
    })

    const submittedAtLabels = screen.getAllByText(/Mar 23, 2026/)
    expect(submittedAtLabels[0].textContent).toBe("Mar 23, 2026, 2:00 PM")
    expect(submittedAtLabels[1].textContent).toBe("Mar 23, 2026, 1:00 PM")
  })

  it("shows Load more button when server returns nextCursor", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ items: [mockRows[0]], nextCursor: "cursor-abc" }),
    })

    render(<RunsClient initialRows={mockRows} initialNextCursor={null} />)

    fireEvent.change(screen.getByPlaceholderText(/search by scan id, creator, technology, or target/i), {
      target: { value: "ada" },
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 50))
    })

    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument()
  })

  it("appends rows when Load more is clicked", async () => {
    const secondPageRows: RunsRow[] = [
      {
        ...mockRows[0],
        scanId: "scn_003",
        href: "/scans/scn_003",
        submittedAt: {
          iso: "2026-03-23T12:00:00.000Z",
          label: "Mar 23, 2026, 12:00 PM",
        },
      },
    ]

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [mockRows[0]], nextCursor: "cursor-abc" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: secondPageRows, nextCursor: null }),
      })

    render(<RunsClient initialRows={mockRows} initialNextCursor={null} />)

    fireEvent.change(screen.getByPlaceholderText(/search by scan id, creator, technology, or target/i), {
      target: { value: "ada" },
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 50))
    })

    const loadMoreBtn = screen.getByRole("button", { name: /load more/i })
    fireEvent.click(loadMoreBtn)

    await waitFor(() => {
      expect(screen.getAllByText(/Mar 23, 2026/).length).toBeGreaterThanOrEqual(2)
    })
  })

  it("disables Load more button while loading more", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("cursor=")) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({ items: [mockRows[1]], nextCursor: null }),
            })
          }, 100)
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: [mockRows[0]], nextCursor: "cursor-abc" }),
      })
    })

    render(<RunsClient initialRows={mockRows} initialNextCursor={null} />)

    fireEvent.change(screen.getByPlaceholderText(/search by scan id, creator, technology, or target/i), {
      target: { value: "ada" },
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 50))
    })

    const loadMoreBtn = screen.getByRole("button", { name: /load more/i })
    expect(loadMoreBtn).not.toBeDisabled()

    fireEvent.click(loadMoreBtn)

    await waitFor(() => {
      expect(loadMoreBtn).toBeDisabled()
    })
  })

  it("resets pagination when search changes", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [mockRows[0]], nextCursor: "cursor-abc" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [mockRows[1]], nextCursor: null }),
      })

    render(<RunsClient initialRows={mockRows} initialNextCursor={null} />)

    const searchInput = screen.getByPlaceholderText(/search by scan id, creator, technology, or target/i)

    fireEvent.change(searchInput, { target: { value: "ada" } })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 50))
    })

    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: "api" } })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 50))
    })

    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument()
  })
})
