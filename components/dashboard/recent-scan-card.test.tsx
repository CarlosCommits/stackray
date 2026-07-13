import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { RecentScanCard } from "@/components/dashboard/recent-scan-card"
import type { RecentScan } from "@/components/dashboard/types"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
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

const recentScanTimestampFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
})

const completeScan: RecentScan = {
  id: "1",
  target: "example.com",
  ip: "93.184.216.34",
  status: "complete",
  phase: "complete",
  phaseLabel: "Completed",
  timestamp: "2024-01-15T10:30:00Z",
  statusCode: 200,
  server: "nginx",
  cdn: "Fastly",
  redirectCount: 0,
  responseTimeMs: 145,
  techCount: 4,
  faviconUrl: "https://example.com/favicon.ico",
}

const completeScanWithoutFavicon: RecentScan = {
  id: "5",
  target: "noicon.test",
  ip: "—",
  status: "complete",
  phase: "complete",
  phaseLabel: "Completed",
  timestamp: "2024-01-15T10:30:00Z",
  statusCode: 200,
  server: "nginx",
  techCount: 1,
}

const analyzingScan: RecentScan = {
  id: "2",
  target: "analyzing.example.test",
  ip: "192.0.2.1",
  status: "analyzing",
  phase: "httpx",
  phaseLabel: "HTTP probe",
  phaseDescription: "Collecting HTTP and headless browser signals",
  timestamp: "2024-01-15T10:25:00Z",
  progress: 45,
}

const failedScan: RecentScan = {
  id: "3",
  target: "failed.example.test",
  ip: "0.0.0.0",
  status: "failed",
  phase: "failed",
  phaseLabel: "Failed",
  timestamp: "2024-01-15T10:20:00Z",
  error: "Connection timeout",
}

const analyzingScanWithoutProgress: RecentScan = {
  id: "4",
  target: "pending.test",
  ip: "198.51.100.10",
  status: "analyzing",
  phase: "queued",
  phaseLabel: "Queued",
  phaseDescription: "Waiting for worker capacity",
  timestamp: "2024-01-15T10:15:00Z",
}

const completeScanWithoutTechs: RecentScan = {
  ...completeScan,
  id: "5",
  techCount: 0,
}

describe("RecentScanCard", () => {
  it("tracks opening scan details from the dashboard", () => {
    const track = vi.fn()
    window.umami = { track }

    render(<RecentScanCard scan={completeScan} />)
    fireEvent.click(screen.getByText("View report"))

    expect(track).toHaveBeenCalledWith("scan_detail_opened", { source: "dashboard_recent" })
    delete window.umami
  })

  it("renders complete scan with target and status", () => {
    const { container } = render(<RecentScanCard scan={completeScan} />)

    expect(screen.getByText("example.com")).toBeTruthy()
    expect(screen.getByRole("status", { name: "Scan complete" })).toBeTruthy()
    expect(container.querySelector(`[data-slot="complete-status-indicator"] path`)).toBeTruthy()
    expect(container.querySelector(".dmx-dot")).toBeNull()
    expect(screen.queryByText("Done")).toBeNull()
  })

  it("renders scheme-less targets for schemeful stored values", () => {
    render(<RecentScanCard scan={{ ...completeScan, target: "https://example.com/" }} />)

    expect(screen.getByText("example.com")).toBeTruthy()
    expect(screen.queryByText("https://example.com/")).toBeNull()
  })

  it("renders analyzing scan with progress", () => {
    render(<RecentScanCard scan={analyzingScan} />)

    expect(screen.getByText("analyzing.example.test")).toBeTruthy()
    expect(screen.getByRole("status", { name: "Scan running" })).toBeTruthy()
    expect(screen.getByText("45%")).toBeTruthy()
    expect(screen.getByText("Collecting HTTP and headless browser signals")).toBeTruthy()
  })

  it("renders failed scan with error", () => {
    render(<RecentScanCard scan={failedScan} />)

    expect(screen.getByText("failed.example.test")).toBeTruthy()
    expect(screen.getByText("Failed")).toBeTruthy()
    expect(screen.getByText("Connection timeout")).toBeTruthy()
  })

  it("summarizes technologies without rendering preview badges", () => {
    render(<RecentScanCard scan={completeScan} />)

    expect(screen.getByText("4 technologies detected")).toBeTruthy()
    expect(screen.queryByText("Next.js")).toBeNull()
    expect(screen.queryByText("Cloudflare")).toBeNull()
    expect(screen.queryByText("React")).toBeNull()
    expect(screen.queryByText("TypeScript")).toBeNull()
  })

  it("renders a clear report action for complete scans", () => {
    render(<RecentScanCard scan={completeScan} />)

    expect(screen.getByText("View report")).toBeTruthy()
  })

  it("renders a clickable card for complete scan", () => {
    render(<RecentScanCard scan={completeScan} />)

    const card = screen.getByRole("link", { name: "View scan details for example.com" })
    expect(card).toBeTruthy()
    expect(card.className).toContain("[content-visibility:auto]")
    expect(card.className).toContain("[contain-intrinsic-size:auto_180px]")
    expect(document.querySelector('[data-slot="scan-card-navigation-cue"]')).toBeTruthy()
    expect(document.querySelector(".lucide-external-link")).toBeNull()
  })

  it("renders Running status for analyzing scan", () => {
    const { container } = render(<RecentScanCard scan={analyzingScan} />)

    expect(screen.getByText("HTTP probe")).toBeTruthy()
    expect(screen.getByText("Collecting HTTP and headless browser signals")).toBeTruthy()
    expect(screen.getAllByText("45%")).toHaveLength(1)
    expect(screen.getByText("View live scan")).toBeTruthy()
    expect(screen.getByRole("progressbar", { name: "Scan progress" }).getAttribute("aria-valuetext")).toBe(
      "45% complete, HTTP probe",
    )
    expect(screen.getByRole("list", { name: "Scan phases" })).toBeTruthy()
    const activePhase = screen.getByText("Probe").closest("li")
    expect(activePhase?.getAttribute("data-state")).toBe("active")
    expect(activePhase?.className).toContain("rounded-md")
    const indicator = container.querySelector(`[data-slot="scan-activity-indicator"]`)
    expect(indicator).toBeTruthy()
    expect(indicator?.getAttribute("data-animation-state")).toBe("running")
    expect(container.querySelector(`[data-slot="square-loader"]`)).toBeTruthy()
    expect(container.querySelector(".square-loader-snake")).toBeTruthy()
    expect(container.querySelector(".motion-safe\\:animate-pulse")).toBeNull()
    expect(container.querySelector(".dmx-outer-snake")).toBeNull()
    expect(container.querySelector(".dmx-middle-snake")).toBeNull()
  })

  it("does not render retry affordance for failed scan", () => {
    render(<RecentScanCard scan={failedScan} />)

    expect(screen.queryByText("Retry available")).toBeNull()
    expect(screen.getByText("Scan needs attention")).toBeTruthy()
    expect(screen.getByText("Review issue")).toBeTruthy()
  })

  it("bounds failed scan error detail to keep card compact", () => {
    render(<RecentScanCard scan={failedScan} />)

    const errorText = screen.getByText("Connection timeout")
    const errorContainer = errorText.parentElement
    expect(errorContainer).toBeTruthy()
    expect(errorContainer?.className).not.toContain("min-h-[78px]")
    expect(errorText.className).toContain("line-clamp-2")
  })

  it("renders tech count for complete scan", () => {
    render(<RecentScanCard scan={completeScan} />)

    expect(screen.getByText("4 technologies detected")).toBeTruthy()
  })

  it("renders server info for complete scan", () => {
    render(<RecentScanCard scan={completeScan} />)

    expect(screen.getByText("nginx")).toBeTruthy()
  })

  it("does not render response time in the redesigned complete scan card", () => {
    render(<RecentScanCard scan={completeScan} />)

    expect(screen.queryByText("145ms")).toBeNull()
  })

  it("defaults analyzing progress to zero when progress is missing", () => {
    render(<RecentScanCard scan={analyzingScanWithoutProgress} />)

    expect(screen.getByText("0%")).toBeTruthy()
    expect(screen.getByRole("status", { name: "Scan queued" })).toBeTruthy()
  })

  it("reserves the same details height for active and complete cards", () => {
    const activeRender = render(<RecentScanCard scan={analyzingScan} />)
    const activeDetailsClassName = activeRender.container.querySelector(
      `[data-slot="scan-card-details"]`,
    )?.className
    activeRender.unmount()

    const completeRender = render(<RecentScanCard scan={completeScan} />)
    const completeDetailsClassName = completeRender.container.querySelector(
      `[data-slot="scan-card-details"]`,
    )?.className

    expect(activeDetailsClassName).toContain("h-[60px]")
    expect(completeDetailsClassName).toBe(activeDetailsClassName)
  })

  it("renders zero technologies detected when a complete scan has no technologies", () => {
    render(<RecentScanCard scan={completeScanWithoutTechs} />)

    expect(screen.getByText("No technologies detected")).toBeTruthy()
  })

  it("formats the timestamp into a readable label", () => {
    render(<RecentScanCard scan={completeScan} />)

    expect(screen.getByText(recentScanTimestampFormatter.format(new Date(completeScan.timestamp)))).toBeTruthy()
    expect(screen.queryByText(completeScan.timestamp)).toBeNull()
  })

  it("hides the placeholder dash when scan ip is unavailable", () => {
    render(<RecentScanCard scan={completeScanWithoutFavicon} />)

    expect(screen.queryByText("—")).toBeNull()
  })

  it("renders favicon img when faviconUrl is provided", () => {
    render(<RecentScanCard scan={completeScan} />)

    const container = document.querySelector('img[src="https://example.com/favicon.ico"]')
    expect(container).toBeTruthy()
  })

  it("shows Globe icon fallback when no faviconUrl provided", () => {
    render(<RecentScanCard scan={completeScanWithoutFavicon} />)

    const globeSvg = document.querySelector(".lucide-globe")
    expect(globeSvg).toBeTruthy()
  })
})
