import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { CustomDomainPageClient } from "@/components/setup/custom-domain-page-client"
import type { CustomDomainState } from "@/lib/contracts/setup"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } satisfies Partial<Response>
}

const initialState: CustomDomainState = {
  hostname: "stackray.example.com",
  canonicalBaseUrl: "https://demo.up.railway.app",
  expectedRailwayDomain: "demo.up.railway.app",
  dnsVerified: false,
  appVerified: false,
  cnameTargets: [],
  resolvedAddresses: [],
  dnsVerifiedAt: null,
  appVerifiedAt: null,
  lastCheckedAt: null,
}

describe("CustomDomainPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
  })

  it("saves the custom hostname", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, "http://localhost")

        if (url.pathname === "/api/v1/setup/custom-domain" && init?.method === "PUT") {
          return jsonResponse(initialState)
        }

        throw new Error(`Unhandled fetch request: ${init?.method ?? "GET"} ${url.pathname}`)
      }),
    )

    render(<CustomDomainPageClient initialState={initialState} />)

    fireEvent.change(screen.getByLabelText("Hostname"), {
      target: { value: "stackray.example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: /save hostname/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/setup/custom-domain",
        expect.objectContaining({ method: "PUT" }),
      )
    })
  })

  it("shows verification results after a successful verification", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, "http://localhost")

        if (url.pathname === "/api/v1/setup/custom-domain/verify" && init?.method === "POST") {
          return jsonResponse({
            ...initialState,
            dnsVerified: true,
            appVerified: true,
            cnameTargets: ["demo.up.railway.app"],
            lastCheckedAt: "2026-04-09T04:00:00.000Z",
          })
        }

        throw new Error(`Unhandled fetch request: ${init?.method ?? "GET"} ${url.pathname}`)
      }),
    )

    render(<CustomDomainPageClient initialState={initialState} />)

    fireEvent.click(screen.getByRole("button", { name: /verify/i }))

    await waitFor(() => {
      expect(screen.getByText(/custom domain is verified and working/i)).toBeInTheDocument()
    })
  })
})
