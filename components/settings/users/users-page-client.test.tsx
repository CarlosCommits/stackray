import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { UsersPageClient } from "./users-page-client"
import type { AppUser } from "@/lib/contracts/users"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
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
    apiTokenAccessEnabled: true,
  },
]

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } satisfies Partial<Response>
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
          items: initialUsers,
        })
      }

      throw new Error(`Unhandled fetch request: ${method} ${url.pathname}`)
    }))

    render(<UsersPageClient initialUsers={initialUsers} canEmailUsers={false} currentUserId="99999999-9999-4999-8999-999999999999" />)

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "grace@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Grace Hopper" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Create user" }))

    await waitFor(() => {
      expect(screen.getByText(/temporary password created/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /copy password/i }))

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("rqm4gjfdf7ew")
    })
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument()
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

    render(<UsersPageClient initialUsers={initialUsers} canEmailUsers={false} currentUserId="99999999-9999-4999-8999-999999999999" />)

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
    render(<UsersPageClient initialUsers={initialUsers} canEmailUsers={false} currentUserId="11111111-1111-4111-8111-111111111111" />)

    expect(screen.getByRole("combobox", { name: /role for ada lovelace/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled()
  })
})
