import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Sidebar } from "@/components/shell/sidebar"

const { pathnameMock } = vi.hoisted(() => ({
  pathnameMock: vi.fn(() => "/dashboard"),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: pathnameMock,
}))

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signOut: vi.fn(),
  },
}))

describe("Sidebar", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/dashboard")
  })

  it("renders navigation links with accessible names", () => {
    render(<Sidebar />)

    expect(screen.getByLabelText("Stackray dashboard")).toBeTruthy()
    expect(screen.getByLabelText("Dashboard")).toBeTruthy()
    expect(screen.getByLabelText("Runs")).toBeTruthy()
    expect(screen.getByLabelText("Targets")).toBeTruthy()
    expect(screen.getByLabelText("Schedules")).toBeTruthy()
    expect(screen.getByLabelText("Settings")).toBeTruthy()
  })

  it("profile button has accessible name when user is provided", () => {
    render(
      <Sidebar
        user={{
          displayName: "John Doe",
          email: "john@example.com",
          image: null,
          role: "user",
        }}
      />
    )

    expect(screen.getByLabelText("John Doe profile")).toBeTruthy()
  })

  it("profile button has default accessible name when no user", () => {
    render(<Sidebar />)

    expect(screen.getByLabelText("Profile")).toBeTruthy()
  })

  it("shows Users nav item when canManageUsers is true", () => {
    render(<Sidebar canManageUsers={true} />)

    expect(screen.getByLabelText("Users")).toBeTruthy()
  })

  it("does not show Users nav item when canManageUsers is false", () => {
    render(<Sidebar canManageUsers={false} />)

    expect(screen.queryByLabelText("Users")).toBeNull()
  })

  it("does not show Settings nav item when canAccessTokens is false", () => {
    render(<Sidebar canAccessTokens={false} />)

    expect(screen.queryByLabelText("Settings")).toBeNull()
  })

  it("uses the shared amber accent on nav hover", () => {
    render(<Sidebar canManageUsers={true} />)

    expect(screen.getByLabelText("Runs").className).toContain("hover:text-[var(--accent)]")
    expect(screen.getByLabelText("Targets").className).toContain("hover:text-[var(--accent)]")
    expect(screen.getByLabelText("Settings").className).toContain("hover:text-[var(--accent)]")
    expect(screen.getByLabelText("Users").className).toContain("hover:text-[var(--accent)]")
  })

  it("uses the shared amber accent for active nav icons", () => {
    pathnameMock.mockReturnValue("/runs")

    render(<Sidebar canManageUsers={true} />)

    expect(screen.getByLabelText("Runs").className).toContain("text-[var(--accent)]")
    expect(screen.getByLabelText("Runs").className).toContain("bg-[var(--accent)]/10")
  })

  it("uses selected amber styling for settings and users pages", () => {
    pathnameMock.mockReturnValue("/settings/users")

    render(<Sidebar canManageUsers={true} />)

    expect(screen.getByLabelText("Users").className).toContain("text-[var(--accent)]")
    expect(screen.getByLabelText("Users").className).toContain("bg-[var(--accent)]/10")
    expect(screen.getByLabelText("Settings").className).toContain("hover:text-[var(--accent)]")
  })
})
