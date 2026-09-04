import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { ChangeFeed, targetComparisonHref } from "@/components/changes/change-feed"
import {
  ChangeComparisonTimeline,
  targetChangeItemHref,
} from "@/components/changes/change-comparison-timeline"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ChangeFeedComparison, ChangeFeedResponse, ScanComparison } from "@/lib/contracts/changes"
import type { ChangeFeedFilters } from "@/components/changes/change-filters"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}))

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function comparison({
  id,
  target,
  completedAt,
  itemCount = 1,
}: {
  id: string
  target: string
  completedAt: string
  itemCount?: number
}): ScanComparison {
  const items = Array.from({ length: itemCount }, (_, index) => ({
    id: `item-${id}-${index}`,
    category: "content" as const,
    changeType: index === 0 ? "body_fingerprint.changed" : "metadata.title_changed",
    fieldPath: index === 0 ? "body_fingerprint.changed" : "metadata.title_changed",
    summary: index === 0 ? "Exact response body changed" : "Page title changed",
    endpointIdentity: `${target}:443/`,
    before: index === 0 ? { hashes: { body_md5: `old-${index}` } } : `Old title ${index}`,
    after: index === 0 ? { hashes: { body_md5: `new-${index}` } } : `New title ${index}`,
    alertEligible: false,
  }))

  return {
    id,
    canonicalTargetId: `target-${target}`,
    status: "completed",
    algorithmVersion: 1,
    currentScan: {
      id: `scan-${id}`,
      target,
      completedAt,
      faviconUrl: "https://example.test/favicon.ico",
    },
    baselineScan: {
      id: `baseline-${id}`,
      target,
      completedAt: "2026-07-16T15:00:00.000Z",
    },
    baselineMode: "previous",
    counts: {
      total: itemCount,
      alertEligible: 0,
    },
    items,
    errorMessage: null,
    createdAt: completedAt,
  }
}

function feedComparison(options: Parameters<typeof comparison>[0]): ChangeFeedComparison {
  const fullComparison = comparison(options)

  return {
    ...fullComparison,
    counts: {
      ...fullComparison.counts,
      matching: fullComparison.counts.total,
    },
    items: fullComparison.items.slice(0, 3).map((item) => ({
      id: item.id,
      category: item.category,
      changeType: item.changeType,
      summary: item.summary,
      preview: item.changeType === "body_fingerprint.changed"
        ? "Response content differs from the baseline"
        : "Old title → New title",
    })),
    itemsTruncated: fullComparison.items.length > 3,
  }
}

function renderFeed(response: ChangeFeedResponse, filters: ChangeFeedFilters = { target: null, category: null }) {
  return render(
    <TooltipProvider>
      <ChangeFeed response={response} filters={filters} />
    </TooltipProvider>,
  )
}

describe("ChangeFeed", () => {
  it("groups comparisons by day and shows individual change previews", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-18T16:00:00.000Z"))

    const response: ChangeFeedResponse = {
      items: [
        feedComparison({ id: "latest-example", target: "https://example.test", completedAt: "2026-07-18T15:00:00.000Z", itemCount: 4 }),
        feedComparison({ id: "same-day", target: "https://other.test", completedAt: "2026-07-18T14:00:00.000Z" }),
        feedComparison({ id: "older-example", target: "https://example.test", completedAt: "2026-07-17T15:00:00.000Z" }),
      ],
      nextCursor: null,
    }

    const { container } = renderFeed(response)

    expect(screen.getByRole("heading", { name: "July 18, 2026" })).toHaveClass("md:sticky", "md:top-[4.75rem]")
    expect(screen.getByRole("heading", { name: "July 17, 2026" })).toBeVisible()
    expect(screen.getAllByText("example.test")).toHaveLength(2)
    expect(screen.getByText("other.test")).toBeVisible()
    expect(screen.getAllByText("Baseline")).toHaveLength(3)
    expect(screen.getAllByText("Current scan")).toHaveLength(3)
    const comparisonFlows = container.querySelectorAll('[data-slot="comparison-flow"]')
    expect(comparisonFlows).toHaveLength(3)
    for (const flow of comparisonFlows) {
      expect(flow).toHaveClass("flex-nowrap", "text-xs", "md:ml-auto", "md:justify-end")
    }
    for (const header of container.querySelectorAll('[data-slot="card-header"]')) {
      expect(header).not.toHaveClass("sticky")
      expect(header).not.toHaveClass("sm:sticky")
      expect(header).not.toHaveClass("sm:top-[4.75rem]")
    }
    expect(screen.queryByText("Automatic")).not.toBeInTheDocument()
    expect(screen.queryByText("Pinned")).not.toBeInTheDocument()
    expect(screen.queryByText(/Compared with/)).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Response body changed/ })).toHaveLength(3)
    expect(screen.getByRole("link", { name: "View all 4 changes" })).toBeVisible()
    expect(screen.getAllByText("Content").length).toBeGreaterThan(0)
    expect(container.querySelectorAll('img[src="https://example.test/favicon.ico"]')).toHaveLength(3)
    expect(container.querySelector('[data-slot="change-feed-filters"]')).toHaveClass("sticky", "top-0", "pt-3")
  })

  it("links target names to their change history and view-all actions to exact comparisons", () => {
    const item = feedComparison({ id: "latest", target: "https://example.test", completedAt: "2026-07-18T15:00:00.000Z", itemCount: 4 })
    renderFeed({ items: [item], nextCursor: null })

    expect(screen.getByRole("link", { name: "example.test" })).toHaveAttribute(
      "href",
      "/targets/target-https://example.test/changes",
    )
    expect(screen.getByRole("link", { name: "View all 4 changes" })).toHaveAttribute(
      "href",
      "/targets/target-https://example.test/changes?comparison=latest#comparison-latest",
    )
    expect(targetComparisonHref(item)).toBe(
      "/targets/target-https://example.test/changes?comparison=latest#comparison-latest",
    )
  })

  it("uses filtered counts and preserves the category in comparison links", () => {
    const item = feedComparison({
      id: "latest",
      target: "https://example.test",
      completedAt: "2026-07-18T15:00:00.000Z",
      itemCount: 4,
    })
    item.counts.matching = 2
    item.items = item.items.slice(0, 2)

    renderFeed({ items: [item], nextCursor: null }, { target: null, category: "content" })

    expect(screen.getByRole("link", { name: "View all 2 matching changes" })).toHaveAttribute(
      "href",
      "/targets/target-https://example.test/changes?category=content&comparison=latest#comparison-latest",
    )
  })

  it("opens an individual change in place", async () => {
    const fullComparison = comparison({ id: "latest", target: "https://example.test", completedAt: "2026-07-18T15:00:00.000Z" })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fullComparison,
    })
    vi.stubGlobal("fetch", fetchMock)
    const response: ChangeFeedResponse = {
      items: [feedComparison({ id: "latest", target: "https://example.test", completedAt: "2026-07-18T15:00:00.000Z" })],
      nextCursor: null,
    }
    renderFeed(response)

    fireEvent.click(screen.getByRole("button", { name: /Response body changed/ }))

    expect(await screen.findByRole("article", { name: "Response body changed" })).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/changes/latest", {
      headers: { Accept: "application/json" },
    })
  })

  it("appends older comparison groups and preserves active filters", async () => {
    const older = feedComparison({ id: "older", target: "https://older.test", completedAt: "2026-07-17T15:00:00.000Z" })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [older], nextCursor: null } satisfies ChangeFeedResponse),
    })
    vi.stubGlobal("fetch", fetchMock)

    renderFeed(
      {
        items: [feedComparison({ id: "latest", target: "https://example.test", completedAt: "2026-07-18T15:00:00.000Z" })],
        nextCursor: "next-cursor",
      },
      { target: "example", category: "content" },
    )

    fireEvent.click(screen.getByRole("button", { name: "Load older comparisons" }))

    expect(await screen.findByText("older.test")).toBeVisible()
    expect(screen.getByText("example.test")).toBeVisible()
    await waitFor(() => expect(screen.queryByRole("button", { name: "Load older comparisons" })).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/changes?cursor=next-cursor&limit=8&target=example&category=content",
      { headers: { Accept: "application/json" } },
    )
  })
})

describe("target change timeline", () => {
  it("removes target identity, lists every change, and keeps item links addressable", () => {
    const item = comparison({
      id: "latest",
      target: "https://example.test",
      completedAt: "2026-07-18T15:00:00.000Z",
      itemCount: 4,
    })
    item.baselineMode = "pinned"

    const { container } = render(
      <TooltipProvider>
        <ChangeComparisonTimeline
          variant="target"
          comparisons={[item]}
          basePath="/targets/target-example/changes"
          category="content"
          selectedComparisonId={null}
          selectedItemId={null}
        />
      </TooltipProvider>,
    )

    expect(screen.queryByRole("link", { name: "example.test" })).not.toBeInTheDocument()
    expect(screen.getAllByRole("link")).toHaveLength(4)
    expect(screen.queryByRole("link", { name: /View all/i })).not.toBeInTheDocument()
    expect(screen.getByText("Current scan").closest('[data-slot="comparison-flow"]')).toHaveClass(
      "md:ml-auto",
      "md:justify-end",
    )
    expect(container.querySelector('[data-slot="card-header"]')).not.toHaveTextContent("Automatic")
    expect(screen.getByText("Pinned")).toBeVisible()
    expect(screen.queryByText(/Compared with/)).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="card-header"]')).not.toHaveClass("sticky")
    expect(container.querySelector('[data-slot="card-header"] h3')).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "July 18, 2026" })).toHaveClass("md:sticky", "md:top-14")
    expect(screen.getAllByRole("link")[0]).toHaveAttribute(
      "href",
      "/targets/target-example/changes?category=content&comparison=latest&item=item-latest-0#comparison-latest",
    )
  })

  it("builds a target item link without an empty category parameter", () => {
    expect(targetChangeItemHref({
      basePath: "/targets/target-example/changes",
      category: null,
      comparisonId: "latest",
      itemId: "change-one",
    })).toBe(
      "/targets/target-example/changes?comparison=latest&item=change-one#comparison-latest",
    )
  })
})
