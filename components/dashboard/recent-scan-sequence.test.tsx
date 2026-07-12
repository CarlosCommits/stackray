import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { RecentScanSequence } from "@/components/dashboard/recent-scan-sequence"
import type { RecentScan } from "@/components/dashboard/types"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

const mockScans: RecentScan[] = [
  {
    id: "1",
    target: "example.com",
    ip: "93.184.216.34",
    status: "complete",
    phase: "complete",
    phaseLabel: "Completed",
    timestamp: "2024-01-15T10:30:00Z",
    statusCode: 200,
    server: "nginx",
    techCount: 2,
  },
  {
    id: "2",
    target: "analyzing.example.test",
    ip: "192.0.2.1",
    status: "analyzing",
    phase: "httpx",
    phaseLabel: "HTTP probe",
    phaseDescription: "Collecting HTTP and headless browser signals",
    timestamp: "2024-01-15T10:25:00Z",
    progress: 45,
  },
]

describe("RecentScanSequence", () => {
  it("renders scan cards when scans are provided", () => {
    render(<RecentScanSequence scans={mockScans} />)

    expect(screen.getByText("example.com")).toBeTruthy()
    expect(screen.getByText("analyzing.example.test")).toBeTruthy()
  })

  it("renders empty state when no scans are provided", () => {
    render(<RecentScanSequence scans={[]} />)

    expect(screen.getByText("No recent scans")).toBeTruthy()
    expect(screen.getByText("Run your first scan to see results here")).toBeTruthy()
  })

  it("renders section header", () => {
    render(<RecentScanSequence scans={mockScans} />)

    expect(screen.getByText("RECENT_SCAN_SEQUENCE")).toBeTruthy()
  })

  it("does not render View Runs link", () => {
    render(<RecentScanSequence scans={mockScans} />)

    expect(screen.queryByText("View_Runs")).toBeNull()
  })

  it("renders load more action when more scans are available", () => {
    const onLoadMore = vi.fn()

    render(
      <RecentScanSequence
        scans={mockScans}
        hasMore
        onLoadMore={onLoadMore}
      />
    )

    const button = screen.getByRole("button", { name: "Load More" })
    expect(button).toBeTruthy()

    fireEvent.click(button)

    expect(onLoadMore).toHaveBeenCalledOnce()
  })
})
