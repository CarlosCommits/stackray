import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { GettingStartedDialog } from "@/components/shell/getting-started-dialog"

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
    expect(screen.getByText("Create API key")).toBeInTheDocument()
    expect(screen.getByText("Run first scan")).toBeInTheDocument()
    expect(screen.getByText("Schedule coverage")).toBeInTheDocument()
  })

  it("closes without dismissing when Close is clicked", async () => {
    render(<GettingStartedDialog onDismiss={onDismiss} />)

    fireEvent.click(screen.getAllByRole("button", { name: /^close$/i })[0])

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /getting started/i })).toBeNull()
    })

    expect(onDismiss).not.toHaveBeenCalled()
  })

  it("calls onDismiss when Do not show again is clicked", async () => {
    render(<GettingStartedDialog onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole("button", { name: /do not show again/i }))

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  it("closes without dismissing when the icon close button is clicked", async () => {
    render(<GettingStartedDialog onDismiss={onDismiss} />)

    const closeButton = screen.getAllByRole("button", { name: /^close$/i })[1]
    fireEvent.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /getting started/i })).toBeNull()
    })

    expect(onDismiss).not.toHaveBeenCalled()
  })

  it("does not render onboarding items as links", () => {
    render(<GettingStartedDialog onDismiss={onDismiss} />)

    expect(screen.queryByRole("link", { name: /invite teammates/i })).toBeNull()
  })
})
