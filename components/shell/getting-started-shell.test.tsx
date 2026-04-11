import { act, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { GettingStartedShell } from "@/components/shell/getting-started-shell"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

describe("GettingStartedShell", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
  })

  it("renders the getting-started dialog", () => {
    render(<GettingStartedShell />)

    expect(screen.getByText("Getting started")).toBeInTheDocument()
  })

  it("sends a PATCH to /api/v1/me/product-state with gettingStartedDismissedAt on dismiss", async () => {
    const fetchSpy = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url, "http://localhost")

      if (url.pathname === "/api/v1/me/product-state" && init?.method === "PATCH") {
        const body = JSON.parse(init?.body as string)
        expect(body.gettingStartedDismissedAt).toBeTruthy()
        expect(typeof body.gettingStartedDismissedAt).toBe("string")

        return { ok: true, json: async () => ({}) }
      }

      throw new Error(`Unhandled fetch: ${init?.method ?? "GET"} ${url.pathname}`)
    })

    vi.stubGlobal("fetch", fetchSpy)

    render(<GettingStartedShell />)

    const skipButton = screen.getByRole("button", { name: /skip/i })
    await act(async () => {
      skipButton.click()
    })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    const call = fetchSpy.mock.calls[0]
    const body = JSON.parse(call[1]?.body as string)
    expect(body).toHaveProperty("gettingStartedDismissedAt")
    expect(typeof body.gettingStartedDismissedAt).toBe("string")
  })

  it("logs an error when the dismiss PATCH fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    vi.stubGlobal("fetch", async () => ({ ok: false }))

    render(<GettingStartedShell />)

    const skipButton = screen.getByRole("button", { name: /skip/i })
    await act(async () => {
      skipButton.click()
    })

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith("Unable to persist getting-started dismissal.")
    })

    consoleErrorSpy.mockRestore()
  })
})
