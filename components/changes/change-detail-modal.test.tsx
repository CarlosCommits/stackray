import { render, screen, waitFor } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { ChangeDetailModal } from "@/components/changes/change-detail-modal"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ScanComparison } from "@/lib/contracts/changes"

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

const comparison: ScanComparison = {
  id: "comparison-1",
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

describe("ChangeDetailModal", () => {
  it("focuses the change heading instead of opening the first copy tooltip", async () => {
    render(
      <TooltipProvider>
        <ChangeDetailModal
          comparison={comparison}
          initialItemId="body-change"
          closeHref="/targets/target-id/changes"
        />
      </TooltipProvider>,
    )

    const heading = screen.getByRole("heading", { name: "Response body changed" })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(screen.queryByText("Copy full fingerprint")).not.toBeInTheDocument()
  })
})
