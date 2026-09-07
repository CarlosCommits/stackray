import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { LoginForm } from "@/components/login-form"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signInEmail: vi.fn(),
}))

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
  }),
}))

vi.mock("@/lib/auth/client", () => ({
  signIn: {
    email: mocks.signInEmail,
  },
}))

describe("LoginForm", () => {
  beforeEach(() => {
    mocks.push.mockReset()
    mocks.refresh.mockReset()
    mocks.signInEmail.mockReset()
  })

  it("renders a direct dashboard link in demo mode", () => {
    render(<LoginForm demoMode />)

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard")
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull()
  })

  it("returns to a protected destination after sign-in", async () => {
    mocks.signInEmail.mockResolvedValue({ data: {}, error: null })
    render(
      <LoginForm returnTo="/targets/target-1/changes?comparison=comparison-1&item=item-1" />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))
    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "admin@example.com" },
    })
    const passwordInput = screen.getByLabelText("Password")
    fireEvent.change(passwordInput, {
      target: { value: "correct-horse-battery-staple" },
    })
    fireEvent.submit(passwordInput.closest("form")!)

    await waitFor(() => {
      expect(mocks.signInEmail).toHaveBeenCalledWith({
        email: "admin@example.com",
        password: "correct-horse-battery-staple",
        callbackURL: "/targets/target-1/changes?comparison=comparison-1&item=item-1",
      })
    })
    expect(mocks.push).toHaveBeenCalledWith(
      "/targets/target-1/changes?comparison=comparison-1&item=item-1",
    )
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })
})
