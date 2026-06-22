import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { SearchCommandBar } from "@/components/dashboard/search-command-bar"
import { STACKRAY_RAILWAY_TEMPLATE_URL } from "@/components/scans/demo-scan-quota-dialog"

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}))

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerMocks.push,
    refresh: routerMocks.refresh,
  }),
}))

afterEach(() => {
  routerMocks.push.mockReset()
  routerMocks.refresh.mockReset()
  vi.unstubAllGlobals()
})

function mockViewportMatch(matches: boolean) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches,
    media: "(min-width: 768px)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })))
}

describe("SearchCommandBar", () => {
  it("renders with accessible label", () => {
    render(<SearchCommandBar />)

    expect(screen.getByRole("search")).toBeTruthy()
    expect(screen.getByLabelText("Target domain or URL")).toBeTruthy()
  })

  it("input has correct semantic attributes", () => {
    render(<SearchCommandBar />)

    const input = screen.getByLabelText("Target domain or URL")
    expect(input.getAttribute("name")).toBe("target")
    expect(input.getAttribute("type")).toBe("text")
    expect(input.getAttribute("autocomplete")).toBe("off")
  })

  it("shows default placeholder text", () => {
    render(<SearchCommandBar />)

    const input = screen.getByLabelText("Target domain or URL")
    expect(input.getAttribute("placeholder")).toBe("Enter a domain or URL…")
  })

  it("focuses the target input when rendered on desktop", () => {
    mockViewportMatch(true)

    render(<SearchCommandBar />)

    expect(document.activeElement).toBe(screen.getByLabelText("Target domain or URL"))
  })

  it("does not focus the target input when rendered on mobile", () => {
    mockViewportMatch(false)

    render(<SearchCommandBar />)

    expect(document.activeElement).not.toBe(screen.getByLabelText("Target domain or URL"))
  })

  it("submit button shows SCAN text by default", () => {
    render(<SearchCommandBar />)

    expect(screen.getByText("SCAN")).toBeTruthy()
  })

  it("shows queueing copy while a scan request is pending", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})))

    render(<SearchCommandBar />)

    fireEvent.change(screen.getByLabelText("Target domain or URL"), {
      target: { value: "example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: "SCAN" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Queueing…" })).toBeTruthy()
    })

    expect(screen.getByLabelText("Target domain or URL").getAttribute("placeholder")).toBe(
      "Enter a domain or URL…"
    )
  })

  it("announces a queued scan without navigating away", async () => {
    const onScanQueued = vi.fn()

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(
        JSON.stringify({
          scanId: "scan_queued",
          status: "queued",
          reused: false,
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      )),
    )

    render(<SearchCommandBar onScanQueued={onScanQueued} />)

    fireEvent.change(screen.getByLabelText("Target domain or URL"), {
      target: { value: "example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: "SCAN" }))

    await waitFor(() => {
      expect(onScanQueued).toHaveBeenCalledWith(expect.objectContaining({
        id: "scan_queued",
        target: "example.com",
        status: "analyzing",
        phase: "queued",
        phaseLabel: "Queued",
      }))
    })

    expect((screen.getByLabelText("Target domain or URL") as HTMLInputElement).value).toBe("")
  })

  it("queues from the target input when Enter is pressed", async () => {
    const onScanQueued = vi.fn()

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(
        JSON.stringify({
          scanId: "scan_enter",
          status: "queued",
          reused: false,
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      )),
    )

    render(<SearchCommandBar onScanQueued={onScanQueued} />)

    const input = screen.getByLabelText("Target domain or URL")
    fireEvent.change(input, {
      target: { value: "enter.example" },
    })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(onScanQueued).toHaveBeenCalledWith(expect.objectContaining({
        id: "scan_enter",
        target: "enter.example",
      }))
    })
  })

  it("announces an instant-completed scan with a zero tech count", async () => {
    const onScanQueued = vi.fn()

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(
        JSON.stringify({
          scanId: "scan_complete",
          status: "completed",
          reused: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )),
    )

    render(<SearchCommandBar onScanQueued={onScanQueued} />)

    fireEvent.change(screen.getByLabelText("Target domain or URL"), {
      target: { value: "complete.example" },
    })
    fireEvent.click(screen.getByRole("button", { name: "SCAN" }))

    await waitFor(() => {
      expect(onScanQueued).toHaveBeenCalledWith(expect.objectContaining({
        id: "scan_complete",
        target: "complete.example",
        status: "complete",
        phase: "complete",
        techCount: 0,
      }))
    })
  })

  it("shows the demo quota dialog instead of redirecting on a demo rate limit response", async () => {
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

    render(<SearchCommandBar />)

    fireEvent.change(screen.getByLabelText("Target domain or URL"), {
      target: { value: "quota.example" },
    })
    fireEvent.click(screen.getByRole("button", { name: "SCAN" }))

    expect(await screen.findByRole("heading", { name: "Scan limit reached" })).toBeTruthy()
    expect(screen.getByText(/Try again tomorrow/)).toBeTruthy()
    expect(screen.getByText("Scheduled scans")).toBeTruthy()
    expect(screen.getByText("API key access")).toBeTruthy()
    expect(screen.getByText("User invites for your team")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Launch on Railway" })).toHaveAttribute(
      "href",
      STACKRAY_RAILWAY_TEMPLATE_URL,
    )
  })

  it("shows matching past scans in demo mode before queueing a duplicate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url.startsWith("/api/v1/scans?")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  scanId: "scan_existing",
                  status: "completed",
                  source: "ui",
                  target: "example.com",
                  faviconUrl: "/api/v1/scans/scan_existing/results/result_existing/favicon",
                  submittedAt: "2026-06-22T12:00:00.000Z",
                  completedAt: "2026-06-22T12:00:10.000Z",
                },
                {
                  scanId: "scan_existing_old",
                  status: "completed",
                  source: "ui",
                  target: "example.com",
                  faviconUrl: "/api/v1/scans/scan_existing_old/results/result_existing_old/favicon",
                  submittedAt: "2026-06-21T12:00:00.000Z",
                  completedAt: "2026-06-21T12:00:10.000Z",
                },
              ],
              nextCursor: null,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        }

        throw new Error(`Unexpected request: ${url}`)
      }),
    )

    render(<SearchCommandBar demoMode />)

    fireEvent.change(screen.getByLabelText("Target domain or URL"), {
      target: { value: "example.com" },
    })

    expect(await screen.findByText("This website was already scanned")).toBeTruthy()
    expect(screen.getByText("Open an existing result, or run a fresh scan if you want updated data.")).toBeTruthy()
    expect(document.querySelector("img")?.getAttribute("src")).toBe(
      "/api/v1/scans/scan_existing/results/result_existing/favicon",
    )
    expect(screen.getAllByRole("button", { name: /example.com/i })).toHaveLength(1)
    expect(screen.queryByRole("button", { name: "Scan again" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Open latest result" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /example.com/i }))

    expect(routerMocks.push).toHaveBeenCalledWith("/scans/scan_existing")
  })
})
