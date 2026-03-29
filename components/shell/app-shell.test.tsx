import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppShell } from "@/components/shell/app-shell"

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

describe("AppShell", () => {
  it("renders skip link for accessibility", () => {
    render(
      <AppShell>
        <div>Test content</div>
      </AppShell>
    )

    const skipLink = screen.getByText("Skip to main content")
    expect(skipLink).toBeTruthy()
    expect(skipLink.tagName.toLowerCase()).toBe("a")
    expect(skipLink.getAttribute("href")).toBe("#main-content")
  })

  it("main content area has id for skip link target", () => {
    render(
      <AppShell>
        <div data-testid="test-content">Test content</div>
      </AppShell>
    )

    const main = document.querySelector("main#main-content")
    expect(main).toBeTruthy()
    expect(main?.getAttribute("tabindex")).toBe("-1")
  })

  it("renders children content", () => {
    render(
      <AppShell>
        <div data-testid="test-content">Test content</div>
      </AppShell>
    )

    expect(screen.getByTestId("test-content")).toBeTruthy()
  })
})
