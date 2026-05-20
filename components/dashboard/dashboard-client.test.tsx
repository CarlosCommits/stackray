import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DashboardClient } from "@/components/dashboard/dashboard-client"
import type { RecentScan } from "@/components/dashboard/types"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function buildCompleteScan(index: number): RecentScan {
  return {
    id: `scan-${index}`,
    target: `site-${index}.test`,
    ip: "—",
    status: "complete",
    phase: "complete",
    phaseLabel: "Completed",
    timestamp: "2024-01-15T10:30:00Z",
    technologies: [],
    techCount: 0,
  }
}

function buildAnalyzingScan(index: number): RecentScan {
  return {
    ...buildCompleteScan(index),
    status: "analyzing",
    phase: "httpx",
    phaseLabel: "HTTP probe",
    progress: 35,
  }
}

function getVisibleScanCards() {
  return screen.getAllByRole("link", { name: /View scan details for site-/ })
}

describe("DashboardClient", () => {
  it("renders a bounded initial page and fetches the next 32 scans from the server", async () => {
    const initialScans = Array.from({ length: 16 }, (_, index) => buildCompleteScan(index + 1))
    const nextScans = Array.from({ length: 32 }, (_, index) => buildCompleteScan(index + 17))
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args
      return new Response(
        JSON.stringify({ items: nextScans, nextCursor: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    })

    vi.stubGlobal("fetch", fetchMock)

    render(
      <DashboardClient
        initialRecentScans={initialScans}
        initialRecentScansNextCursor="cursor-16"
        stats={[]}
      />
    )

    expect(getVisibleScanCards()).toHaveLength(16)

    fireEvent.click(screen.getByRole("button", { name: "Load More" }))

    await waitFor(() => {
      expect(getVisibleScanCards()).toHaveLength(48)
    })

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost")
    expect(requestUrl.pathname).toBe("/api/v1/dashboard/recent-scans")
    expect(requestUrl.searchParams.get("cursor")).toBe("cursor-16")
    expect(requestUrl.searchParams.get("limit")).toBe("32")
  })

  it("hides Load More when the server reports no next page", async () => {
    const initialScans = Array.from({ length: 16 }, (_, index) => buildCompleteScan(index + 1))
    const finalScans = [buildCompleteScan(17)]

    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ items: finalScans, nextCursor: null }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )))

    render(
      <DashboardClient
        initialRecentScans={initialScans}
        initialRecentScansNextCursor="cursor-16"
        stats={[]}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Load More" }))

    await waitFor(() => {
      expect(getVisibleScanCards()).toHaveLength(17)
      expect(screen.queryByRole("button", { name: "Load More" })).toBeNull()
    })
  })

  it("keeps loaded pages when a stale polling response resolves after Load More", async () => {
    vi.useFakeTimers()

    const initialScans = [
      buildAnalyzingScan(1),
      ...Array.from({ length: 15 }, (_, index) => buildCompleteScan(index + 2)),
    ]
    const nextScans = Array.from({ length: 32 }, (_, index) => buildCompleteScan(index + 17))
    let resolvePoll: (() => void) | null = null
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = new URL(String(input), "http://localhost")

      if (requestUrl.searchParams.has("cursor")) {
        return Promise.resolve(new Response(
          JSON.stringify({ items: nextScans, nextCursor: null }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ))
      }

      return new Promise<Response>((resolve) => {
        resolvePoll = () => resolve(new Response(
          JSON.stringify({ items: initialScans, nextCursor: "cursor-16" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ))
      })
    })

    vi.stubGlobal("fetch", fetchMock)

    render(
      <DashboardClient
        initialRecentScans={initialScans}
        initialRecentScansNextCursor="cursor-16"
        stats={[]}
      />
    )

    await act(async () => {
      vi.advanceTimersByTime(2_500)
    })

    fireEvent.click(screen.getByRole("button", { name: "Load More" }))

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(getVisibleScanCards()).toHaveLength(48)

    await act(async () => {
      resolvePoll?.()
      await Promise.resolve()
    })

    expect(getVisibleScanCards()).toHaveLength(48)
  })

  it("does not expand the polling window after an optimistic scan appears in server data", async () => {
    vi.useFakeTimers()

    const initialScans = [
      buildAnalyzingScan(1),
      ...Array.from({ length: 15 }, (_, index) => buildCompleteScan(index + 2)),
    ]
    const refreshedScans = [
      buildAnalyzingScan(17),
      ...initialScans.slice(0, 15),
    ]
    const refreshedWindow = [...refreshedScans, buildCompleteScan(16)]
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = new URL(String(input), "http://localhost")

      if (requestUrl.pathname === "/api/v1/scans") {
        return Promise.resolve(new Response(
          JSON.stringify({ scanId: "scan-17", status: "queued" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ))
      }

      const limit = Number(requestUrl.searchParams.get("limit") ?? "0")
      return Promise.resolve(new Response(
        JSON.stringify({
          items: refreshedWindow.slice(0, limit),
          nextCursor: limit < refreshedWindow.length ? "cursor-17" : null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ))
    })

    vi.stubGlobal("fetch", fetchMock)

    const { rerender } = render(
      <DashboardClient
        initialRecentScans={initialScans}
        initialRecentScansNextCursor="cursor-16"
        stats={[]}
      />
    )

    fireEvent.change(screen.getByLabelText("Target domain or URL"), {
      target: { value: "site-17.test" },
    })
    fireEvent.click(screen.getByRole("button", { name: "SCAN" }))

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(getVisibleScanCards()).toHaveLength(17)

    rerender(
      <DashboardClient
        initialRecentScans={refreshedScans}
        initialRecentScansNextCursor="cursor-15"
        stats={[]}
      />
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(getVisibleScanCards()).toHaveLength(17)

    await act(async () => {
      vi.advanceTimersByTime(2_500)
      await Promise.resolve()
      await Promise.resolve()
    })

    const dashboardPollCall = fetchMock.mock.calls.find(([input]) => (
      String(input).startsWith("/api/v1/dashboard/recent-scans")
    ))
    if (!dashboardPollCall) {
      throw new Error("Expected dashboard poll request")
    }

    const pollUrl = new URL(String(dashboardPollCall[0]), "http://localhost")
    expect(pollUrl.searchParams.get("limit")).toBe("17")
  })

  it("preserves the current cursor when refreshed props do not include all loaded rows", async () => {
    const initialScans = Array.from({ length: 16 }, (_, index) => buildCompleteScan(index + 1))
    const refreshedScans = [
      buildCompleteScan(17),
      ...initialScans.slice(0, 15),
    ]
    const nextScans = Array.from({ length: 32 }, (_, index) => buildCompleteScan(index + 18))
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args
      return new Response(
        JSON.stringify({ items: nextScans, nextCursor: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    })

    vi.stubGlobal("fetch", fetchMock)

    const { rerender } = render(
      <DashboardClient
        initialRecentScans={initialScans}
        initialRecentScansNextCursor="cursor-16"
        stats={[]}
      />
    )

    rerender(
      <DashboardClient
        initialRecentScans={refreshedScans}
        initialRecentScansNextCursor="cursor-15"
        stats={[]}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("site-17.test")).toBeTruthy()
      expect(screen.getByText("site-16.test")).toBeTruthy()
    })

    fireEvent.click(screen.getByRole("button", { name: "Load More" }))

    await waitFor(() => {
      expect(getVisibleScanCards()).toHaveLength(49)
    })

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost")
    expect(requestUrl.searchParams.get("cursor")).toBe("cursor-16")
  })

  it("shows a Load More error when the page request fails", async () => {
    const initialScans = Array.from({ length: 16 }, (_, index) => buildCompleteScan(index + 1))

    vi.stubGlobal("fetch", vi.fn(async () => new Response("Nope", { status: 500 })))

    render(
      <DashboardClient
        initialRecentScans={initialScans}
        initialRecentScansNextCursor="cursor-16"
        stats={[]}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Load More" }))

    expect(await screen.findByText("Recent scans request failed.")).toBeTruthy()
    expect(getVisibleScanCards()).toHaveLength(16)
  })

  it("reconciles refreshed props so instant completed scans show zero tech", async () => {
    const analyzingScan = buildAnalyzingScan(1)
    const completeWithoutTechCount = buildCompleteScan(1)
    delete completeWithoutTechCount.techCount
    const { rerender } = render(
      <DashboardClient
        initialRecentScans={[analyzingScan]}
        initialRecentScansNextCursor={null}
        stats={[]}
      />
    )

    rerender(
      <DashboardClient
        initialRecentScans={[completeWithoutTechCount]}
        initialRecentScansNextCursor={null}
        stats={[]}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("0 tech")).toBeTruthy()
    })
    expect(screen.queryByText("Retry available")).toBeNull()
  })
})
