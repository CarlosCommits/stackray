import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react"

import { SearchClient } from "./search-client"
import {
  SEARCH_CLEAR_FILTERS_BUTTON_LABEL,
  SEARCH_EMPTY_STATE,
  SEARCH_FILTER_EMPTY_STATE,
  SEARCH_FILTER_LABELS,
  SEARCH_FILTER_PLACEHOLDER,
  SEARCH_MODE_LABELS,
  SEARCH_PAGE_TITLE,
} from "./types"
import { buildSearchRows, parseSearchQuery } from "@/lib/search/shared"
import { getSearchResults } from "@/lib/queries/search"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, "http://localhost")
    return {
      ok: true,
      json: async () => getSearchResults(url.searchParams),
    } satisfies Partial<Response>
  }))
})

async function renderSearchClient(search = "") {
  const searchParams = new URLSearchParams(search)
  const data = {
    rows: buildSearchRows(getSearchResults(searchParams).items),
    query: parseSearchQuery(searchParams),
  }

  render(
    <SearchClient
      initialRows={data.rows}
      initialQuery={data.query}
      title={SEARCH_PAGE_TITLE}
    />,
  )
}

describe("search client", () => {
  it("renders the search page title and latest mode by default", async () => {
    await renderSearchClient()

    expect(screen.getByRole("heading", { name: SEARCH_PAGE_TITLE })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: SEARCH_MODE_LABELS.latest })).toHaveAttribute("aria-selected", "true")
    expect(screen.getAllByRole("link", { name: "Open latest scan for https://tpss.coop" }).length).toBeGreaterThan(0)
    expect(screen.getByRole("table")).toBeInTheDocument()
  })

  it("switches to snapshots mode and shows multiple historical matches for the same target", async () => {
    await renderSearchClient()

    fireEvent.click(screen.getByRole("tab", { name: SEARCH_MODE_LABELS.snapshots }))

    const table = await screen.findByRole("table")
    expect(screen.getByRole("tab", { name: SEARCH_MODE_LABELS.snapshots })).toHaveAttribute("aria-selected", "true")
    expect(within(table).getByText("Takoma Park Silver Spring Co-op")).toBeInTheDocument()
  })

  it("filters by server and plugin using the shared query semantics", async () => {
    await renderSearchClient()

    fireEvent.change(screen.getByLabelText(SEARCH_FILTER_LABELS.server), {
      target: { value: "nginx" },
    })

    let table = await screen.findByRole("table")
    expect(within(table).getByText("https://wordpress.org")).toBeInTheDocument()
    expect(within(table).queryByText("https://vercel.com")).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(SEARCH_FILTER_LABELS.plugin), {
      target: { value: "jetpack" },
    })

    table = await screen.findByRole("table")
    expect(within(table).getByText("https://wordpress.org")).toBeInTheDocument()
    expect(within(table).queryByText("https://tpss.coop")).not.toBeInTheDocument()
  })

  it("filters by date range", async () => {
    await renderSearchClient()

    fireEvent.change(screen.getByLabelText(SEARCH_FILTER_LABELS.from), {
      target: { value: "2026-03-21" },
    })
    fireEvent.change(screen.getByLabelText(SEARCH_FILTER_LABELS.to), {
      target: { value: "2026-03-22" },
    })

    const table = await screen.findByRole("table")
    expect(within(table).getByText("https://vercel.com")).toBeInTheDocument()
    expect(within(table).getByText("https://wordpress.org")).toBeInTheDocument()
    expect(within(table).queryByText("https://tpss.coop")).not.toBeInTheDocument()
  })

  it("shows the filtered empty state and clears filters back to results", async () => {
    await renderSearchClient()

    fireEvent.change(screen.getByPlaceholderText(SEARCH_FILTER_PLACEHOLDER), {
      target: { value: "nonexistent-term" },
    })

    await waitFor(() => {
      expect(screen.getByText(SEARCH_FILTER_EMPTY_STATE.title)).toBeInTheDocument()
    })
    expect(screen.getByText(SEARCH_FILTER_EMPTY_STATE.description)).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole("button", { name: SEARCH_CLEAR_FILTERS_BUTTON_LABEL })[0]!)

    const table = await screen.findByRole("table")
    expect(within(table).getByText("https://tpss.coop")).toBeInTheDocument()
  })

  it("renders the filtered empty state when seeded with an already-empty query result", async () => {
    const query = parseSearchQuery(new URLSearchParams("q=nonexistent-term"))

    render(
      <SearchClient
        initialRows={[]}
        initialQuery={query}
        title={SEARCH_PAGE_TITLE}
      />,
    )

    expect(screen.getByText(SEARCH_FILTER_EMPTY_STATE.title)).toBeInTheDocument()
    expect(screen.queryByText(SEARCH_EMPTY_STATE.title)).not.toBeInTheDocument()
  })
})
