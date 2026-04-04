import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react"

import { SavedSearchesClient } from "./saved-searches-client"
import {
  SAVED_SEARCHES_CLEAR_FILTERS_BUTTON_LABEL,
  SAVED_SEARCHES_CREATE_BUTTON_LABEL,
  SAVED_SEARCHES_DELETE_BUTTON_LABEL,
  SAVED_SEARCHES_EMPTY_STATE,
  SAVED_SEARCHES_FILTER_EMPTY_STATE,
  SAVED_SEARCHES_FILTER_PLACEHOLDER,
  SAVED_SEARCHES_PAGE_TITLE,
  SAVED_SEARCHES_PIN_BUTTON_LABEL,
  SAVED_SEARCHES_RENAME_BUTTON_LABEL,
  SAVED_SEARCHES_UNPIN_BUTTON_LABEL,
  type SavedSearchRow,
} from "./types"
import { savedSearchSchema } from "@/lib/contracts/saved-searches"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, "http://localhost")
    const method = init?.method ?? "GET"
    const body = init?.body ? JSON.parse(String(init.body)) : null

    if (url.pathname === "/api/v1/saved-searches" && method === "POST") {
      return {
        ok: true,
        json: async () => ({
          id: "ss_created",
          name: body.name,
          pinned: body.pinned ?? false,
          queryDescription: body.queryDescription,
        }),
      } satisfies Partial<Response>
    }

    if (url.pathname.startsWith("/api/v1/saved-searches/") && method === "PATCH") {
      const savedSearchId = url.pathname.split("/").pop()
      const original = initialRows.find((row) => row.id === savedSearchId)
      return {
        ok: true,
        json: async () => ({
          id: savedSearchId,
          name: body.name ?? original?.name ?? "Updated",
          pinned: body.pinned ?? original?.pinned ?? false,
          queryDescription: original?.queryDescription ?? body.queryDescription ?? "",
        }),
      } satisfies Partial<Response>
    }

    if (url.pathname.startsWith("/api/v1/saved-searches/") && method === "DELETE") {
      return {
        ok: true,
        json: async () => ({ ok: true }),
      } satisfies Partial<Response>
    }

    throw new Error(`Unhandled fetch request: ${method} ${url.pathname}`)
  }))
})

const initialRows: SavedSearchRow[] = savedSearchSchema.array().parse([
  {
    id: "ss_01",
    name: "WordPress + WooCommerce",
    pinned: true,
    queryDescription: "Sites using WordPress and WooCommerce",
  },
  {
    id: "ss_02",
    name: "Edge Workers",
    pinned: false,
    queryDescription: "Targets behind Fastly edge infrastructure",
  },
  {
    id: "ss_03",
    name: "Cloudflare Login Pages",
    pinned: false,
    queryDescription: "Login surfaces served from Cloudflare with custom titles",
  },
])

describe("saved-searches client", () => {
  it("renders the empty state when there are no saved searches yet", () => {
    render(<SavedSearchesClient initialRows={[]} />)

    expect(screen.getByRole("heading", { name: SAVED_SEARCHES_PAGE_TITLE })).toBeInTheDocument()
    expect(screen.getByText(SAVED_SEARCHES_EMPTY_STATE.title)).toBeInTheDocument()
    expect(screen.getByText(SAVED_SEARCHES_EMPTY_STATE.description)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: SAVED_SEARCHES_CREATE_BUTTON_LABEL })).toBeInTheDocument()
  })

  it("filters by saved-search name", () => {
    render(<SavedSearchesClient initialRows={initialRows} />)

    fireEvent.change(screen.getByPlaceholderText(SAVED_SEARCHES_FILTER_PLACEHOLDER), {
      target: { value: "wordpress" },
    })

    const table = screen.getByRole("table")
    expect(within(table).getByText("WordPress + WooCommerce")).toBeInTheDocument()
    expect(within(table).queryByText("Edge Workers")).not.toBeInTheDocument()
    expect(within(table).queryByText("Cloudflare Login Pages")).not.toBeInTheDocument()
  })

  it("filters by query description", () => {
    render(<SavedSearchesClient initialRows={initialRows} />)

    fireEvent.change(screen.getByPlaceholderText(SAVED_SEARCHES_FILTER_PLACEHOLDER), {
      target: { value: "fastly" },
    })

    const table = screen.getByRole("table")
    expect(within(table).getByText("Edge Workers")).toBeInTheDocument()
    expect(within(table).queryByText("WordPress + WooCommerce")).not.toBeInTheDocument()
  })

  it("shows the filtered empty state and clears filters back to the list", () => {
    render(<SavedSearchesClient initialRows={initialRows} />)

    fireEvent.change(screen.getByPlaceholderText(SAVED_SEARCHES_FILTER_PLACEHOLDER), {
      target: { value: "nonexistent" },
    })

    expect(screen.getByText(SAVED_SEARCHES_FILTER_EMPTY_STATE.title)).toBeInTheDocument()
    expect(screen.getByText(SAVED_SEARCHES_FILTER_EMPTY_STATE.description)).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole("button", { name: SAVED_SEARCHES_CLEAR_FILTERS_BUTTON_LABEL })[0])

    const table = screen.getByRole("table")
    expect(within(table).getByText("WordPress + WooCommerce")).toBeInTheDocument()
    expect(within(table).getByText("Edge Workers")).toBeInTheDocument()
  })

  it("creates a new saved search with the canonical fields", () => {
    render(<SavedSearchesClient initialRows={[]} />)

    fireEvent.click(screen.getByRole("button", { name: SAVED_SEARCHES_CREATE_BUTTON_LABEL }))

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "React Marketing Sites" },
    })
    fireEvent.change(screen.getByLabelText("Query description"), {
      target: { value: "Marketing properties built with React and a CDN" },
    })
    fireEvent.click(screen.getByRole("button", { name: SAVED_SEARCHES_CREATE_BUTTON_LABEL }))

    return waitFor(() => {
      const table = screen.getByRole("table")
      expect(within(table).getByText("React Marketing Sites")).toBeInTheDocument()
      expect(within(table).getByText("Marketing properties built with React and a CDN")).toBeInTheDocument()
      expect(screen.getAllByRole("button", { name: `${SAVED_SEARCHES_PIN_BUTTON_LABEL} for React Marketing Sites` })[0]).toBeInTheDocument()
      expect(screen.queryByText(SAVED_SEARCHES_EMPTY_STATE.title)).not.toBeInTheDocument()
    })
  })

  it("renames a saved search while preserving its query description", async () => {
    render(<SavedSearchesClient initialRows={initialRows} />)

    fireEvent.click(
      screen.getAllByRole("button", { name: `${SAVED_SEARCHES_RENAME_BUTTON_LABEL} for Edge Workers` })[0],
    )

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Fastly Edge Workers" },
    })
    expect(screen.getByLabelText("Query description")).toHaveValue(
      "Targets behind Fastly edge infrastructure",
    )
    fireEvent.click(screen.getByRole("button", { name: SAVED_SEARCHES_RENAME_BUTTON_LABEL }))

    await waitFor(() => {
      expect(screen.getAllByText("Fastly Edge Workers").length).toBeGreaterThan(0)
    })

    const table = screen.getByRole("table")
    expect(within(table).getByText("Fastly Edge Workers")).toBeInTheDocument()
    expect(within(table).queryByText("Edge Workers")).not.toBeInTheDocument()
    expect(within(table).getByText("Targets behind Fastly edge infrastructure")).toBeInTheDocument()
  })

  it("resets create-mode dialog state when reopened after cancel", () => {
    render(<SavedSearchesClient initialRows={initialRows} />)

    fireEvent.click(screen.getByRole("button", { name: SAVED_SEARCHES_CREATE_BUTTON_LABEL }))
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Temporary Draft" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    fireEvent.click(screen.getByRole("button", { name: SAVED_SEARCHES_CREATE_BUTTON_LABEL }))

    expect(screen.getByLabelText("Name")).toHaveValue("")
    expect(screen.getByLabelText("Query description")).toHaveValue("")
  })

  it("resets edit-mode dialog state when reopening the same row", () => {
    render(<SavedSearchesClient initialRows={initialRows} />)

    const renameButtons = screen.getAllByRole("button", {
      name: `${SAVED_SEARCHES_RENAME_BUTTON_LABEL} for Edge Workers`,
    })

    fireEvent.click(renameButtons[0]!)
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Unsaved Rename" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    fireEvent.click(
      screen.getAllByRole("button", {
        name: `${SAVED_SEARCHES_RENAME_BUTTON_LABEL} for Edge Workers`,
      })[0]!,
    )

    expect(screen.getByLabelText("Name")).toHaveValue("Edge Workers")
    expect(screen.getByLabelText("Query description")).toHaveValue(
      "Targets behind Fastly edge infrastructure",
    )
  })

  it("pins and unpins a saved search for home", async () => {
    render(<SavedSearchesClient initialRows={initialRows} />)

    expect(screen.getAllByRole("button", { name: `${SAVED_SEARCHES_PIN_BUTTON_LABEL} for Cloudflare Login Pages` }).length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole("button", { name: `${SAVED_SEARCHES_PIN_BUTTON_LABEL} for Edge Workers` })[0])

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: `${SAVED_SEARCHES_UNPIN_BUTTON_LABEL} for Edge Workers` })[0]).toBeInTheDocument()
    })
    expect(screen.getAllByRole("button", { name: `${SAVED_SEARCHES_UNPIN_BUTTON_LABEL} for Edge Workers` }).length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole("button", { name: `${SAVED_SEARCHES_UNPIN_BUTTON_LABEL} for Edge Workers` })[0])

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: `${SAVED_SEARCHES_PIN_BUTTON_LABEL} for Edge Workers` })[0]).toBeInTheDocument()
    })
  })

  it("deletes a saved search and returns to the empty state when the last row is removed", async () => {
    render(<SavedSearchesClient initialRows={[initialRows[1]!]} />)

    fireEvent.click(screen.getAllByRole("button", { name: `${SAVED_SEARCHES_DELETE_BUTTON_LABEL} Edge Workers` })[0])
    fireEvent.click(screen.getByRole("button", { name: SAVED_SEARCHES_DELETE_BUTTON_LABEL }))

    await waitFor(() => {
      expect(screen.queryByText("Edge Workers")).not.toBeInTheDocument()
    })
    expect(screen.getByText(SAVED_SEARCHES_EMPTY_STATE.title)).toBeInTheDocument()
    expect(screen.getByText(SAVED_SEARCHES_EMPTY_STATE.description)).toBeInTheDocument()
  })
})
