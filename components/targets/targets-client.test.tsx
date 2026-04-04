import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react"

import { TargetsClient } from "./targets-client"
import {
  TARGETS_CLEAR_FILTERS_BUTTON_LABEL,
  TARGETS_EMPTY_STATE,
  TARGETS_FILTER_EMPTY_STATE,
  TARGETS_FILTER_LABELS,
  TARGETS_FILTER_PLACEHOLDER,
  TARGETS_PAGE_TITLE,
  TARGETS_RESULT_COUNT_LABEL,
} from "./types"
import { buildTargetRows, parseTargetQuery } from "@/lib/targets/shared"
import { getTargetResults } from "@/lib/queries/targets"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, "http://localhost")
    return {
      ok: true,
      json: async () => getTargetResults(url.searchParams),
    } satisfies Partial<Response>
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function renderTargetsClient(search = "") {
  const searchParams = new URLSearchParams(search)
  const data = {
    rows: buildTargetRows(getTargetResults(searchParams).items),
    query: parseTargetQuery(searchParams),
  }

  render(
    <TargetsClient
      initialRows={data.rows}
      initialQuery={data.query}
      title={TARGETS_PAGE_TITLE}
    />,
  )
}

describe("targets client", () => {
  it("renders the targets page title without a latest or snapshots toggle", async () => {
    await renderTargetsClient()

    expect(screen.getByRole("heading", { name: TARGETS_PAGE_TITLE })).toBeInTheDocument()
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
    expect(screen.queryByText(new RegExp(`\\d+ ${TARGETS_RESULT_COUNT_LABEL}`))).not.toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Open latest scan for https://primary.example.test" }).length).toBeGreaterThan(0)
    expect(screen.getByRole("table")).toBeInTheDocument()
  })

  it("ignores a legacy snapshots mode query and still renders latest-only rows", async () => {
    await renderTargetsClient("mode=snapshots")

    const table = await screen.findByRole("table")
    expect(within(table).queryByText("Takoma Park Silver Spring Co-op")).not.toBeInTheDocument()
    expect(within(table).getByText("Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store")).toBeInTheDocument()
  })

  it("filters by target query using the shared query semantics", async () => {
    await renderTargetsClient()

    fireEvent.change(screen.getByPlaceholderText(TARGETS_FILTER_PLACEHOLDER), {
      target: { value: "nginx" },
    })

    let table = await screen.findByRole("table")
    expect(screen.getByText(`1 ${TARGETS_RESULT_COUNT_LABEL}`)).toBeInTheDocument()
    expect(within(table).getByText("https://cms.example.test")).toBeInTheDocument()
    expect(within(table).queryByText("https://app.example.test")).not.toBeInTheDocument()

    // Clear and search for jetpack plugin
    fireEvent.change(screen.getByPlaceholderText(TARGETS_FILTER_PLACEHOLDER), {
      target: { value: "jetpack" },
    })

    table = await screen.findByRole("table")
    expect(within(table).getByText("https://cms.example.test")).toBeInTheDocument()
    expect(within(table).queryByText("https://primary.example.test")).not.toBeInTheDocument()
  })

  it("filters by date range", async () => {
    // Seed with dates so calendar opens to correct month (March 2026)
    await renderTargetsClient("from=2026-03-21&to=2026-03-22")

    // Clear the dates to test the full interaction
    const fromButton = screen.getByRole("combobox", { name: TARGETS_FILTER_LABELS.from })
    fireEvent.click(fromButton)

    const fromCalendar = await screen.findByRole("grid")
    const fromDayButton = within(fromCalendar).getByRole("button", { name: /Saturday, March 21st, 2026/i })
    fireEvent.click(fromDayButton)

    const toButton = screen.getByRole("combobox", { name: TARGETS_FILTER_LABELS.to })
    fireEvent.click(toButton)

    const toCalendar = await screen.findByRole("grid")
    const toDayButton = within(toCalendar).getByRole("button", { name: /Sunday, March 22nd, 2026/i })
    fireEvent.click(toDayButton)

    const table = await screen.findByRole("table")
    expect(within(table).getByText("https://app.example.test")).toBeInTheDocument()
    expect(within(table).getByText("https://cms.example.test")).toBeInTheDocument()
    expect(within(table).queryByText("https://primary.example.test")).not.toBeInTheDocument()
  })

  it("lets a single date filter be cleared without clearing all filters", async () => {
    await renderTargetsClient("from=2026-03-21")

    fireEvent.click(screen.getByRole("button", { name: /clear from date/i }))

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /clear from date/i })).not.toBeInTheDocument()
    })

    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(`\\d+ ${TARGETS_RESULT_COUNT_LABEL}`))).not.toBeInTheDocument()
  })

  it("preserves plugin filters across hydration and subsequent client fetches", async () => {
    await renderTargetsClient("plugin=jetpack")

    fireEvent.change(screen.getByPlaceholderText(TARGETS_FILTER_PLACEHOLDER), {
      target: { value: "blog" },
    })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled()
    })

    const mockedFetch = vi.mocked(fetch)
    const lastCall = mockedFetch.mock.calls.at(-1)
    expect(lastCall).toBeDefined()

    const requestUrl = new URL(lastCall?.[0] instanceof Request ? lastCall[0].url : String(lastCall?.[0]), "http://localhost")

    expect(requestUrl.searchParams.get("plugin")).toBe("jetpack")
    expect(requestUrl.searchParams.get("q")).toBe("blog")
  })

  it("shows the filtered empty state and clears filters back to results", async () => {
    await renderTargetsClient()

    fireEvent.change(screen.getByPlaceholderText(TARGETS_FILTER_PLACEHOLDER), {
      target: { value: "nonexistent-term" },
    })

    await waitFor(() => {
      expect(screen.getByText(TARGETS_FILTER_EMPTY_STATE.title)).toBeInTheDocument()
    })
    expect(screen.getByText(TARGETS_FILTER_EMPTY_STATE.description)).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole("button", { name: TARGETS_CLEAR_FILTERS_BUTTON_LABEL })[0]!)

    const table = await screen.findByRole("table")
    expect(screen.queryByText(new RegExp(`\\d+ ${TARGETS_RESULT_COUNT_LABEL}`))).not.toBeInTheDocument()
    expect(within(table).getByText("https://primary.example.test")).toBeInTheDocument()
  })

  it("renders the filtered empty state when seeded with an already-empty query result", async () => {
    const query = parseTargetQuery(new URLSearchParams("q=nonexistent-term"))

    render(
      <TargetsClient
        initialRows={[]}
        initialQuery={query}
        title={TARGETS_PAGE_TITLE}
      />,
    )

    expect(screen.getByText(TARGETS_FILTER_EMPTY_STATE.title)).toBeInTheDocument()
    expect(screen.queryByText(TARGETS_EMPTY_STATE.title)).not.toBeInTheDocument()
  })
})
