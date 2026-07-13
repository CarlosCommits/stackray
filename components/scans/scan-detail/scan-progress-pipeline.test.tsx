import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"

import { ScanProgressPipeline } from "@/components/scans/scan-detail/scan-progress-pipeline"
import type { ScanPhaseRun } from "@/lib/contracts/scans"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

const submittedAt = "2026-03-27T00:00:00.000Z"

function buildPhase(
  phase: ScanPhaseRun["phase"],
  status: ScanPhaseRun["status"],
  overrides: Partial<ScanPhaseRun> = {},
): ScanPhaseRun {
  const isTerminal = status === "completed" || status === "failed" || status === "skipped" || status === "cancelled"

  return {
    phaseId: `phase-${phase}`,
    scanId: "scan-1",
    attemptId: "attempt-1",
    resultId: phase === "http_probe" || phase === "subfinder" || phase === "finalize" ? null : "result-1",
    phase,
    status,
    errorCode: status === "failed" ? "phase_failed" : null,
    errorMessage: status === "failed" ? `${phase} failed` : null,
    meta: {},
    queuedAt: submittedAt,
    startedAt: status === "queued" ? null : "2026-03-27T00:00:01.000Z",
    completedAt: isTerminal ? "2026-03-27T00:00:02.000Z" : null,
    updatedAt: isTerminal ? "2026-03-27T00:00:02.000Z" : "2026-03-27T00:00:01.000Z",
    ...overrides,
  }
}

describe("ScanProgressPipeline", () => {
  it("renders all canonical pipeline phases before their rows exist", () => {
    const { container } = render(
      <ScanProgressPipeline
        completedAt={null}
        phases={[]}
        scanStatus="queued"
        submittedAt={submittedAt}
      />,
    )

    expect(screen.getByRole("heading", { name: "Scan queued" })).toBeInTheDocument()
    expect(screen.getByText("0/8 finished · Pipeline initializing")).toBeInTheDocument()
    const stageGrid = screen.getByRole("list", { name: "Scan pipeline stages" })
    expect(stageGrid).toHaveClass("md:grid-cols-2", "xl:grid-cols-8")
    expect(container.querySelectorAll("[data-pipeline-stage]")).toHaveLength(4)
    expect(container.querySelectorAll("[data-phase]")).toHaveLength(8)

    expect(container.querySelector('[data-pipeline-stage="probe"]')).toHaveClass("xl:col-span-1")
    expect(container.querySelector('[data-pipeline-stage="collect"]')).toHaveClass("xl:col-span-3")
    expect(container.querySelector('[data-pipeline-stage="enrich"]')).toHaveClass("xl:col-span-3")
    expect(container.querySelector('[data-pipeline-stage="finish"]')).toHaveClass("xl:col-span-1")
    expect(container.querySelector('[data-pipeline-stage="collect"] ul')).toHaveClass("xl:grid-cols-3")
    expect(container.querySelector('[data-pipeline-stage="enrich"] ul')).toHaveClass("xl:grid-cols-3")

    const progress = screen.getByRole("progressbar", { name: "Scan pipeline progress" })
    expect(progress).toHaveAttribute("aria-valuemax", "8")
    expect(progress).toHaveAttribute("aria-valuenow", "0")
  })

  it("reports every concurrently running phase", () => {
    const { container } = render(
      <ScanProgressPipeline
        completedAt={null}
        phases={[
          buildPhase("http_probe", "completed"),
          buildPhase("headless", "running"),
          buildPhase("subfinder", "running"),
        ]}
        scanStatus="running"
        submittedAt={submittedAt}
      />,
    )

    expect(screen.getByText("1/8 finished · 2 active: Headless, Subfinder")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { current: "step" })).toHaveLength(2)

    expect(screen.queryByText("Scanning")).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="scan-pipeline-status-badge"]')).toBeNull()

    const loaders = container.querySelectorAll('[data-slot="square-loader"]')
    expect(loaders).toHaveLength(3)
    expect(loaders[0]).toHaveClass("size-8")
    expect(loaders[1]).toHaveClass("size-6")
    expect(loaders[2]).toHaveClass("size-6")
    expect(loaders[0]?.parentElement?.className).not.toContain("border")
  })

  it("does not claim zero phases completed for legacy scans without phase history", () => {
    render(
      <ScanProgressPipeline
        completedAt="2026-03-27T00:00:10.000Z"
        phases={[]}
        scanStatus="completed"
        submittedAt={submittedAt}
      />,
    )

    expect(screen.getByText("Phase history unavailable · 10s")).toBeInTheDocument()
    expect(screen.queryByText(/0 completed/)).not.toBeInTheDocument()
  })

  it("summarizes completed scans with skips and keeps mobile details collapsed", () => {
    const { container } = render(
      <ScanProgressPipeline
        completedAt="2026-03-27T00:00:10.000Z"
        phases={[
          buildPhase("http_probe", "completed"),
          buildPhase("headless", "completed"),
          buildPhase("browser_fallback", "skipped"),
          buildPhase("subfinder", "completed"),
          buildPhase("nuclei_dns", "completed"),
          buildPhase("nuclei_http", "completed"),
          buildPhase("ip_intel", "completed"),
          buildPhase("finalize", "completed"),
        ]}
        scanStatus="completed"
        submittedAt={submittedAt}
      />,
    )

    expect(screen.getByText("7 completed · 1 skipped · 10s")).toBeInTheDocument()
    expect(screen.queryByText("Complete")).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="scan-pipeline-status-badge"]')).toBeNull()

    const completionIndicators = document.querySelectorAll('[data-slot="complete-status-indicator"]')
    expect(completionIndicators).toHaveLength(8)
    expect(completionIndicators[0]).toHaveClass("size-8")
    expect(completionIndicators[0]?.querySelector("path")).toHaveAttribute(
      "d",
      "M5.25 12.3c1.65 1.35 2.8 2.55 4.25 4.05 2.85-3.75 5.7-6.55 9.25-9.15",
    )

    const disclosure = screen.getByRole("button", { name: "View all 8 phases" })
    expect(disclosure).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(disclosure)

    expect(screen.getByRole("button", { name: "Hide phase details" })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByLabelText("Browser recovery skipped")).toBeInTheDocument()
  })

  it("automatically exposes failed pipeline details", () => {
    render(
      <ScanProgressPipeline
        completedAt="2026-03-27T00:00:03.000Z"
        phases={[
          buildPhase("http_probe", "completed"),
          buildPhase("headless", "failed"),
        ]}
        scanStatus="failed"
        submittedAt={submittedAt}
      />,
    )

    expect(screen.getByText("Failed at Headless · 2/8 finished · 3s")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Hide phase details" })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByLabelText("Headless failed")).toBeInTheDocument()
  })

  it("shows persisted phase timing in the phase details popover", async () => {
    render(
      <ScanProgressPipeline
        completedAt={null}
        phases={[
          buildPhase("http_probe", "completed"),
          buildPhase("headless", "queued"),
        ]}
        scanStatus="running"
        submittedAt={submittedAt}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "HTTP probe completed" }))

    await waitFor(() => {
      expect(screen.getByText("Phase")).toBeInTheDocument()
      expect(screen.getByText("Started")).toBeInTheDocument()
      expect(screen.getByText("Finished")).toBeInTheDocument()
    })
  })

  it("renders browser recovery reason and outcome in the phase details popover", async () => {
    render(
      <ScanProgressPipeline
        completedAt="2026-03-27T00:00:10.000Z"
        phases={[
          buildPhase("browser_fallback", "completed", {
            meta: {
              outcome: "recovered",
              recovered: true,
              decision: {
                reason: "headless_screenshot_missing",
                confidence: "recovery",
                shouldRun: true,
                signals: ["headless_screenshot_missing"],
              },
              triggerOptions: {
                headlessFailed: false,
                headlessScreenshotMissing: true,
              },
            },
          }),
        ]}
        scanStatus="completed"
        submittedAt={submittedAt}
      />,
    )

    expect(screen.queryByText("Headless screenshot missing")).not.toBeInTheDocument()
    expect(screen.queryByText("Recovered")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Browser recovery completed" }))

    await waitFor(() => {
      expect(screen.getByText("Headless screenshot missing")).toBeInTheDocument()
      expect(screen.getByText("Recovered")).toBeInTheDocument()
    })
  })

  it("keeps every persisted phase state distinguishable without relying on color", () => {
    const { container } = render(
      <ScanProgressPipeline
        completedAt={null}
        phases={[
          buildPhase("http_probe", "completed"),
          buildPhase("headless", "running"),
          buildPhase("browser_fallback", "queued"),
          buildPhase("subfinder", "skipped"),
          buildPhase("nuclei_dns", "failed"),
          buildPhase("nuclei_http", "cancelled"),
        ]}
        scanStatus="running"
        submittedAt={submittedAt}
      />,
    )

    for (const status of ["completed", "running", "queued", "skipped", "failed", "cancelled", "pending"]) {
      expect(container.querySelector(`[data-status=${status}]`)).toBeTruthy()
    }
  })
})
