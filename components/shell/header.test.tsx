import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Header } from "@/components/shell/header"
import { APP_VERSION } from "@/lib/version"

let pathname = "/dashboard"

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}))

describe("Header", () => {
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
})
