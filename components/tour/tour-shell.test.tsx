import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { TourShell } from "@/components/tour"

let pathname = "/dashboard"

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}))

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

describe("TourShell", () => {
  beforeEach(() => {
    pathname = "/dashboard"
    vi.useRealTimers()
    vi.clearAllMocks()
    document.body.innerHTML = ""
    vi.stubGlobal("ResizeObserver", ResizeObserverMock)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => ({ top: 20, left: 20, right: 220, bottom: 80, width: 200, height: 60, x: 20, y: 20, toJSON() {} }) as DOMRect,
    )
  })

  it("starts the route tour and persists completion once dismissed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ completedTours: ["dashboard-quick-scan"], lastSeenReleaseVersion: null }) })),
    )

    render(
      <>
        <div data-tour="dashboard-search">search</div>
        <div data-tour="dashboard-stats">stats</div>
        <div data-tour="dashboard-recent-scans">recent scans</div>
        <TourShell completedTours={[]} />
      </>,
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 650))
    })

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /quick scan/i })).toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: "Escape" })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/v1/me/product-state", expect.objectContaining({ method: "PATCH" }))
    })
  })
})
