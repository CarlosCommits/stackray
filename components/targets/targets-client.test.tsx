import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, within, waitFor } from "@testing-library/react"

import { TargetsClient } from "./targets-client"
import {
  TARGETS_CLEAR_FILTERS_BUTTON_LABEL,
  TARGETS_EMPTY_STATE,
  TARGETS_FILTER_EMPTY_STATE,
  TARGETS_FILTER_LABELS,
  TARGETS_FILTER_PLACEHOLDER,
  TARGETS_RESULT_COUNT_LABEL,
} from "./types"
import { getMockTargetFilterOptions, getMockTargetResults } from "@/lib/mocks/targets"
import { buildTargetRows, parseTargetQuery } from "@/lib/targets/shared"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

beforeEach(() => {
  window.sessionStorage.clear()
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, "http://localhost")

    if (url.pathname === "/api/v1/targets/filter-options") {
      return {
        ok: true,
        json: async () => getMockTargetFilterOptions(),
      } satisfies Partial<Response>
    }

    return {
      ok: true,
      json: async () => getMockTargetResults(url.searchParams),
    } satisfies Partial<Response>
  }))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function renderTargetsClient(search = "") {
  const searchParams = new URLSearchParams(search)
  const response = getMockTargetResults(searchParams)
  const data = {
    rows: buildTargetRows(response.items),
    nextCursor: response.nextCursor,
    query: parseTargetQuery(searchParams),
  }

  render(
    <TargetsClient
      initialRows={data.rows}
      initialNextCursor={data.nextCursor}
      initialQuery={data.query}
      initialFilterOptions={getMockTargetFilterOptions()}
    />,
  )
}

describe("targets client", () => {
  it("renders the targets page without a latest or snapshots toggle", async () => {
    await renderTargetsClient()

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
    expect(screen.queryByText(new RegExp(`\\d+ ${TARGETS_RESULT_COUNT_LABEL}`))).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Open latest scan for https://tpss.coop" })).not.toBeInTheDocument()
    expect(screen.getByRole("table")).toBeInTheDocument()
  })

  it("does not refetch filter options when unfiltered SSR already provided them", async () => {
    await renderTargetsClient()

    const mockedFetch = vi.mocked(fetch)
    mockedFetch.mockClear()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^filters/i }))
      await Promise.resolve()
    })

    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it("does not autofocus the first parameter field when opening filters", async () => {
    await renderTargetsClient()

    fireEvent.click(screen.getByRole("button", { name: /^filters/i }))

    const technologyInput = await screen.findByPlaceholderText("Technology...")

    expect(technologyInput).not.toHaveFocus()
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

    await waitFor(() => {
      const table = screen.getByRole("table")
      expect(screen.getByText(`1 ${TARGETS_RESULT_COUNT_LABEL}`)).toBeInTheDocument()
      expect(within(table).getByText("wordpress.org")).toBeInTheDocument()
      expect(within(table).queryByText("vercel.com")).not.toBeInTheDocument()
    })

    // Clear and search for jetpack plugin
    fireEvent.change(screen.getByPlaceholderText(TARGETS_FILTER_PLACEHOLDER), {
      target: { value: "jetpack" },
    })

    await waitFor(() => {
      const table = screen.getByRole("table")
      expect(within(table).getByText("wordpress.org")).toBeInTheDocument()
      expect(within(table).queryByText("tpss.coop")).not.toBeInTheDocument()
    })
  })

  it("hides the stale result count while a debounced search update is pending", async () => {
    vi.useFakeTimers()

    await renderTargetsClient("q=wordpress")

    expect(screen.getByText(`2 ${TARGETS_RESULT_COUNT_LABEL}`)).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(TARGETS_FILTER_PLACEHOLDER), {
      target: { value: "vercel" },
    })

    expect(screen.queryByText(`2 ${TARGETS_RESULT_COUNT_LABEL}`)).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(300)
      await Promise.resolve()
    })

    vi.useRealTimers()

    await waitFor(() => {
      expect(screen.getByText(`1 ${TARGETS_RESULT_COUNT_LABEL}`)).toBeInTheDocument()
    })
  })

  it("filters by date range", async () => {
    // Seed with dates so calendar opens to correct month (March 2026)
    await renderTargetsClient("from=2026-03-21&to=2026-03-22")

    // Open the Filters popover to access date pickers
    const filtersButton = screen.getByRole("button", { name: /^filters/i })
    fireEvent.click(filtersButton)

    const fromButton = await screen.findByRole("combobox", { name: TARGETS_FILTER_LABELS.from })
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
    expect(within(table).getByText("vercel.com")).toBeInTheDocument()
    expect(within(table).getByText("wordpress.org")).toBeInTheDocument()
    expect(within(table).queryByText("tpss.coop")).not.toBeInTheDocument()
  })

  it("lets a single date filter be cleared without clearing all filters", async () => {
    await renderTargetsClient("from=2026-03-21")

    // Open the Filters popover to access the date clear button
    const filtersButton = screen.getByRole("button", { name: /^filters/i })
    fireEvent.click(filtersButton)

    fireEvent.click(await screen.findByRole("button", { name: /clear from date/i }))

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

  it("shows hidden filter chips for plugin and theme when seeded via URL", async () => {
    await renderTargetsClient("plugin=jetpack&theme=storefront")

    expect(screen.getByText("Plugin:")).toBeInTheDocument()
    expect(screen.getByText("Jetpack")).toBeInTheDocument()
    expect(screen.getByText("Theme:")).toBeInTheDocument()
    expect(screen.getByText("Storefront")).toBeInTheDocument()
  })

  it("shows hidden filter chip for technology when seeded via URL", async () => {
    await renderTargetsClient("technology=wordpress")

    expect(screen.getByText("Technology:")).toBeInTheDocument()
    expect(screen.getAllByText("WordPress").length).toBeGreaterThan(0)
  })

  it("filters parameter option lists while typing into a filter combobox", async () => {
    await renderTargetsClient()

    fireEvent.click(screen.getByRole("button", { name: /^filters/i }))

    const pluginInput = await screen.findByPlaceholderText("Plugin...")
    fireEvent.change(pluginInput, {
      target: { value: "stripe" },
    })

    await waitFor(() => {
      expect(within(screen.getByRole("listbox", { name: "Plugin options" })).getByText("WooCommerce Gateway Stripe")).toBeInTheDocument()
    })

    expect(within(screen.getByRole("listbox", { name: "Plugin options" })).queryByText("Jetpack")).not.toBeInTheDocument()
  })

  it("selects the top filtered parameter option when pressing enter", async () => {
    await renderTargetsClient()

    fireEvent.click(screen.getByRole("button", { name: /^filters/i }))

    const pluginInput = await screen.findByPlaceholderText("Plugin...")
    fireEvent.change(pluginInput, {
      target: { value: "stripe" },
    })

    await waitFor(() => {
      expect(within(screen.getByRole("listbox", { name: "Plugin options" })).getByText("WooCommerce Gateway Stripe")).toBeInTheDocument()
    })

    fireEvent.keyDown(pluginInput, {
      key: "Enter",
      code: "Enter",
    })

    await waitFor(() => {
      expect(screen.getByText("Plugin:")).toBeInTheDocument()
      expect(screen.getAllByText("WooCommerce Gateway Stripe").length).toBeGreaterThan(0)
    })
  })

  it("removes a hidden filter chip when its dismiss button is clicked", async () => {
    await renderTargetsClient("cdn=cloudflare")

    expect(screen.getByText("CDN:")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /remove cdn filter/i }))

    await waitFor(() => {
      expect(screen.queryByText("CDN:")).not.toBeInTheDocument()
    })
  })

  it("removes the technology hidden filter chip when its dismiss button is clicked", async () => {
    await renderTargetsClient("technology=wordpress")

    expect(screen.getByText("Technology:")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /remove technology filter/i }))

    await waitFor(() => {
      expect(screen.queryByText("Technology:")).not.toBeInTheDocument()
    })
  })

  it("shows load more when the initial page is limited and appends later results", async () => {
    const initialResponse = getMockTargetResults(new URLSearchParams("limit=1"))

    render(
      <TargetsClient
        initialRows={buildTargetRows(initialResponse.items)}
        initialNextCursor={initialResponse.nextCursor}
        initialQuery={parseTargetQuery(new URLSearchParams("limit=1"))}
        initialFilterOptions={getMockTargetFilterOptions()}
      />,
    )

    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /load more/i }))

    await waitFor(() => {
      const table = screen.getByRole("table")
      expect(within(table).getByText("tpss.coop")).toBeInTheDocument()
      expect(within(table).getByText("vercel.com")).toBeInTheDocument()
      expect(within(table).getByText("wordpress.org")).toBeInTheDocument()
      expect(within(table).getByText("login.acme.test")).toBeInTheDocument()
    })
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
    expect(within(table).getByText("tpss.coop")).toBeInTheDocument()
    expect(window.sessionStorage.getItem("stackray:targets-table:v1")).toBeNull()
  })

  it("does not fetch a stale search after filters are cleared before debounce settles", async () => {
    vi.useFakeTimers()

    await renderTargetsClient()

    const mockedFetch = vi.mocked(fetch)
    mockedFetch.mockClear()

    fireEvent.change(screen.getByPlaceholderText(TARGETS_FILTER_PLACEHOLDER), {
      target: { value: "stale-search" },
    })
    fireEvent.click(screen.getByRole("button", { name: TARGETS_CLEAR_FILTERS_BUTTON_LABEL }))

    await act(async () => {
      vi.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(mockedFetch).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem("stackray:targets-table:v1")).toBeNull()
  })

  it("restores filters from sessionStorage and refetches targets", async () => {
    window.sessionStorage.setItem("stackray:targets-table:v1", JSON.stringify({
      q: "blog",
      technology: ["wordpress"],
      cdn: ["cloudflare"],
      server: [],
      plugin: ["jetpack"],
      theme: [],
      cpe: [],
      statusCode: ["200"],
      from: "2026-03-21",
      to: "2026-03-22",
    }))

    await renderTargetsClient()

    await waitFor(() => {
      expect(screen.getByDisplayValue("blog")).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled()
    })

    const mockedFetch = vi.mocked(fetch)
    const requestUrl = new URL(String(mockedFetch.mock.calls.at(-1)?.[0]), "http://localhost")

    expect(requestUrl.searchParams.get("q")).toBe("blog")
    expect(requestUrl.searchParams.get("technology")).toBe("wordpress")
    expect(requestUrl.searchParams.get("cdn")).toBe("cloudflare")
    expect(requestUrl.searchParams.get("plugin")).toBe("jetpack")
    expect(requestUrl.searchParams.get("statusCode")).toBe("200")
    expect(requestUrl.searchParams.get("from")).toBe("2026-03-21")
    expect(requestUrl.searchParams.get("to")).toBe("2026-03-22")
  })

  it("keeps explicit URL filters ahead of stored session state", async () => {
    window.sessionStorage.setItem("stackray:targets-table:v1", JSON.stringify({
      q: "blog",
      technology: [],
      cdn: [],
      server: [],
      plugin: [],
      theme: [],
      cpe: [],
      statusCode: [],
      from: "",
      to: "",
    }))

    await renderTargetsClient("plugin=jetpack")

    expect(screen.queryByDisplayValue("blog")).not.toBeInTheDocument()
    expect(screen.getByText("Plugin:")).toBeInTheDocument()
    expect(screen.getByText("Jetpack")).toBeInTheDocument()
    expect(JSON.parse(window.sessionStorage.getItem("stackray:targets-table:v1") ?? "{}")).toMatchObject({
      plugin: ["jetpack"],
      q: "",
    })
  })

  it("renders the filtered empty state when seeded with an already-empty query result", async () => {
    const query = parseTargetQuery(new URLSearchParams("q=nonexistent-term"))

    render(
      <TargetsClient
        initialRows={[]}
        initialNextCursor={null}
        initialQuery={query}
        initialFilterOptions={getMockTargetFilterOptions()}
      />,
    )

    expect(screen.getByText(TARGETS_FILTER_EMPTY_STATE.title)).toBeInTheDocument()
    expect(screen.queryByText(TARGETS_EMPTY_STATE.title)).not.toBeInTheDocument()
  })
})
