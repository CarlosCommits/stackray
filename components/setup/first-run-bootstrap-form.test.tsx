import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { FirstRunBootstrapForm } from "@/components/setup/first-run-bootstrap-form"

const { push, refresh, signInEmail } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signInEmail: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    refresh,
  }),
}))

vi.mock("@/lib/auth/client", () => ({
  signIn: {
    email: signInEmail,
  },
}))

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } satisfies Partial<Response>
}

describe("FirstRunBootstrapForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
  })

  it("validates password confirmation before submitting", async () => {
    render(<FirstRunBootstrapForm />)

    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Admin User" } })
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "StrongPassword123!" } })
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "DifferentPassword123!" } })
    fireEvent.click(screen.getByRole("button", { name: /create admin account/i }))

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument()
    expect(signInEmail).not.toHaveBeenCalled()
  })

  it("creates the first admin account and signs in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, "http://localhost")

        if (url.pathname === "/api/v1/setup/bootstrap" && init?.method === "POST") {
          return jsonResponse({
            email: "admin@example.com",
            displayName: "Admin User",
            bootstrapOpen: false,
          }, true)
        }

        throw new Error(`Unhandled fetch request: ${init?.method ?? "GET"} ${url.pathname}`)
      }),
    )

    signInEmail.mockResolvedValue({ error: null })

    render(<FirstRunBootstrapForm />)

    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Admin User" } })
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "StrongPassword123!" } })
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "StrongPassword123!" } })
    fireEvent.click(screen.getByRole("button", { name: /create admin account/i }))

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith({
        email: "admin@example.com",
        password: "StrongPassword123!",
        callbackURL: "/dashboard",
      })
    })

    expect(push).toHaveBeenCalledWith("/dashboard")
    expect(refresh).toHaveBeenCalled()
  })

  it("redirects to the dashboard onboarding path without creating an account in development preview mode", () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    render(<FirstRunBootstrapForm developmentPreview />)

    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Admin User" } })
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "StrongPassword123!" } })
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "StrongPassword123!" } })
    fireEvent.click(screen.getByRole("button", { name: /create admin account/i }))

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(signInEmail).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith("/dashboard?stackraySetupComplete=1")
    expect(refresh).toHaveBeenCalled()
  })
})
