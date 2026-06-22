import { fireEvent, render, screen } from "@testing-library/react"
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
    expect(screen.getByLabelText("Tech Compare")).toBeTruthy()
    expect(screen.getByLabelText("Targets")).toBeTruthy()
    expect(screen.getByLabelText("Schedules")).toBeTruthy()
    expect(screen.getByLabelText("API Keys")).toBeTruthy()
  })

  it("places tech comparison under runs", () => {
    render(<Sidebar />)

    const runs = screen.getByLabelText("Runs")
    const techCompare = screen.getByLabelText("Tech Compare")

    expect(runs.compareDocumentPosition(techCompare) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("profile row has accessible name when user is provided", () => {
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

  it("renders the profile row as non-interactive content", () => {
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

    expect(screen.getByLabelText("John Doe profile").tagName).not.toBe("BUTTON")
  })

  it("profile row has default accessible name when no user", () => {
    render(<Sidebar />)

    expect(screen.getByLabelText("Profile")).toBeTruthy()
  })

  it("hides account controls when requested", () => {
    render(
      <Sidebar
        hideAccountControls
        user={{
          displayName: "Demo User",
          email: "demo@stackray.local",
          image: null,
          role: "user",
        }}
      />
    )

    expect(screen.queryByLabelText("Demo User profile")).toBeNull()
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull()
  })

  it("shows Users nav item when canManageUsers is true", () => {
    render(<Sidebar canManageUsers={true} />)

    expect(screen.getByLabelText("Users")).toBeTruthy()
  })

  it("does not show Users nav item when canManageUsers is false", () => {
    render(<Sidebar canManageUsers={false} />)

    expect(screen.queryByLabelText("Users")).toBeNull()
  })

  it("does not show API Keys nav item when canAccessApiKeys is false", () => {
    render(<Sidebar canAccessApiKeys={false} />)

    expect(screen.queryByLabelText("API Keys")).toBeNull()
  })

  it("only renders the mobile navigation dialog after opening it", () => {
    render(<Sidebar />)

    expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }))

    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeTruthy()
  })

  it("uses the shared amber accent on nav hover", () => {
    render(<Sidebar canManageUsers={true} />)

    expect(screen.getByLabelText("Runs").className).toContain("hover:text-[var(--accent)]")
    expect(screen.getByLabelText("Targets").className).toContain("hover:text-[var(--accent)]")
    expect(screen.getByLabelText("API Keys").className).toContain("hover:text-[var(--accent)]")
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
    expect(screen.getByLabelText("API Keys").className).toContain("hover:text-[var(--accent)]")
  })
})
