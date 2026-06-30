import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { AccountPageClient } from "./account-page-client"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")

  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverMock)
})

function renderAccountPage() {
  return render(
    <AccountPageClient
      user={{
        displayName: "Ada Lovelace",
        email: "ada@example.com",
      }}
    />,
  )
}

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } satisfies Partial<Response>
}

describe("AccountPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("validates password confirmation before submitting", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    renderAccountPage()

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "CurrentPassword123!" } })
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassword123!" } })
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "DifferentPassword123!" } })
    fireEvent.click(screen.getByRole("button", { name: "Update password" }))

    expect(screen.getByText("The new passwords do not match.")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("submits the password change and clears the form", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    renderAccountPage()

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "CurrentPassword123!" } })
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassword123!" } })
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "NewPassword123!" } })
    fireEvent.click(screen.getByRole("button", { name: "Update password" }))

    await waitFor(() => {
      expect(screen.getByText("Password updated.")).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/change-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "CurrentPassword123!",
          newPassword: "NewPassword123!",
          revokeOtherSessions: true,
        }),
      },
    )
    expect(screen.getByLabelText("Current password")).toHaveValue("")
    expect(screen.getByLabelText("New password")).toHaveValue("")
    expect(screen.getByLabelText("Confirm new password")).toHaveValue("")
  })

  it("can leave other sessions signed in when the switch is disabled", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    renderAccountPage()

    fireEvent.click(screen.getByRole("switch", { name: "Sign out other sessions" }))
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "CurrentPassword123!" } })
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassword123!" } })
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "NewPassword123!" } })
    fireEvent.click(screen.getByRole("button", { name: "Update password" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/change-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "CurrentPassword123!",
          newPassword: "NewPassword123!",
          revokeOtherSessions: false,
        }),
      },
    )
  })

  it("shows API errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      error: {
        message: "Current password is incorrect.",
      },
    }, false)))

    renderAccountPage()

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "WrongPassword123!" } })
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassword123!" } })
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "NewPassword123!" } })
    fireEvent.click(screen.getByRole("button", { name: "Update password" }))

    await waitFor(() => {
      expect(screen.getByText("Current password is incorrect.")).toBeInTheDocument()
    })
  })

  it("recovers from network failures without getting stuck submitting", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    }))

    renderAccountPage()

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "CurrentPassword123!" } })
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassword123!" } })
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "NewPassword123!" } })
    fireEvent.click(screen.getByRole("button", { name: "Update password" }))

    await waitFor(() => {
      expect(screen.getByText("Unable to reach the server. Check your connection and try again.")).toBeInTheDocument()
    })
    const submitButton = screen.getByRole("button", { name: "Update password" })
    expect(submitButton).not.toBeDisabled()
    expect(submitButton).toHaveTextContent("Update password")
  })
})
