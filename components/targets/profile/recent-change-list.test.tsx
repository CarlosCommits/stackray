import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { RecentChangeList } from "@/components/targets/profile/recent-change-list"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ChangeFeedItem, ScanComparison } from "@/lib/contracts/changes"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}))

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const items: ChangeFeedItem[] = [{
  id: "body-change",
  category: "content",
  changeType: "body_fingerprint.changed",
  summary: "Response body changed",
  preview: "Response content differs from the baseline",
}]

const comparison: ScanComparison = {
  id: "comparison-1",
  canonicalTargetId: "target-1",
  status: "completed",
  algorithmVersion: 1,
  currentScan: {
    id: "scan-current",
    target: "https://example.test",
    completedAt: "2026-07-18T15:00:00.000Z",
    faviconUrl: null,
  },
  baselineScan: {
    id: "scan-baseline",
    target: "https://example.test",
    completedAt: "2026-07-17T15:00:00.000Z",
  },
  baselineMode: "previous",
  counts: { total: 1, alertEligible: 0 },
  items: [{
    id: "body-change",
    category: "content",
    changeType: "body_fingerprint.changed",
    fieldPath: "body_fingerprint.changed",
    summary: "Response body changed",
    endpointIdentity: "https://example.test/",
    before: { hashes: { body_md5: "before-md5" } },
    after: { hashes: { body_md5: "after-md5" } },
    alertEligible: false,
  }],
  errorMessage: null,
  createdAt: "2026-07-18T15:00:01.000Z",
}

function renderRecentChanges() {
  return render(
    <TooltipProvider>
      <RecentChangeList comparisonId="comparison-1" items={items} />
    </TooltipProvider>,
  )
}

describe("RecentChangeList", () => {
  it("renders recent changes as dialog buttons instead of route links", () => {
    renderRecentChanges()

    const row = screen.getByRole("button", { name: "Open Response body changed details" })
    expect(row).toHaveAttribute("aria-haspopup", "dialog")
    expect(screen.queryByRole("link", { name: /Response body changed/ })).not.toBeInTheDocument()
  })

  it("loads and opens the selected change without navigating", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => comparison,
    })
    vi.stubGlobal("fetch", fetchMock)
    renderRecentChanges()

    fireEvent.click(screen.getByRole("button", { name: "Open Response body changed details" }))

    expect(await screen.findByRole("article", { name: "Response body changed" })).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/changes/comparison-1", {
      headers: { Accept: "application/json" },
    })
  })
})
