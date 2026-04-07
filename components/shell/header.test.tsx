import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Header } from "@/components/shell/header"

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

  it("renders version number", () => {
    render(<Header />)

    expect(screen.getByText("v0.1.0-alpha")).toBeTruthy()
  })
})
