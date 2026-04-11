import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { GettingStartedDialog } from "@/components/shell/getting-started-dialog"

const { push } = vi.hoisted(() => ({
  push: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}))

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

describe("GettingStartedDialog", () => {
  const onDismiss = vi.fn(async () => {})

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
  })

  it("renders the dialog with getting-started cards", () => {
    render(<GettingStartedDialog onDismiss={onDismiss} />)

    expect(screen.getByText("Getting started")).toBeInTheDocument()
    expect(screen.getByText("Invite teammates")).toBeInTheDocument()
    expect(screen.getByText("Create API token")).toBeInTheDocument()
    expect(screen.getByText("Run first scan")).toBeInTheDocument()
  })

  it("calls onDismiss when Skip is clicked", async () => {
    render(<GettingStartedDialog onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole("button", { name: /skip/i }))

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  it("calls onDismiss when Got it is clicked", async () => {
    render(<GettingStartedDialog onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole("button", { name: /got it/i }))

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  it("calls onDismiss when the dialog close button is clicked", async () => {
    render(<GettingStartedDialog onDismiss={onDismiss} />)

    const closeButton = screen.getByRole("button", { name: /close/i })
    fireEvent.click(closeButton)

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  it("calls onDismiss and navigates when a card link is clicked", async () => {
    render(<GettingStartedDialog onDismiss={onDismiss} />)

    const inviteLink = screen.getByRole("link", { name: /invite teammates/i })
    fireEvent.click(inviteLink)

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledTimes(1)
      expect(push).toHaveBeenCalledWith("/settings/users")
    })
  })
})
