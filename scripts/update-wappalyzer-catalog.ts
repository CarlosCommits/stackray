import { readFile, writeFile, appendFile } from "node:fs/promises"
import { join } from "node:path"

import { getMappedTechnologyCategories } from "../lib/server/scans/technology-taxonomy.ts"
import { diffWappalyzerCatalogContents, formatDescriptionChangeMarkdown, formatTechnologyMarkdown } from "./wappalyzer-catalog-diff.ts"

type WappalyzerCategoryRecord = {
  name?: string
}

type WappalyzerFingerprintRecord = {
  apps?: Record<string, {
    cats?: number[]
    implies?: string[] | string
    description?: string
    website?: string
    icon?: string
    cpe?: string
  }>
}

type GeneratedCatalogRecord = {
  name: string
  description: string | null
  website: string | null
  icon: string | null
  cpe: string | null
  categories: string[]
  implies: string[]
}

const projectRoot = process.cwd()
const catalogPath = join(projectRoot, "lib/server/scans/generated/wappalyzer-catalog.json")

const fingerprintsUrl = "https://raw.githubusercontent.com/projectdiscovery/wappalyzergo/main/fingerprints_data.json"
const categoriesUrl = "https://raw.githubusercontent.com/projectdiscovery/wappalyzergo/main/categories_data.json"

function normalizeTechnologyKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function toArray(value: string[] | string | undefined) {
  if (!value) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "stackray-wappalyzer-updater",
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

async function appendGitHubOutput(name: string, value: string) {
  const outputPath = process.env.GITHUB_OUTPUT

  if (!outputPath) {
    return
  }

  const delimiter = `STACKRAY_${name.toUpperCase()}_${Date.now()}`
  await appendFile(outputPath, `${name}<<${delimiter}\n${value}\n${delimiter}\n`, "utf8")
}

async function appendStepSummary(markdown: string) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY

  if (!summaryPath) {
    return
  }

  await appendFile(summaryPath, `${markdown}\n`, "utf8")
}

function formatCategoryMarkdown(categories: readonly string[]) {
  return categories.map((category) => `- \`${category}\``).join("\n")
}

async function main() {
  const [fingerprintsData, categoriesData] = await Promise.all([
    fetchJson<WappalyzerFingerprintRecord>(fingerprintsUrl),
    fetchJson<Record<string, WappalyzerCategoryRecord>>(categoriesUrl),
  ])

  const categoryNames = new Map<number, string>()
  for (const [key, value] of Object.entries(categoriesData)) {
    const categoryId = Number.parseInt(key, 10)

    if (!Number.isFinite(categoryId) || !value.name) {
      continue
    }

    categoryNames.set(categoryId, value.name)
  }

  const catalogEntries: Array<[string, GeneratedCatalogRecord]> = []
  const apps = fingerprintsData.apps ?? {}
  for (const [technologyName, record] of Object.entries(apps)) {
    const key = normalizeTechnologyKey(technologyName)

    if (!key) {
      continue
    }

    catalogEntries.push([
      key,
      {
        name: technologyName,
        description: record.description ?? null,
        website: record.website ?? null,
        icon: record.icon ?? null,
        cpe: record.cpe ?? null,
        categories: (record.cats ?? [])
          .map((categoryId) => categoryNames.get(categoryId))
          .filter((categoryName): categoryName is string => Boolean(categoryName)),
        implies: toArray(record.implies),
      },
    ])
  }

  catalogEntries.sort(([left], [right]) => left.localeCompare(right))
  const generatedCatalog = Object.fromEntries(catalogEntries)
  const nextContents = JSON.stringify(generatedCatalog, null, 0)

  let previousContents = ""
  try {
    previousContents = await readFile(catalogPath, "utf8")
  } catch {
    previousContents = ""
  }

  if (previousContents !== nextContents) {
    await writeFile(catalogPath, nextContents, "utf8")
  }

  const mappedCategories = getMappedTechnologyCategories()
  const unmappedCategories = [...new Set(categoryNames.values())]
    .filter((categoryName) => !mappedCategories.has(categoryName))
    .sort((left, right) => left.localeCompare(right))

  const changed = previousContents !== nextContents
  const catalogDiff = diffWappalyzerCatalogContents(previousContents, nextContents)
  const warningMessage = unmappedCategories.length > 0
    ? `Unmapped upstream Wappalyzer categories detected: ${unmappedCategories.join(", ")}. These will currently fall back to \"other\".`
    : null

  console.log(`Generated ${catalogEntries.length} Wappalyzer catalog entries from ${categoryNames.size} upstream categories.`)
  console.log(changed ? `Updated ${catalogPath}.` : `${catalogPath} is already up to date.`)

  if (warningMessage) {
    if (process.env.GITHUB_ACTIONS === "true") {
      console.warn(`::warning title=Wappalyzer category drift::${warningMessage}`)
    } else {
      console.warn(`WARNING: ${warningMessage}`)
    }
  } else {
    console.log("All upstream Wappalyzer categories are explicitly mapped or intentionally fall through to other.")
  }

  await appendGitHubOutput("changed", String(changed))
  await appendGitHubOutput("technology_count", String(catalogEntries.length))
  await appendGitHubOutput("category_count", String(categoryNames.size))
  await appendGitHubOutput("unmapped_count", String(unmappedCategories.length))
  await appendGitHubOutput("unmapped_markdown", formatCategoryMarkdown(unmappedCategories))
  await appendGitHubOutput("added_count", String(catalogDiff.addedNames.length))
  await appendGitHubOutput("removed_count", String(catalogDiff.removedNames.length))
  await appendGitHubOutput("description_changed_count", String(catalogDiff.descriptionChanges.length))
  await appendGitHubOutput("added_markdown", formatTechnologyMarkdown(catalogDiff.addedNames))
  await appendGitHubOutput("removed_markdown", formatTechnologyMarkdown(catalogDiff.removedNames))
  await appendGitHubOutput("description_changes_markdown", formatDescriptionChangeMarkdown(catalogDiff.descriptionChanges))

  await appendStepSummary([
    "## Wappalyzer catalog refresh",
    `- Source fingerprints: ${fingerprintsUrl}`,
    `- Source categories: ${categoriesUrl}`,
    `- Technologies generated: ${catalogEntries.length}`,
    `- Upstream categories seen: ${categoryNames.size}`,
    `- Catalog changed: ${changed ? "yes" : "no"}`,
    `- Added technologies: ${catalogDiff.addedNames.length}`,
    `- Removed technologies: ${catalogDiff.removedNames.length}`,
    `- Description changes: ${catalogDiff.descriptionChanges.length}`,
    `- Changed existing technologies: ${catalogDiff.changedNames.length}`,
    unmappedCategories.length > 0
      ? `- Warning: ${unmappedCategories.length} upstream categories are unmapped and currently fall back to \`other\``
      : "- All upstream categories are mapped",
    unmappedCategories.length > 0 ? "" : "",
    catalogDiff.addedNames.length > 0 ? "### Added technologies" : "",
    catalogDiff.addedNames.length > 0 ? formatTechnologyMarkdown(catalogDiff.addedNames, 20) : "",
    catalogDiff.removedNames.length > 0 ? "### Removed technologies" : "",
    catalogDiff.removedNames.length > 0 ? formatTechnologyMarkdown(catalogDiff.removedNames, 20) : "",
    catalogDiff.descriptionChanges.length > 0 ? "### Description changes" : "",
    catalogDiff.descriptionChanges.length > 0 ? formatDescriptionChangeMarkdown(catalogDiff.descriptionChanges, 20) : "",
    catalogDiff.changedNames.length > 0 ? "### Changed existing technologies" : "",
    catalogDiff.changedNames.length > 0 ? formatTechnologyMarkdown(catalogDiff.changedNames, 20) : "",
    unmappedCategories.length > 0 ? "### Unmapped upstream categories" : "",
    unmappedCategories.length > 0 ? formatCategoryMarkdown(unmappedCategories) : "",
  ].filter(Boolean).join("\n"))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
