import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { SetupPageClient } from "@/components/setup/setup-page-client"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } satisfies Partial<Response>
}

describe("SetupPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
  })

  it("renders the initial setup state with the detected public URL", () => {
    render(
      <SetupPageClient
        publicUrl={null}
        detectedPublicUrl="https://demo.up.railway.app"
        hasUsers={false}
        hasTokens={false}
        hasScans={false}
        isSetupComplete={false}
      />,
    )

    expect(screen.getByText("Getting started")).toBeInTheDocument()
    expect(screen.getByDisplayValue("https://demo.up.railway.app")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /confirm url/i })).toBeInTheDocument()
  })

  it("transitions to the completed state after saving setup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, "http://localhost")

        if (url.pathname === "/api/v1/setup" && init?.method === "PUT") {
          return jsonResponse({
            publicUrl: "https://stackray.example.com",
            detectedPublicUrl: "https://demo.up.railway.app",
            hasUsers: true,
            hasTokens: true,
            isSetupComplete: true,
          })
        }

        throw new Error(`Unhandled fetch request: ${init?.method ?? "GET"} ${url.pathname}`)
      }),
    )

    render(
      <SetupPageClient
        publicUrl={null}
        detectedPublicUrl="https://demo.up.railway.app"
        hasUsers={false}
        hasTokens={false}
        hasScans={false}
        isSetupComplete={false}
      />,
    )

    fireEvent.change(screen.getByLabelText("Instance URL"), {
      target: { value: "https://stackray.example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: /confirm url/i }))

    await waitFor(() => {
      expect(screen.getByText("Setup complete")).toBeInTheDocument()
    })

    expect(screen.getByText("https://stackray.example.com")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /manage users/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /api tokens/i })).toBeInTheDocument()
  })
})
