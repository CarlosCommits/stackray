import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Sidebar } from "@/components/shell/sidebar"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/dashboard",
}))

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signOut: vi.fn(),
  },
}))

describe("Sidebar", () => {
  it("renders navigation links with accessible names", () => {
    render(<Sidebar />)

    expect(screen.getByLabelText("Stackray dashboard")).toBeTruthy()
    expect(screen.getByLabelText("Dashboard")).toBeTruthy()
    expect(screen.getByLabelText("Runs")).toBeTruthy()
    expect(screen.getByLabelText("Targets")).toBeTruthy()
    expect(screen.getByLabelText("Saved")).toBeTruthy()
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
})
