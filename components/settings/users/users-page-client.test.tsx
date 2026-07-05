import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { UsersPageClient } from "./users-page-client"
import type { AppUser } from "@/lib/contracts/users"
import { TooltipProvider } from "@/components/ui/tooltip"
import { STACKRAY_RAILWAY_TEMPLATE_URL } from "@/components/demo/demo-deployment-cta"
import { DEMO_MOCK_USERS, DEMO_MOCK_USER_ID } from "@/lib/demo-mode-data"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")

  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverMock)
})

const initialUsers: AppUser[] = [
  {
    userId: "11111111-1111-4111-8111-111111111111",
    email: "ada@example.com",
    displayName: "Ada Lovelace",
    role: "user",
    isActive: true,
    requiresPasswordChange: false,
    hasPassword: true,
    lastLoginAt: null,
    apiKeyAccessEnabled: true,
  },
]

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } satisfies Partial<Response>
}

function renderUsersPage(props: React.ComponentProps<typeof UsersPageClient>) {
  return render(
    <TooltipProvider>
      <UsersPageClient {...props} />
    </TooltipProvider>,
  )
}

describe("UsersPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    document.body.innerHTML = ""
  })

  it("shows a temporary password banner with copy feedback after creating a user", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, "http://localhost")
      const method = init?.method ?? "GET"

      if (url.pathname === "/api/v1/settings/users" && method === "POST") {
        return jsonResponse({
          user: initialUsers[0],
          temporaryPassword: "rqm4gjfdf7ew",
        })
      }

      if (url.pathname === "/api/v1/settings/users" && method === "GET") {
        return jsonResponse({
          items: [{
            ...initialUsers[0],
            requiresPasswordChange: true,
          }],
        })
      }

      throw new Error(`Unhandled fetch request: ${method} ${url.pathname}`)
    }))

    renderUsersPage({ initialUsers, canEmailUsers: false, currentUserId: "99999999-9999-4999-8999-999999999999" })

    fireEvent.click(screen.getByRole("button", { name: "Create user" }))
    const createDialog = screen.getByRole("dialog")

    fireEvent.change(within(createDialog).getByLabelText("Email"), {
      target: { value: "grace@example.com" },
    })
    fireEvent.change(within(createDialog).getByLabelText("Display name"), {
      target: { value: "Grace Hopper" },
    })
    fireEvent.click(within(createDialog).getByRole("switch", { name: "API key access" }))

    fireEvent.click(within(createDialog).getByRole("button", { name: "Create user" }))

    await waitFor(() => {
      expect(screen.getByText(/temporary password created/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /copy password/i }))

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("rqm4gjfdf7ew")
    })
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/settings/users",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "grace@example.com",
          displayName: "Grace Hopper",
          role: "user",
          apiKeyAccessEnabled: false,
          deliveryMode: "temp-password",
        }),
      },
    )
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument()
  })

  it("lets an admin edit a user's email and display name", async () => {
    const updatedUser = {
      ...initialUsers[0],
      email: "ada.byron@example.com",
      displayName: "Ada Byron",
      apiKeyAccessEnabled: false,
    }
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, "http://localhost")
      const method = init?.method ?? "GET"

      if (url.pathname === "/api/v1/settings/users/11111111-1111-4111-8111-111111111111" && method === "PATCH") {
        return jsonResponse(updatedUser)
      }

      throw new Error(`Unhandled fetch request: ${method} ${url.pathname}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    renderUsersPage({ initialUsers, canEmailUsers: false, currentUserId: "99999999-9999-4999-8999-999999999999" })

    expect(screen.queryByRole("switch", { name: "API key access for Ada Lovelace" })).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole("button", { name: "Edit Ada Lovelace" })[0]!)
    const editDialog = screen.getByRole("dialog")

    fireEvent.change(within(editDialog).getByLabelText("Email"), {
      target: { value: "ada.byron@example.com" },
    })
    fireEvent.change(within(editDialog).getByLabelText("Display name"), {
      target: { value: "Ada Byron" },
    })
    fireEvent.click(within(editDialog).getByRole("switch", { name: "API key access" }))
    fireEvent.click(within(editDialog).getByRole("button", { name: "Save changes" }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    expect(screen.getAllByText("Ada Byron")[0]!).toBeInTheDocument()
    expect(screen.getAllByText("ada.byron@example.com")[0]!).toBeInTheDocument()
    expect(screen.getAllByText("Disabled")[0]!).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/settings/users/11111111-1111-4111-8111-111111111111",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ada.byron@example.com",
          displayName: "Ada Byron",
          apiKeyAccessEnabled: false,
        }),
      },
    )
  })

  it("keeps admin API key access always enabled in the edit dialog", () => {
    const adminUsers = [{
      ...initialUsers[0],
      role: "admin" as const,
      apiKeyAccessEnabled: false,
    }]

    renderUsersPage({ initialUsers: adminUsers, canEmailUsers: false, currentUserId: "99999999-9999-4999-8999-999999999999" })

    expect(screen.getAllByText("Always enabled")[0]!).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole("button", { name: "Edit Ada Lovelace" })[0]!)

    const editDialog = screen.getByRole("dialog")
    expect(within(editDialog).getByRole("switch", { name: "API key access" })).toBeDisabled()
    expect(within(editDialog).getByText("Always enabled for admins")).toBeInTheDocument()
  })

  it("shows mock users and Railway CTA in demo mode", async () => {
    renderUsersPage({
      initialUsers: DEMO_MOCK_USERS,
      canEmailUsers: false,
      currentUserId: DEMO_MOCK_USER_ID,
      demoMode: true,
    })

    expect(screen.getAllByText("Demo Admin")[0]!).toBeInTheDocument()
    expect(screen.getAllByText("Security Analyst")[0]!).toBeInTheDocument()
    expect(screen.getAllByRole("combobox", { name: /role for security analyst/i })[0]!).toBeDisabled()
    expect(screen.getAllByRole("button", { name: "Delete Security Analyst" })[0]!).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Create user" }))

    expect(screen.getByRole("heading", { name: "User management needs your own deployment" })).toBeInTheDocument()
    expect(screen.getByText(/invite teammates, manage roles, and control API key access/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Launch on Railway" })).toHaveAttribute(
      "href",
      STACKRAY_RAILWAY_TEMPLATE_URL,
    )

    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]!)

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "User management needs your own deployment" })).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole("button", { name: "Edit Security Analyst" })[0]!)
    const editDialog = screen.getByRole("dialog")

    expect(within(editDialog).getByText(/User changes are disabled on this shared instance/)).toBeInTheDocument()
    expect(within(editDialog).getByRole("button", { name: "Save changes" })).toBeDisabled()
  })

  it("persists API key access when promoting a user to admin from the role selector", async () => {
    const disabledUser = {
      ...initialUsers[0],
      apiKeyAccessEnabled: false,
    }
    const updatedUser = {
      ...disabledUser,
      role: "admin" as const,
      apiKeyAccessEnabled: true,
    }
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, "http://localhost")
      const method = init?.method ?? "GET"

      if (url.pathname === "/api/v1/settings/users/11111111-1111-4111-8111-111111111111" && method === "PATCH") {
        return jsonResponse(updatedUser)
      }

      throw new Error(`Unhandled fetch request: ${method} ${url.pathname}`)
    })

    vi.stubGlobal("fetch", fetchMock)
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    })

    renderUsersPage({
      initialUsers: [disabledUser],
      canEmailUsers: false,
      currentUserId: "99999999-9999-4999-8999-999999999999",
    })

    fireEvent.click(screen.getAllByRole("combobox", { name: /role for ada lovelace/i })[0]!)
    fireEvent.click(await screen.findByRole("option", { name: "admin" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/settings/users/11111111-1111-4111-8111-111111111111",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "admin",
            apiKeyAccessEnabled: true,
          }),
        },
      )
    })
  })

  it("keeps temporary password creation inside the edit dialog", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, "http://localhost")
      const method = init?.method ?? "GET"

      if (url.pathname === "/api/v1/settings/users/11111111-1111-4111-8111-111111111111/password" && method === "POST") {
        return jsonResponse({
          temporaryPassword: "reset-temp-password",
        })
      }

      if (url.pathname === "/api/v1/settings/users" && method === "GET") {
        return jsonResponse({
          items: [{
            ...initialUsers[0],
            requiresPasswordChange: true,
          }],
        })
      }

      throw new Error(`Unhandled fetch request: ${method} ${url.pathname}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    renderUsersPage({ initialUsers, canEmailUsers: false, currentUserId: "99999999-9999-4999-8999-999999999999" })

    expect(screen.queryByRole("button", { name: /temp password/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole("button", { name: "Edit Ada Lovelace" })[0]!)
    const editDialog = screen.getByRole("dialog")

    fireEvent.click(within(editDialog).getByRole("button", { name: "Create temporary password" }))

    await waitFor(() => {
      expect(within(editDialog).getByText(/temporary password created/i)).toBeInTheDocument()
    })
    expect(within(editDialog).getByText(/They will have to change it the next time they sign in/i)).toBeInTheDocument()
    expect(within(editDialog).getByText("reset-temp-password")).toBeInTheDocument()
    await waitFor(() => {
      expect(document.body.querySelector('[aria-label="Password change required"]')).toBeTruthy()
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/settings/users/11111111-1111-4111-8111-111111111111/password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryMode: "temp-password" }),
      },
    )
  })

  it("does not allow resetting the current user's password from the users list", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    renderUsersPage({ initialUsers, canEmailUsers: true, currentUserId: "11111111-1111-4111-8111-111111111111" })

    fireEvent.click(screen.getAllByRole("button", { name: "Edit Ada Lovelace" })[0]!)
    const editDialog = screen.getByRole("dialog")

    expect(within(editDialog).getByText("Use Account settings to change your own password.")).toBeInTheDocument()
    expect(within(editDialog).queryByRole("button", { name: "Email reset link" })).not.toBeInTheDocument()
    expect(within(editDialog).queryByRole("button", { name: "Create temporary password" })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("sends an email reset link when email delivery is available", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, "http://localhost")
      const method = init?.method ?? "GET"

      if (url.pathname === "/api/v1/settings/users/11111111-1111-4111-8111-111111111111/password" && method === "POST") {
        return jsonResponse({
          temporaryPassword: null,
          deliveredByEmail: true,
        })
      }

      if (url.pathname === "/api/v1/settings/users" && method === "GET") {
        return jsonResponse({
          items: initialUsers,
        })
      }

      throw new Error(`Unhandled fetch request: ${method} ${url.pathname}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    renderUsersPage({ initialUsers, canEmailUsers: true, currentUserId: "99999999-9999-4999-8999-999999999999" })

    fireEvent.click(screen.getAllByRole("button", { name: "Edit Ada Lovelace" })[0]!)
    const editDialog = screen.getByRole("dialog")

    fireEvent.click(within(editDialog).getByRole("button", { name: "Email reset link" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/settings/users/11111111-1111-4111-8111-111111111111/password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliveryMode: "email" }),
        },
      )
    })
    expect(within(editDialog).queryByText(/temporary password created/i)).not.toBeInTheDocument()
  })

  it("requires confirmation before deleting a user", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, "http://localhost")
      const method = init?.method ?? "GET"

      if (url.pathname === "/api/v1/settings/users/11111111-1111-4111-8111-111111111111" && method === "DELETE") {
        return jsonResponse({ ok: true })
      }

      throw new Error(`Unhandled fetch request: ${method} ${url.pathname}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    renderUsersPage({ initialUsers, canEmailUsers: false, currentUserId: "99999999-9999-4999-8999-999999999999" })

    fireEvent.click(screen.getByRole("button", { name: "Delete" }))

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }))

    await waitFor(() => {
      expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/settings/users/11111111-1111-4111-8111-111111111111",
      { method: "DELETE" }
    )
  })

  it("disables role changes and deletion for the current admin", () => {
    renderUsersPage({ initialUsers, canEmailUsers: false, currentUserId: "11111111-1111-4111-8111-111111111111" })

    expect(screen.getAllByRole("combobox", { name: /role for ada lovelace/i })[0]!).toBeDisabled()
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled()
  })
})
