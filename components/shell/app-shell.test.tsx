import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AppShell } from "@/components/shell/app-shell"

const { releaseNoticeShellSpy, gettingStartedShellSpy } = vi.hoisted(() => ({
  releaseNoticeShellSpy: vi.fn(),
  gettingStartedShellSpy: vi.fn(),
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
  ReleaseNoticeShell: ({
    lastSeenReleaseVersion,
    currentRelease,
  }: {
    lastSeenReleaseVersion: string | null
    currentRelease: unknown
  }) => {
    releaseNoticeShellSpy(lastSeenReleaseVersion, currentRelease)

    return <div data-testid="release-notice-shell">{lastSeenReleaseVersion ?? "null"}</div>
  },
}))

vi.mock("@/components/shell/getting-started-shell", () => ({
  GettingStartedShell: () => {
    gettingStartedShellSpy()

    return <div data-testid="getting-started-shell">Getting started</div>
  },
}))

describe("AppShell", () => {
  beforeEach(() => {
    releaseNoticeShellSpy.mockClear()
    gettingStartedShellSpy.mockClear()
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

  it("renders the release notice shell for admin users", () => {
    render(
      <AppShell
        user={{
          displayName: "Ada Lovelace",
          email: "ada@example.com",
          image: null,
          role: "admin",
        }}
        canManageUsers
        lastSeenReleaseVersion="0.9.0"
      >
        <div>Test content</div>
      </AppShell>
    )

    expect(screen.getByTestId("release-notice-shell").textContent).toBe("0.9.0")
    expect(releaseNoticeShellSpy).toHaveBeenCalledWith("0.9.0", null)
  })

  it("normalizes an omitted release version to null for admin users", () => {
    render(
      <AppShell
        user={{
          displayName: "Ada Lovelace",
          email: "ada@example.com",
          image: null,
          role: "admin",
        }}
        canManageUsers
      >
        <div>Test content</div>
      </AppShell>
    )

    expect(screen.getByTestId("release-notice-shell").textContent).toBe("null")
    expect(releaseNoticeShellSpy).toHaveBeenCalledWith(null, null)
  })

  it("does not render the release notice shell for non-admin users", () => {
    render(
      <AppShell
        user={{
          displayName: "Grace Hopper",
          email: "grace@example.com",
          image: null,
          role: "user",
        }}
      >
        <div>Test content</div>
      </AppShell>
    )

    expect(screen.queryByTestId("release-notice-shell")).toBeNull()
    expect(releaseNoticeShellSpy).not.toHaveBeenCalled()
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

  it("renders the getting-started shell for admin users who have not dismissed it", () => {
    render(
      <AppShell
        user={{
          displayName: "Ada Lovelace",
          email: "ada@example.com",
          image: null,
          role: "admin",
        }}
        canManageUsers
        showGettingStarted
        gettingStartedDismissedAt={null}
      >
        <div>Test content</div>
      </AppShell>
    )

    expect(screen.getByTestId("getting-started-shell")).toBeTruthy()
    expect(gettingStartedShellSpy).toHaveBeenCalled()
  })

  it("does not render the getting-started shell when dismissed", () => {
    render(
      <AppShell
        user={{
          displayName: "Ada Lovelace",
          email: "ada@example.com",
          image: null,
          role: "admin",
        }}
        canManageUsers
        showGettingStarted
        gettingStartedDismissedAt="2025-04-10T00:00:00.000Z"
      >
        <div>Test content</div>
      </AppShell>
    )

    expect(screen.queryByTestId("getting-started-shell")).toBeNull()
    expect(gettingStartedShellSpy).not.toHaveBeenCalled()
  })

  it("does not render the getting-started shell for non-admin users", () => {
    render(
      <AppShell
        user={{
          displayName: "Regular User",
          email: "user@example.com",
          image: null,
          role: "user",
        }}
        canManageUsers={false}
        gettingStartedDismissedAt={null}
      >
        <div>Test content</div>
      </AppShell>
    )

    expect(screen.queryByTestId("getting-started-shell")).toBeNull()
    expect(gettingStartedShellSpy).not.toHaveBeenCalled()
  })

  it("does not render the getting-started shell outside the initial onboarding phase", () => {
    render(
      <AppShell
        user={{
          displayName: "Ada Lovelace",
          email: "ada@example.com",
          image: null,
          role: "admin",
        }}
        canManageUsers
        showGettingStarted={false}
        gettingStartedDismissedAt={null}
      >
        <div>Test content</div>
      </AppShell>
    )

    expect(screen.queryByTestId("getting-started-shell")).toBeNull()
    expect(gettingStartedShellSpy).not.toHaveBeenCalled()
  })
})
