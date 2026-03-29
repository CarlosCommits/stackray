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

  it("submit button shows Scan text by default", () => {
    render(<SearchCommandBar />)

    expect(screen.getByText("Scan")).toBeTruthy()
  })

  it("shows queueing copy while a scan request is pending", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})))

    render(<SearchCommandBar />)

    fireEvent.change(screen.getByLabelText("Target domain or URL"), {
      target: { value: "example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Scan" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Queueing…" })).toBeTruthy()
    })

    expect(screen.getByLabelText("Target domain or URL").getAttribute("placeholder")).toBe(
      "Enter a domain or URL…"
    )
  })
})
