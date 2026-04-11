import { targetResultsResponseSchema } from "@/lib/contracts/targets"
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
  },
] as const

type TargetResultsResponse = Awaited<ReturnType<typeof targetResultsResponseSchema.parse>>

function normalizeTargetToken(value: string): string {
  return value.trim().toLowerCase()
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

  return [...latestDocumentsByTarget.values()].sort(compareTargetDocuments)
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

  const filteredItems = baseDocuments
    .filter((document) => matchesTargetQuery(document, query))
    .map(buildTargetResultItemFromDocument)
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
