import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { RecentScanCard } from "@/components/dashboard/recent-scan-card"
import type { RecentScan } from "@/components/dashboard/types"

const completeScan: RecentScan = {
  id: "1",
  target: "example.com",
  ip: "93.184.216.34",
  status: "complete",
  timestamp: "2024-01-15T10:30:00Z",
  technologies: ["Next.js", "Cloudflare", "React", "TypeScript"],
  statusCode: 200,
  server: "nginx",
  cdn: "Cloudflare",
  redirectCount: 0,
  responseTimeMs: 145,
  techCount: 4,
}

const analyzingScan: RecentScan = {
  id: "2",
  target: "analyzing.example.test",
  ip: "192.0.2.1",
  status: "analyzing",
  timestamp: "2024-01-15T10:25:00Z",
  progress: 45,
}

const failedScan: RecentScan = {
  id: "3",
  target: "failed.example.test",
  ip: "0.0.0.0",
  status: "failed",
  timestamp: "2024-01-15T10:20:00Z",
  error: "Connection timeout",
}

const analyzingScanWithoutProgress: RecentScan = {
  id: "4",
  target: "pending.test",
  ip: "198.51.100.10",
  status: "analyzing",
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

  it("renders analyzing scan with progress", () => {
    render(<RecentScanCard scan={analyzingScan} />)

    expect(screen.getByText("analyzing.example.test")).toBeTruthy()
    expect(screen.getByText("Active")).toBeTruthy()
    expect(screen.getByText("45%")).toBeTruthy()
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
    expect(screen.getByText("React")).toBeTruthy()
    expect(screen.getByText("+1 more")).toBeTruthy()
  })

  it("renders View Details link for complete scan", () => {
    render(<RecentScanCard scan={completeScan} />)

    expect(screen.getByText("View Details")).toBeTruthy()
  })

  it("renders Running status for analyzing scan", () => {
    const { container } = render(<RecentScanCard scan={analyzingScan} />)

    expect(screen.getByText("Running")).toBeTruthy()
    expect(screen.getByText("Analysis in progress…")).toBeTruthy()
    expect(container.querySelector(".motion-safe\\:animate-pulse")).toBeTruthy()
  })

  it("renders Retry button for failed scan", () => {
    render(<RecentScanCard scan={failedScan} />)

    expect(screen.getByText("Retry")).toBeTruthy()
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
})
