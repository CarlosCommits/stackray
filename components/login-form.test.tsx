import { render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { LoginForm } from "@/components/login-form"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock("@/lib/auth/client", () => ({
  signIn: {
    email: vi.fn(),
  },
}))

describe("LoginForm", () => {
  it("renders a direct dashboard link in demo mode", () => {
    render(<LoginForm demoMode />)

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard")
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull()
  })
})
