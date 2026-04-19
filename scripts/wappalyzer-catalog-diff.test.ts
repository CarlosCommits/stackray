// @vitest-environment node

import { describe, expect, it } from "vitest"

import { diffWappalyzerCatalogContents, formatTechnologyMarkdown, parseCatalogDiffCliArgs, parseWappalyzerCatalogContents } from "./wappalyzer-catalog-diff"

describe("parseWappalyzerCatalogContents", () => {
  it("returns an empty catalog for blank contents", () => {
    expect(parseWappalyzerCatalogContents("  \n")).toEqual({})
  })
})

describe("parseCatalogDiffCliArgs", () => {
  it("ignores pnpm's literal double-dash separator", () => {
    expect(parseCatalogDiffCliArgs(["--", "main", "HEAD", "--limit", "3"])).toEqual({
      base: "main",
      head: "HEAD",
      limit: 3,
    })
  })
})

describe("diffWappalyzerCatalogContents", () => {
  it("reports added, removed, and changed technologies using human-readable names", () => {
    const previousContents = JSON.stringify({
      apache: { name: "Apache HTTP Server", categories: ["web servers"] },
      drupal: { name: "Drupal", categories: ["cms"] },
      ghost: { name: "Ghost", categories: ["cms"] },
    })

    const nextContents = JSON.stringify({
      apache: { name: "Apache HTTP Server", categories: ["servers"] },
      drupal: { name: "Drupal", categories: ["cms"] },
      wordpress: { name: "WordPress", categories: ["cms"] },
    })

    expect(diffWappalyzerCatalogContents(previousContents, nextContents)).toEqual({
      addedKeys: ["wordpress"],
      removedKeys: ["ghost"],
      changedKeys: ["apache"],
      addedNames: ["WordPress"],
      removedNames: ["Ghost"],
      changedNames: ["Apache HTTP Server"],
    })
  })

  it("falls back to the technology key when a display name is missing", () => {
    const previousContents = JSON.stringify({ legacytool: {} })
    const nextContents = JSON.stringify({})

    expect(diffWappalyzerCatalogContents(previousContents, nextContents).removedNames).toEqual(["legacytool"])
  })

  it("sorts displayed technology names alphabetically", () => {
    const previousContents = JSON.stringify({})
    const nextContents = JSON.stringify({
      zed: { name: "Zed" },
      alpha: { name: "Alpha" },
      bravo: { name: "Bravo" },
    })

    expect(diffWappalyzerCatalogContents(previousContents, nextContents).addedNames).toEqual(["Alpha", "Bravo", "Zed"])
  })
})

describe("formatTechnologyMarkdown", () => {
  it("formats a capped markdown list with an overflow line", () => {
    expect(formatTechnologyMarkdown(["Alpha", "Bravo", "Charlie"], 2)).toBe([
      "- `Alpha`",
      "- `Bravo`",
      "- _...and 1 more_",
    ].join("\n"))
  })

  it("returns an empty string when there are no names", () => {
    expect(formatTechnologyMarkdown([])).toBe("")
  })
})
