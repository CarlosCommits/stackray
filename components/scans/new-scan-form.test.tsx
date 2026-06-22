import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, afterEach, describe, expect, it, vi } from "vitest"

import { NewScanForm } from "@/components/scans/new-scan-form"
import { STACKRAY_RAILWAY_TEMPLATE_URL } from "@/components/scans/demo-scan-quota-dialog"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("NewScanForm", () => {
  it("shows the demo quota dialog when scan creation is rate limited", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(
        JSON.stringify({
          error: {
            code: "demo_scan_rate_limit_exceeded",
            message: "Demo visitors can create up to 10 scans per day.",
            details: {},
          },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      )),
    )

    render(<NewScanForm initialTarget="quota.example" />)

    fireEvent.click(screen.getByRole("button", { name: "Queue Scan" }))

    expect(await screen.findByRole("heading", { name: "Scan limit reached" })).toBeTruthy()
    expect(screen.getByText(/launch your own Stackray instance on Railway/)).toBeTruthy()
    expect(screen.getByText("Scheduled scans")).toBeTruthy()
    expect(screen.getByText("API key access")).toBeTruthy()
    expect(screen.getByText("User invites for your team")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Launch on Railway" })).toHaveAttribute(
      "href",
      STACKRAY_RAILWAY_TEMPLATE_URL,
    )
  })
})
