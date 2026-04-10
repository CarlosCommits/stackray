import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AppShell } from "@/components/shell/app-shell"

const { releaseNoticeShellSpy } = vi.hoisted(() => ({
  releaseNoticeShellSpy: vi.fn(),
}))

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

vi.mock("@/components/shell/release-notice-shell", () => ({
  ReleaseNoticeShell: ({ lastSeenReleaseVersion }: { lastSeenReleaseVersion: string | null }) => {
    releaseNoticeShellSpy(lastSeenReleaseVersion)

    return <div data-testid="release-notice-shell">{lastSeenReleaseVersion ?? "null"}</div>
  },
}))

describe("AppShell", () => {
  beforeEach(() => {
    releaseNoticeShellSpy.mockClear()
  })

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

  it("renders the release notice shell for signed-in users", () => {
    render(
      <AppShell
        user={{
          displayName: "Ada Lovelace",
          email: "ada@example.com",
          image: null,
          role: "admin",
        }}
        lastSeenReleaseVersion="0.9.0"
      >
        <div>Test content</div>
      </AppShell>
    )

    expect(screen.getByTestId("release-notice-shell").textContent).toBe("0.9.0")
    expect(releaseNoticeShellSpy).toHaveBeenCalledWith("0.9.0")
  })

  it("normalizes an omitted release version to null for signed-in users", () => {
    render(
      <AppShell
        user={{
          displayName: "Ada Lovelace",
          email: "ada@example.com",
          image: null,
          role: "admin",
        }}
      >
        <div>Test content</div>
      </AppShell>
    )

    expect(screen.getByTestId("release-notice-shell").textContent).toBe("null")
    expect(releaseNoticeShellSpy).toHaveBeenCalledWith(null)
  })

  it("does not render the release notice shell without a signed-in user", () => {
    render(
      <AppShell>
        <div>Test content</div>
      </AppShell>
    )

    expect(screen.queryByTestId("release-notice-shell")).toBeNull()
    expect(releaseNoticeShellSpy).not.toHaveBeenCalled()
  })
})
