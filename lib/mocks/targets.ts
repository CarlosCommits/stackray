import { targetFilterOptionsResponseSchema, targetResultsResponseSchema } from "@/lib/contracts/targets"
import { parseTargetQuery, type TargetParamsInput, type TargetQuery } from "@/lib/targets/shared"

interface TargetDocument {
  scanId: string
  latestScanId: string
  canonicalTargetId: string
  normalizedTarget: string
  scanStatus: "completed" | "failed" | "cancelled"
  title: string
  technologies: string[]
  statusCode: number
  server: string | null
  cdn: string | null
  wordpressPlugins: string[]
  wordpressThemes: string[]
  cpe: string[]
  scannedAt: string
  faviconUrl: string | null
  screenshotUrl: string | null
}

const mockTargetDocuments: readonly TargetDocument[] = [
  {
    scanId: "scn_01J_target_tpss_latest",
    latestScanId: "scn_01J_target_tpss_latest",
    canonicalTargetId: "ctg_01J_target_tpss",
    normalizedTarget: "https://tpss.coop",
    scanStatus: "completed",
    title: "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
    technologies: ["WordPress", "WooCommerce", "PHP"],
    statusCode: 200,
    server: "Flywheel/5.1.0",
    cdn: "fastly",
    wordpressPlugins: ["woocommerce-gateway-stripe"],
    wordpressThemes: ["storefront"],
    cpe: [
      "cpe:2.3:a:wordpress:wordpress:6.4.3:*:*:*:*:*:*:*",
      "cpe:2.3:a:woocommerce:woocommerce:8.5.2:*:*:*:*:*:*:*",
    ],
    scannedAt: "2026-03-23T16:00:12.000Z",
    faviconUrl: "https://tpss.coop/favicon.ico",
    screenshotUrl: "/api/v1/scans/scn_01J_target_tpss_latest/results/res_tpss_latest/screenshot",
  },
  {
    scanId: "scn_01J_target_tpss_previous",
    latestScanId: "scn_01J_target_tpss_latest",
    canonicalTargetId: "ctg_01J_target_tpss",
    normalizedTarget: "https://tpss.coop",
    scanStatus: "completed",
    title: "Takoma Park Silver Spring Co-op",
    technologies: ["WordPress", "PHP", "Jetpack"],
    statusCode: 200,
    server: "nginx/1.24.0",
    cdn: "cloudflare",
    wordpressPlugins: ["jetpack"],
    wordpressThemes: ["co-op-classic"],
    cpe: ["cpe:2.3:a:wordpress:wordpress:6.4.2:*:*:*:*:*:*:*"],
    scannedAt: "2026-03-20T12:30:00.000Z",
    faviconUrl: "https://tpss.coop/favicon.ico",
    screenshotUrl: "/api/v1/scans/scn_01J_target_tpss_previous/results/res_tpss_previous/screenshot",
  },
  {
    scanId: "scn_01J_target_vercel_latest",
    latestScanId: "scn_01J_target_vercel_latest",
    canonicalTargetId: "ctg_01J_target_vercel",
    normalizedTarget: "https://vercel.com",
    scanStatus: "completed",
    title: "Vercel: Build and deploy the best web experiences",
    technologies: ["Next.js", "React", "Vercel"],
    statusCode: 200,
    server: "Vercel",
    cdn: "Vercel Edge",
    wordpressPlugins: [],
    wordpressThemes: [],
    cpe: ["cpe:2.3:a:vercel:next.js:16.0.0:*:*:*:*:*:*:*"],
    scannedAt: "2026-03-22T08:30:00.000Z",
    faviconUrl: "https://vercel.com/favicon.ico",
    screenshotUrl: "/api/v1/scans/scn_01J_target_vercel_latest/results/res_vercel_latest/screenshot",
  },
  {
    scanId: "scn_01J_target_wp_latest",
    latestScanId: "scn_01J_target_wp_latest",
    canonicalTargetId: "ctg_01J_target_wordpress",
    normalizedTarget: "https://wordpress.org",
    scanStatus: "completed",
    title: "Blog Tool, Publishing Platform, and CMS",
    technologies: ["WordPress", "PHP", "MySQL"],
    statusCode: 200,
    server: "nginx",
    cdn: null,
    wordpressPlugins: ["jetpack", "akismet", "yoast-seo"],
    wordpressThemes: ["twentytwentyfour"],
    cpe: ["cpe:2.3:a:wordpress:wordpress:6.5.0:*:*:*:*:*:*:*"],
    scannedAt: "2026-03-21T09:15:00.000Z",
    faviconUrl: "https://wordpress.org/favicon.ico",
    screenshotUrl: "/api/v1/scans/scn_01J_target_wp_latest/results/res_wp_latest/screenshot",
  },
  {
    scanId: "scn_01J_target_login_latest",
    latestScanId: "scn_01J_target_login_latest",
    canonicalTargetId: "ctg_01J_target_login",
    normalizedTarget: "https://login.acme.test",
    scanStatus: "completed",
    title: "Acme Login",
    technologies: ["Astro", "Tailwind CSS"],
    statusCode: 404,
    server: "cloudflare",
    cdn: "Cloudflare",
    wordpressPlugins: [],
    wordpressThemes: [],
    cpe: ["cpe:2.3:a:cloudflare:cloudflare:*:*:*:*:*:*:*:*"],
    scannedAt: "2026-03-18T11:00:00.000Z",
    faviconUrl: null,
    screenshotUrl: null,
  },
  {
    scanId: "scn_01J_target_queue_failed",
    latestScanId: "scn_01J_target_queue_failed",
    canonicalTargetId: "ctg_01J_target_queue",
    normalizedTarget: "https://queue.example.com",
    scanStatus: "failed",
    title: "Queue Worker Control Plane",
    technologies: ["BullMQ", "Redis"],
    statusCode: 503,
    server: "nginx",
    cdn: "Cloudflare",
    wordpressPlugins: [],
    wordpressThemes: [],
    cpe: [],
    scannedAt: "2026-03-23T15:00:00.000Z",
    faviconUrl: null,
    screenshotUrl: null,
  },
] as const

type TargetResultsResponse = Awaited<ReturnType<typeof targetResultsResponseSchema.parse>>
type TargetFilterOptionsResponse = Awaited<ReturnType<typeof targetFilterOptionsResponseSchema.parse>>

function normalizeTargetToken(value: string): string {
  return value.trim().toLowerCase()
}

function formatSlugLabel(value: string): string {
  const specialWords = new Map([
    ["cdn", "CDN"],
    ["css", "CSS"],
    ["http", "HTTP"],
    ["js", "JS"],
    ["seo", "SEO"],
    ["ssl", "SSL"],
    ["woocommerce", "WooCommerce"],
    ["wordpress", "WordPress"],
  ])

  return value
    .split(/[-_\s]+/u)
    .flatMap((part) => part ? [part] : [])
    .map((part) => specialWords.get(part.toLowerCase()) ?? `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}

function formatTechnologyFilterLabel(value: string): string {
  const labelsByValue = new Map([
    ["jetpack", "Jetpack"],
    ["storefront", "Storefront"],
    ["twentytwentyfour", "Twenty Twenty-Four"],
  ])
  const trimmedValue = value.trim()

  return labelsByValue.get(normalizeTargetToken(trimmedValue))
    ?? (/[-_]/u.test(trimmedValue) ? formatSlugLabel(trimmedValue) : trimmedValue)
}

function addFilterOptionValue(
  countsByValue: Map<string, { label: string; count: number }>,
  rawValue: string | number | null | undefined,
  labelOverride?: string,
) {
  if (rawValue === null || rawValue === undefined) {
    return
  }

  const rawLabel = String(rawValue).trim()
  const label = (labelOverride ?? rawLabel).trim()
  const value = normalizeTargetToken(rawLabel)

  if (!rawLabel || !label || !value) {
    return
  }

  const existing = countsByValue.get(value)

  if (existing) {
    existing.count += 1
    return
  }

  countsByValue.set(value, {
    label,
    count: 1,
  })
}

function addUniqueFilterOptionValues(
  countsByValue: Map<string, { label: string; count: number }>,
  rawValues: readonly string[],
  formatLabel?: (value: string) => string,
) {
  const seen = new Set<string>()

  for (const rawValue of rawValues) {
    const value = normalizeTargetToken(rawValue)

    if (!value || seen.has(value)) {
      continue
    }

    seen.add(value)
    addFilterOptionValue(countsByValue, rawValue, formatLabel?.(rawValue))
  }
}

function buildFilterOptionItems(countsByValue: Map<string, { label: string; count: number }>) {
  return [...countsByValue.entries()]
    .toSorted(([, left], [, right]) => {
      const countDifference = right.count - left.count

      if (countDifference !== 0) {
        return countDifference
      }

      return left.label.localeCompare(right.label)
    })
    .map(([value, item]) => ({
      label: item.label,
      value,
      matchCount: item.count,
    }))
}

function buildTargetResultItemFromDocument(document: TargetDocument) {
  return targetResultsResponseSchema.shape.items.element.parse({
    canonicalTargetId: document.canonicalTargetId,
    normalizedTarget: document.normalizedTarget,
    latestScanId: document.latestScanId,
    title: document.title,
    technologies: [...document.technologies],
    lastScannedAt: document.scannedAt,
    faviconUrl: document.faviconUrl,
    screenshotUrl: document.screenshotUrl,
  })
}

function getTargetDocumentTimestamp(document: TargetDocument): number {
  return new Date(document.scannedAt).getTime()
}

function compareTargetDocuments(left: TargetDocument, right: TargetDocument): number {
  const timestampDifference = getTargetDocumentTimestamp(right) - getTargetDocumentTimestamp(left)

  if (timestampDifference !== 0) {
    return timestampDifference
  }

  const targetDifference = left.normalizedTarget.localeCompare(right.normalizedTarget)

  if (targetDifference !== 0) {
    return targetDifference
  }

  return left.scanId.localeCompare(right.scanId)
}

function getCompletedTargetDocuments(documents: readonly TargetDocument[]): TargetDocument[] {
  return documents
    .filter((document) => document.scanStatus === "completed")
    .sort(compareTargetDocuments)
}

function getLatestSuccessfulTargetDocuments(documents: readonly TargetDocument[]): TargetDocument[] {
  const latestDocumentsByTarget = new Map<string, TargetDocument>()

  for (const document of getCompletedTargetDocuments(documents)) {
    if (!latestDocumentsByTarget.has(document.canonicalTargetId)) {
      latestDocumentsByTarget.set(document.canonicalTargetId, document)
    }
  }

  return [...latestDocumentsByTarget.values()].toSorted(compareTargetDocuments)
}

function matchesTargetTokenList(values: readonly string[], filters: readonly string[]): boolean {
  if (filters.length === 0) {
    return true
  }

  const normalizedValues = values.map(normalizeTargetToken)

  return filters.some((filter) => normalizedValues.includes(filter))
}

function matchesTargetSubstring(value: string | null, filters: readonly string[]): boolean {
  if (filters.length === 0) {
    return true
  }

  const normalizedValue = normalizeTargetToken(value ?? "")

  return filters.some((filter) => normalizedValue.includes(filter))
}

function matchesTargetCpe(document: TargetDocument, filters: readonly string[]): boolean {
  if (filters.length === 0) {
    return true
  }

  const normalizedCpeValues = document.cpe.map((value) => normalizeTargetToken(value))

  return filters.some((filter) => normalizedCpeValues.some((cpeValue) => cpeValue.includes(filter)))
}

function matchesTargetDateRange(document: TargetDocument, query: TargetQuery): boolean {
  const scannedAtTimestamp = getTargetDocumentTimestamp(document)

  if (query.from) {
    const fromTimestamp = new Date(query.from).getTime()

    if (scannedAtTimestamp < fromTimestamp) {
      return false
    }
  }

  if (query.to) {
    const toTimestamp = new Date(query.to).getTime()

    if (scannedAtTimestamp > toTimestamp) {
      return false
    }
  }

  return true
}

function matchesTargetQuery(document: TargetDocument, query: TargetQuery): boolean {
  if (query.q) {
    const searchableText = [
      document.normalizedTarget,
      document.title,
      ...document.technologies,
      document.server ?? "",
      document.cdn ?? "",
      ...document.wordpressPlugins,
      ...document.wordpressThemes,
      ...document.cpe,
      String(document.statusCode),
    ]
      .join(" ")
      .toLowerCase()

    if (!searchableText.includes(query.q)) {
      return false
    }
  }

  if (
    !matchesTargetTokenList(document.technologies, query.technology)
    && !matchesTargetTokenList(document.wordpressPlugins, query.technology)
  ) {
    return false
  }

  if (!matchesTargetSubstring(document.cdn, query.cdn)) {
    return false
  }

  if (!matchesTargetSubstring(document.server, query.server)) {
    return false
  }

  if (!matchesTargetTokenList(document.wordpressPlugins, query.plugin)) {
    return false
  }

  if (!matchesTargetTokenList(document.wordpressThemes, query.theme)) {
    return false
  }

  if (!matchesTargetCpe(document, query.cpe)) {
    return false
  }

  if (query.statusCode.length > 0 && !query.statusCode.includes(document.statusCode)) {
    return false
  }

  return matchesTargetDateRange(document, query)
}

export function getMockTargetResults(searchParams?: TargetParamsInput): TargetResultsResponse {
  const query = parseTargetQuery(searchParams)
  const baseDocuments = getLatestSuccessfulTargetDocuments(mockTargetDocuments)

  const filteredItems = baseDocuments.flatMap((document) => {
    return matchesTargetQuery(document, query) ? [buildTargetResultItemFromDocument(document)] : []
  })
  const cursorOffset = query.cursor ? Number.parseInt(query.cursor, 10) : 0
  const startOffset = Number.isInteger(cursorOffset) && cursorOffset >= 0 ? cursorOffset : 0
  const endOffset = startOffset + query.limit
  const items = filteredItems.slice(startOffset, endOffset)
  const nextCursor = endOffset < filteredItems.length
    ? String(endOffset)
    : null

  return targetResultsResponseSchema.parse({
    items,
    nextCursor,
  })
}

export function getMockTargetFilterOptions(): TargetFilterOptionsResponse {
  const latestDocuments = getLatestSuccessfulTargetDocuments(mockTargetDocuments)
  const technology = new Map<string, { label: string; count: number }>()
  const cdn = new Map<string, { label: string; count: number }>()
  const server = new Map<string, { label: string; count: number }>()
  const plugin = new Map<string, { label: string; count: number }>()
  const theme = new Map<string, { label: string; count: number }>()
  const cpe = new Map<string, { label: string; count: number }>()
  const statusCode = new Map<string, { label: string; count: number }>()

  for (const document of latestDocuments) {
    addUniqueFilterOptionValues(technology, [...document.technologies, ...document.wordpressPlugins], formatTechnologyFilterLabel)
    addFilterOptionValue(cdn, document.cdn)
    addFilterOptionValue(server, document.server)
    addUniqueFilterOptionValues(plugin, document.wordpressPlugins, formatTechnologyFilterLabel)
    addUniqueFilterOptionValues(theme, document.wordpressThemes, formatTechnologyFilterLabel)
    addUniqueFilterOptionValues(cpe, document.cpe)
    addFilterOptionValue(statusCode, document.statusCode)
  }

  return targetFilterOptionsResponseSchema.parse({
    technology: buildFilterOptionItems(technology),
    cdn: buildFilterOptionItems(cdn),
    server: buildFilterOptionItems(server),
    plugin: buildFilterOptionItems(plugin),
    theme: buildFilterOptionItems(theme),
    cpe: buildFilterOptionItems(cpe),
    statusCode: buildFilterOptionItems(statusCode),
  })
}
