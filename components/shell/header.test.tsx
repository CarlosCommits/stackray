import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Header } from "@/components/shell/header"

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}))

describe("Header", () => {
  it("renders page title based on pathname", () => {
    render(<Header />)

    expect(screen.getByText("Dashboard")).toBeTruthy()
  })

  it("renders status indicator when showStatus is true", () => {
    const { container } = render(<Header showStatus={true} />)

    expect(screen.getByText("system_active")).toBeTruthy()
    expect(container.querySelector(".motion-safe\\:animate-pulse")).toBeTruthy()
  })

  it("does not render status indicator when showStatus is false", () => {
    render(<Header showStatus={false} />)

    expect(screen.queryByText("system_active")).toBeNull()
  })

  it("renders version number", () => {
    render(<Header />)

    expect(screen.getByText("v0.1.0-alpha")).toBeTruthy()
  })
})
