import { execFile } from "node:child_process"
import { access, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { promisify } from "node:util"

type WappalyzerCatalogRecord = {
  name?: string | null
  description?: string | null
}

type WappalyzerCatalog = Record<string, WappalyzerCatalogRecord>

type WappalyzerDescriptionChange = {
  key: string
  name: string
  previousDescription: string | null
  nextDescription: string | null
}

type WappalyzerCatalogDiff = {
  addedKeys: string[]
  removedKeys: string[]
  changedKeys: string[]
  addedNames: string[]
  removedNames: string[]
  changedNames: string[]
  descriptionChanges: WappalyzerDescriptionChange[]
}

const execFileAsync = promisify(execFile)

const defaultCatalogPath = "lib/server/scans/generated/wappalyzer-catalog.json"
const defaultCliLimit = 25

function compareText(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" })
}

function getTechnologyDisplayName(key: string, record: WappalyzerCatalogRecord | undefined) {
  const name = record?.name?.trim()
  return name && name.length > 0 ? name : key
}

function getTechnologyDescription(record: WappalyzerCatalogRecord | undefined) {
  return record?.description ?? null
}

export function parseWappalyzerCatalogContents(contents: string): WappalyzerCatalog {
  const trimmedContents = contents.trim()

  if (!trimmedContents) {
    return {}
  }

  return JSON.parse(trimmedContents) as WappalyzerCatalog
}

export function formatTechnologyMarkdown(names: readonly string[], limit = Number.POSITIVE_INFINITY) {
  if (names.length === 0) {
    return ""
  }

  const visibleNames = names.slice(0, limit)
  const remainingCount = names.length - visibleNames.length

  return [
    ...visibleNames.map((name) => `- \`${name}\``),
    remainingCount > 0 ? `- _...and ${remainingCount} more_` : "",
  ].filter(Boolean).join("\n")
}

function formatDescription(value: string | null) {
  if (value === null) {
    return "_none_"
  }

  return value.replace(/\s+/g, " ").trim()
}

export function formatDescriptionChangeMarkdown(changes: readonly WappalyzerDescriptionChange[], limit = Number.POSITIVE_INFINITY) {
  if (changes.length === 0) {
    return ""
  }

  const visibleChanges = changes.slice(0, limit)
  const remainingCount = changes.length - visibleChanges.length

  return [
    ...visibleChanges.map((change) => [
      `- \`${change.name}\``,
      `  - Before: ${formatDescription(change.previousDescription)}`,
      `  - After: ${formatDescription(change.nextDescription)}`,
    ].join("\n")),
    remainingCount > 0 ? `- _...and ${remainingCount} more_` : "",
  ].filter(Boolean).join("\n")
}

export function diffWappalyzerCatalogContents(previousContents: string, nextContents: string): WappalyzerCatalogDiff {
  const previousCatalog = parseWappalyzerCatalogContents(previousContents)
  const nextCatalog = parseWappalyzerCatalogContents(nextContents)

  const previousKeys = Object.keys(previousCatalog).sort(compareText)
  const nextKeys = Object.keys(nextCatalog).sort(compareText)
  const previousKeySet = new Set(previousKeys)
  const nextKeySet = new Set(nextKeys)

  const addedKeys = nextKeys.filter((key) => !previousKeySet.has(key))
  const removedKeys = previousKeys.filter((key) => !nextKeySet.has(key))
  const changedKeys = nextKeys.filter((key) => previousKeySet.has(key) && JSON.stringify(previousCatalog[key]) !== JSON.stringify(nextCatalog[key]))
  const descriptionChanges = changedKeys
    .flatMap((key) => {
      const previousDescription = getTechnologyDescription(previousCatalog[key])
      const nextDescription = getTechnologyDescription(nextCatalog[key])

      if (previousDescription === nextDescription) {
        return []
      }

      return [{
        key,
        name: getTechnologyDisplayName(key, nextCatalog[key] ?? previousCatalog[key]),
        previousDescription,
        nextDescription,
      }]
    })
    .sort((left, right) => compareText(left.name, right.name))

  return {
    addedKeys,
    removedKeys,
    changedKeys,
    addedNames: addedKeys.map((key) => getTechnologyDisplayName(key, nextCatalog[key])).sort(compareText),
    removedNames: removedKeys.map((key) => getTechnologyDisplayName(key, previousCatalog[key])).sort(compareText),
    changedNames: changedKeys.map((key) => getTechnologyDisplayName(key, nextCatalog[key] ?? previousCatalog[key])).sort(compareText),
    descriptionChanges,
  }
}

export type ParsedCliArgs = {
  base: string
  head: string
  limit: number
}

export function parseCatalogDiffCliArgs(args: string[]): ParsedCliArgs {
  const positionalArgs: string[] = []
  let limit = defaultCliLimit

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === "--") {
      continue
    }

    if (arg === "--help" || arg === "-h") {
      console.log("Usage: pnpm wappalyzer:diff-catalog -- [base-ref-or-file] [head-ref-or-file] [--limit N]")
      console.log("Defaults to comparing main against the current working tree catalog file.")
      process.exit(0)
    }

    if (arg === "--limit") {
      const nextArg = args[index + 1]
      if (!nextArg) {
        throw new Error("Missing value for --limit")
      }

      const parsedLimit = Number.parseInt(nextArg, 10)
      if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
        throw new Error(`Invalid --limit value: ${nextArg}`)
      }

      limit = parsedLimit
      index += 1
      continue
    }

    positionalArgs.push(arg)
  }

  const [base = "main", head = "WORKTREE"] = positionalArgs
  return { base, head, limit }
}

async function loadCatalogContents(source: string) {
  if (source === "WORKTREE") {
    return readFile(join(process.cwd(), defaultCatalogPath), "utf8")
  }

  const resolvedPath = resolve(process.cwd(), source)
  try {
    await access(resolvedPath)
    return await readFile(resolvedPath, "utf8")
  } catch {
    const { stdout } = await execFileAsync("git", ["show", `${source}:${defaultCatalogPath}`], {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
    })

    return stdout
  }
}

function formatSection(title: string, names: readonly string[], limit: number) {
  if (names.length === 0) {
    return `${title} (0)\n- none`
  }

  return `${title} (${names.length})\n${formatTechnologyMarkdown(names, limit)}`
}

function formatDescriptionSection(title: string, changes: readonly WappalyzerDescriptionChange[], limit: number) {
  if (changes.length === 0) {
    return `${title} (0)\n- none`
  }

  return `${title} (${changes.length})\n${formatDescriptionChangeMarkdown(changes, limit)}`
}

export async function runCatalogDiffCli(args = process.argv.slice(2)) {
  const { base, head, limit } = parseCatalogDiffCliArgs(args)
  const [baseContents, headContents] = await Promise.all([
    loadCatalogContents(base),
    loadCatalogContents(head),
  ])

  const diff = diffWappalyzerCatalogContents(baseContents, headContents)

  console.log("Wappalyzer catalog diff")
  console.log(`Base: ${base}`)
  console.log(`Head: ${head}`)
  console.log("")
  console.log(formatSection("Added", diff.addedNames, limit))
  console.log("")
  console.log(formatSection("Removed", diff.removedNames, limit))
  console.log("")
  console.log(formatSection("Changed", diff.changedNames, limit))
  console.log("")
  console.log(formatDescriptionSection("Description changes", diff.descriptionChanges, limit))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCatalogDiffCli().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
