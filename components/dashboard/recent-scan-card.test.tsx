import { render, screen } from "@testing-library/react"
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
  timeZone: "UTC",
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
  technologies: ["Next.js", "Cloudflare", "React", "TypeScript"],
  statusCode: 200,
  server: "nginx",
  cdn: "Cloudflare",
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
  technologies: ["Nginx"],
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
  technologies: [],
}

describe("RecentScanCard", () => {
  it("renders complete scan with target and status", () => {
    render(<RecentScanCard scan={completeScan} />)

    expect(screen.getByText("example.com")).toBeTruthy()
    expect(screen.getByText("Done")).toBeTruthy()
  })

  it("renders scheme-less targets for schemeful stored values", () => {
    render(<RecentScanCard scan={{ ...completeScan, target: "https://example.com/" }} />)

    expect(screen.getByText("example.com")).toBeTruthy()
    expect(screen.queryByText("https://example.com/")).toBeNull()
  })

  it("renders analyzing scan with progress", () => {
    render(<RecentScanCard scan={analyzingScan} />)

    expect(screen.getByText("analyzing.example.test")).toBeTruthy()
    expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy()
    expect(screen.getByText("45%")).toBeTruthy()
    expect(screen.getByText("Collecting HTTP and headless browser signals")).toBeTruthy()
  })

  it("renders failed scan with error", () => {
    render(<RecentScanCard scan={failedScan} />)

    expect(screen.getByText("failed.example.test")).toBeTruthy()
    expect(screen.getByText("Failed")).toBeTruthy()
    expect(screen.getByText("Connection timeout")).toBeTruthy()
  })

  it("renders technologies for complete scan", () => {
    render(<RecentScanCard scan={completeScan} />)

    expect(screen.getByText("Next.js")).toBeTruthy()
    expect(screen.getAllByText("Cloudflare").length).toBeGreaterThan(0)
    expect(screen.queryByText("React")).toBeNull()
    expect(screen.getByText("+2 more")).toBeTruthy()
  })

  it("renders a clickable card for complete scan", () => {
    render(<RecentScanCard scan={completeScan} />)

    expect(screen.getByRole("link", { name: "View scan details for example.com" })).toBeTruthy()
    expect(screen.getByText("Open scan")).toBeTruthy()
  })

  it("renders Running status for analyzing scan", () => {
    const { container } = render(<RecentScanCard scan={analyzingScan} />)

    expect(screen.getByText("Live details")).toBeTruthy()
    expect(screen.getByText("Analysis in progress...")).toBeTruthy()
    expect(container.querySelector(".motion-safe\\:animate-pulse")).toBeTruthy()
  })

  it("renders open scan affordance for failed scan", () => {
    render(<RecentScanCard scan={failedScan} />)

    expect(screen.getByText("Open scan")).toBeTruthy()
  })

  it("renders tech count for complete scan", () => {
    render(<RecentScanCard scan={completeScan} />)

    expect(screen.getByText("4 technologies detected")).toBeTruthy()
  })

  it("renders server info for complete scan", () => {
    render(<RecentScanCard scan={completeScan} />)

    expect(screen.getByText("nginx")).toBeTruthy()
  })

  it("renders response time for complete scan", () => {
    render(<RecentScanCard scan={completeScan} />)

    expect(screen.getByText("145ms")).toBeTruthy()
  })

  it("defaults analyzing progress to zero when progress is missing", () => {
    render(<RecentScanCard scan={analyzingScanWithoutProgress} />)

    expect(screen.getByText("0%")).toBeTruthy()
  })

  it("renders zero technologies detected when a complete scan has no technologies", () => {
    render(<RecentScanCard scan={completeScanWithoutTechs} />)

    expect(screen.getByText("0 technologies detected")).toBeTruthy()
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
