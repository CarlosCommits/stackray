import { beforeAll, describe, expect, it } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

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
import { getSearchPageData, parseSearchQuery } from "@/lib/queries/search"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

async function renderSearchClient(search = "") {
  const searchParams = new URLSearchParams(search)
  const data = await getSearchPageData(searchParams)

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
    expect(screen.getAllByRole("link", { name: "Open latest scan for https://primary.example.test" }).length).toBeGreaterThan(0)
    expect(screen.getByRole("table")).toBeInTheDocument()
  })

  it("switches to snapshots mode and shows multiple historical matches for the same target", async () => {
    await renderSearchClient()

    fireEvent.click(screen.getByRole("tab", { name: SEARCH_MODE_LABELS.snapshots }))

    const table = screen.getByRole("table")
    expect(screen.getByRole("tab", { name: SEARCH_MODE_LABELS.snapshots })).toHaveAttribute("aria-selected", "true")
    expect(within(table).getByText("Takoma Park Silver Spring Co-op")).toBeInTheDocument()
  })

  it("filters by server and plugin using the shared query semantics", async () => {
    await renderSearchClient()

    fireEvent.change(screen.getByLabelText(SEARCH_FILTER_LABELS.server), {
      target: { value: "nginx" },
    })

    let table = screen.getByRole("table")
    expect(within(table).getByText("https://cms.example.test")).toBeInTheDocument()
    expect(within(table).queryByText("https://app.example.test")).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(SEARCH_FILTER_LABELS.plugin), {
      target: { value: "jetpack" },
    })

    table = screen.getByRole("table")
    expect(within(table).getByText("https://cms.example.test")).toBeInTheDocument()
    expect(within(table).queryByText("https://primary.example.test")).not.toBeInTheDocument()
  })

  it("filters by date range", async () => {
    await renderSearchClient()

    fireEvent.change(screen.getByLabelText(SEARCH_FILTER_LABELS.from), {
      target: { value: "2026-03-21" },
    })
    fireEvent.change(screen.getByLabelText(SEARCH_FILTER_LABELS.to), {
      target: { value: "2026-03-22" },
    })

    const table = screen.getByRole("table")
    expect(within(table).getByText("https://app.example.test")).toBeInTheDocument()
    expect(within(table).getByText("https://cms.example.test")).toBeInTheDocument()
    expect(within(table).queryByText("https://primary.example.test")).not.toBeInTheDocument()
  })

  it("shows the filtered empty state and clears filters back to results", async () => {
    await renderSearchClient()

    fireEvent.change(screen.getByPlaceholderText(SEARCH_FILTER_PLACEHOLDER), {
      target: { value: "nonexistent-term" },
    })

    expect(screen.getByText(SEARCH_FILTER_EMPTY_STATE.title)).toBeInTheDocument()
    expect(screen.getByText(SEARCH_FILTER_EMPTY_STATE.description)).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole("button", { name: SEARCH_CLEAR_FILTERS_BUTTON_LABEL })[0]!)

    const table = screen.getByRole("table")
    expect(within(table).getByText("https://primary.example.test")).toBeInTheDocument()
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
