import { describe, expect, it } from "vitest"

import { savedSearchSchema, type SavedSearch } from "@/lib/contracts/saved-searches"
import { mockSavedSearches } from "@/lib/mocks/scans"
import {
  buildSavedSearchRow,
  buildSavedSearchRows,
  createSavedSearch,
  deleteSavedSearch,
  filterSavedSearchRows,
  renameSavedSearch,
  setSavedSearchPinned,
} from "@/lib/queries/saved-searches"

const contractSavedSearches: SavedSearch[] = savedSearchSchema.array().parse([
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

describe("/saved-searches query contract", () => {
  it("builds a page row from the real saved-search contract without mock-only fields", () => {
    const row = buildSavedSearchRow(contractSavedSearches[0]!)

    expect(row).toEqual({
      id: "ss_01",
      name: "WordPress + WooCommerce",
      pinned: true,
      queryDescription: "Sites using WordPress and WooCommerce",
    })
    expect(Object.keys(row).sort()).toEqual(["id", "name", "pinned", "queryDescription"].sort())
    expect(savedSearchSchema.parse(row)).toEqual(row)
  })

  it("filters by name and query description with case-insensitive trimmed matching", () => {
    const rows = buildSavedSearchRows(contractSavedSearches)

    expect(filterSavedSearchRows(rows, "  wooCOMMERCE ").map((row) => row.id)).toEqual(["ss_01"])
    expect(filterSavedSearchRows(rows, "fastly").map((row) => row.id)).toEqual(["ss_02"])
  })

  it("creates a saved search from canonical fields only", () => {
    const rows = buildSavedSearchRows(contractSavedSearches)
    const nextRows = createSavedSearch(
      rows,
      savedSearchSchema.parse({
        id: "ss_04",
        name: "React Marketing Sites",
        pinned: false,
        queryDescription: "Marketing properties built with React and a CDN",
      }),
    )

    expect(nextRows).toHaveLength(4)
    expect(nextRows[3]).toEqual({
      id: "ss_04",
      name: "React Marketing Sites",
      pinned: false,
      queryDescription: "Marketing properties built with React and a CDN",
    })
    expect(savedSearchSchema.array().parse(nextRows)).toEqual(nextRows)
  })

  it("renames a saved search without altering id, pin state, or query description", () => {
    const rows = buildSavedSearchRows(contractSavedSearches)
    const renamedRows = renameSavedSearch(rows, "ss_02", "Fastly Edge Workers")

    expect(renamedRows[1]).toEqual({
      id: "ss_02",
      name: "Fastly Edge Workers",
      pinned: false,
      queryDescription: "Targets behind Fastly edge infrastructure",
    })
  })

  it("pins a saved search for home without altering name or query description", () => {
    const rows = buildSavedSearchRows(contractSavedSearches)
    const pinnedRows = setSavedSearchPinned(rows, "ss_03", true)

    expect(pinnedRows[2]).toEqual({
      id: "ss_03",
      name: "Cloudflare Login Pages",
      pinned: true,
      queryDescription: "Login surfaces served from Cloudflare with custom titles",
    })
  })

  it("deletes a saved search by id", () => {
    const rows = buildSavedSearchRows(contractSavedSearches)
    const nextRows = deleteSavedSearch(rows, "ss_01")

    expect(nextRows.map((row) => row.id)).toEqual(["ss_02", "ss_03"])
    expect(savedSearchSchema.array().parse(nextRows)).toEqual(nextRows)
  })

  it("returns canonical row order and empty filter results for saved-search consumers", () => {
    const pageRows = buildSavedSearchRows([...mockSavedSearches].sort((left, right) => {
      if (left.pinned !== right.pinned) {
        return left.pinned ? -1 : 1
      }

      return left.name.localeCompare(right.name)
    }))

    expect(pageRows).toEqual([
      {
        id: "ss_04",
        name: "Next.js Marketing Sites",
        pinned: true,
        queryDescription: "Technology = Next.js, tag = marketing",
      },
      {
        id: "ss_06",
        name: "Shopify Storefronts",
        pinned: true,
        queryDescription: "Technology = Shopify",
      },
      {
        id: "ss_01",
        name: "WordPress + WooCommerce",
        pinned: true,
        queryDescription: "Technology = WordPress, WooCommerce",
      },
      {
        id: "ss_02",
        name: "Behind Fastly",
        pinned: false,
        queryDescription: "CDN = Fastly",
      },
      {
        id: "ss_03",
        name: "Cloudflare Login Pages",
        pinned: false,
        queryDescription: "Title contains Login, CDN = Cloudflare",
      },
      {
        id: "ss_05",
        name: "Regional Rails Apps",
        pinned: false,
        queryDescription: "Technology = Ruby on Rails, Region = us-east",
      },
    ])
    expect(filterSavedSearchRows(pageRows, "nonexistent")).toEqual([])
    expect(pageRows.map((row) => row.id)).toEqual([
      "ss_04",
      "ss_06",
      "ss_01",
      "ss_02",
      "ss_03",
      "ss_05",
    ])
    expect(pageRows.every((row) => savedSearchSchema.safeParse(row).success)).toBe(true)
    expect(mockSavedSearches).toHaveLength(6)
    expect(mockSavedSearches.map((search) => search.id)).toEqual([
      "ss_01",
      "ss_02",
      "ss_03",
      "ss_04",
      "ss_05",
      "ss_06",
    ])
  })
})
