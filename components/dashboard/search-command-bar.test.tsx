import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SearchCommandBar } from "@/components/dashboard/search-command-bar"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

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

  it("focuses the target input when rendered", () => {
    render(<SearchCommandBar />)

    expect(document.activeElement).toBe(screen.getByLabelText("Target domain or URL"))
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
})
