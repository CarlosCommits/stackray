import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Header } from "@/components/shell/header"
import { APP_VERSION } from "@/lib/version"

let pathname = "/dashboard"

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}))

describe("Header", () => {
  beforeEach(() => {
    window.localStorage.clear()
    pathname = "/dashboard"
  })

  it("renders page title based on pathname", () => {
    render(<Header />)

    expect(screen.getByText("Dashboard")).toBeTruthy()
  })

  it("does not render a status indicator", () => {
    const { container } = render(<Header />)

    expect(container.querySelector(".motion-safe\\:animate-pulse")).toBeNull()
  })

  it("renders API Docs for the docs route", () => {
    pathname = "/settings/api-docs"

    render(<Header />)

    expect(screen.getByText("API Docs")).toBeTruthy()

    pathname = "/dashboard"
  })

  it("renders Schedules for the schedules route", () => {
    pathname = "/schedules"

    render(<Header />)

    expect(screen.getByText("Schedules")).toBeTruthy()

    pathname = "/dashboard"
  })

  it("renders version number from APP_VERSION", () => {
    render(<Header />)

    expect(screen.getByText(`v${APP_VERSION}`)).toBeTruthy()
  })

  it("renders a Stackray update banner and persistent header indicator", () => {
    render(
      <Header
        stackrayUpdateStatus={{
          updateAvailable: true,
          fingerprint: "stackray:0.1.0>0.1.1",
          checkedAt: "2026-05-08T00:00:00.000Z",
          currentVersion: "0.1.0",
          latestVersion: "0.1.1",
          latestUrl: "https://github.com/CarlosCommits/stackray/releases/tag/v0.1.1",
          latestRelease: {
            version: "0.1.1",
            title: "Scanner updates",
            body: "Updated scanner pins.",
            url: "https://github.com/CarlosCommits/stackray/releases/tag/v0.1.1",
            publishedAt: "2026-05-08T00:00:00.000Z",
          },
        }}
      />,
    )

    expect(screen.getByText(/Stackray update available/)).toBeTruthy()
    expect(screen.getByLabelText("View Stackray update details")).toBeTruthy()
  })

  it("dismisses the Stackray update banner but keeps the header indicator", () => {
    render(
      <Header
        stackrayUpdateStatus={{
          updateAvailable: true,
          fingerprint: "stackray:0.1.0>0.1.1",
          checkedAt: "2026-05-08T00:00:00.000Z",
          currentVersion: "0.1.0",
          latestVersion: "0.1.1",
          latestUrl: "https://github.com/CarlosCommits/stackray/releases/tag/v0.1.1",
          latestRelease: null,
        }}
      />,
    )

    fireEvent.click(screen.getByLabelText("Dismiss Stackray update banner"))

    expect(screen.queryByText(/Deploy the latest release/)).toBeNull()
    expect(screen.getByLabelText("View Stackray update details")).toBeTruthy()
    expect(window.localStorage.getItem("stackray:update-dismissed:stackray:0.1.0>0.1.1")).toBe("true")
  })

  it("opens update details with GitHub release notes", () => {
    render(
      <Header
        stackrayUpdateStatus={{
          updateAvailable: true,
          fingerprint: "stackray:0.1.0>0.1.1",
          checkedAt: "2026-05-08T00:00:00.000Z",
          currentVersion: "0.1.0",
          latestVersion: "0.1.1",
          latestUrl: "https://github.com/CarlosCommits/stackray/releases/tag/v0.1.1",
          latestRelease: {
            version: "0.1.1",
            title: "Scanner updates",
            body: "Updated scanner pins.",
            url: "https://github.com/CarlosCommits/stackray/releases/tag/v0.1.1",
            publishedAt: "2026-05-08T00:00:00.000Z",
          },
        }}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "View details" }))

    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(screen.getByText("Scanner updates")).toBeTruthy()
    expect(screen.getByText("Updated scanner pins.")).toBeTruthy()
  })
})
