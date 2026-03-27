import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ScanAttemptIndicator } from "@/components/scans/scan-attempt-indicator"

describe("ScanAttemptIndicator", () => {
  it("renders nothing when there is only one baseline attempt", () => {
    const { container } = render(
      <ScanAttemptIndicator
        currentAttempt={{
          attemptId: "att_1",
          attemptNumber: 1,
          status: "completed",
          requestProfile: "baseline",
          fallbackReason: null,
          resultCount: 1,
          forbiddenResultCount: 0,
        }}
        attemptHistory={[
          {
            attemptId: "att_1",
            attemptNumber: 1,
            status: "completed",
            requestProfile: "baseline",
            fallbackReason: null,
            resultCount: 1,
            forbiddenResultCount: 0,
          },
        ]}
      />,
    )

    expect(container.firstChild).toBeNull()
  })

  it("renders strategy label when multiple attempts exist", () => {
    render(
      <ScanAttemptIndicator
        currentAttempt={{
          attemptId: "att_2",
          attemptNumber: 2,
          status: "completed",
          requestProfile: "browser_headers",
          fallbackReason: "Previous attempt returned 403",
          resultCount: 1,
          forbiddenResultCount: 0,
        }}
        attemptHistory={[
          {
            attemptId: "att_1",
            attemptNumber: 1,
            status: "completed",
            requestProfile: "baseline",
            fallbackReason: null,
            resultCount: 0,
            forbiddenResultCount: 1,
          },
          {
            attemptId: "att_2",
            attemptNumber: 2,
            status: "completed",
            requestProfile: "browser_headers",
            fallbackReason: "Previous attempt returned 403",
            resultCount: 1,
            forbiddenResultCount: 0,
          },
        ]}
      />,
    )

    expect(screen.getByText("Strategy:")).toBeTruthy()
  })

  it("displays user-friendly profile labels", () => {
    render(
      <ScanAttemptIndicator
        currentAttempt={{
          attemptId: "att_3",
          attemptNumber: 3,
          status: "completed",
          requestProfile: "tlsi_final_url",
          fallbackReason: "Previous attempt blocked",
          resultCount: 1,
          forbiddenResultCount: 0,
        }}
        attemptHistory={[
          {
            attemptId: "att_1",
            attemptNumber: 1,
            status: "completed",
            requestProfile: "baseline",
            fallbackReason: null,
            resultCount: 0,
            forbiddenResultCount: 1,
          },
          {
            attemptId: "att_2",
            attemptNumber: 2,
            status: "completed",
            requestProfile: "browser_headers",
            fallbackReason: "Blocked by WAF",
            resultCount: 0,
            forbiddenResultCount: 1,
          },
          {
            attemptId: "att_3",
            attemptNumber: 3,
            status: "completed",
            requestProfile: "tlsi_final_url",
            fallbackReason: "Previous attempt blocked",
            resultCount: 1,
            forbiddenResultCount: 0,
          },
        ]}
      />,
    )

    expect(screen.getByText("Baseline")).toBeTruthy()
    expect(screen.getByText("Browser headers")).toBeTruthy()
    expect(screen.getByText("TLS impersonation")).toBeTruthy()
  })

  it("renders when current attempt is non-baseline even with single history entry", () => {
    render(
      <ScanAttemptIndicator
        currentAttempt={{
          attemptId: "att_1",
          attemptNumber: 1,
          status: "running",
          requestProfile: "browser_headers",
          fallbackReason: null,
          resultCount: 0,
          forbiddenResultCount: 0,
        }}
        attemptHistory={[
          {
            attemptId: "att_1",
            attemptNumber: 1,
            status: "running",
            requestProfile: "browser_headers",
            fallbackReason: null,
            resultCount: 0,
            forbiddenResultCount: 0,
          },
        ]}
      />,
    )

    expect(screen.getByText("Strategy:")).toBeTruthy()
    expect(screen.getByText("Browser headers")).toBeTruthy()
  })
})
