import { requireAppSession } from "@/lib/auth/session";
import { searchResultsResponseSchema } from "@/lib/contracts/search";
import { getWorkspaceSearchResults } from "@/lib/server/search/service";
import {
  buildSearchRow,
  buildSearchRows,
  parseSearchQuery,
  type SearchParamsInput,
  type SearchQuery,
  type SearchRow,
} from "@/lib/search/shared";

export interface SearchPageData {
  query: SearchQuery;
  rows: SearchRow[];
}

interface SearchDocument {
  scanId: string;
  latestScanId: string;
  canonicalTargetId: string;
  normalizedTarget: string;
  scanStatus: "completed" | "failed" | "cancelled";
  title: string;
  technologies: string[];
  statusCode: number;
  server: string | null;
  cdn: string | null;
  wordpressPlugins: string[];
  wordpressThemes: string[];
  cpe: string[];
  scannedAt: string;
}

const mockSearchDocuments: readonly SearchDocument[] = [
  {
    scanId: "scn_01J_search_tpss_latest",
    latestScanId: "scn_01J_search_tpss_latest",
    canonicalTargetId: "ctg_01J_search_tpss",
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
  },
  {
    scanId: "scn_01J_search_tpss_previous",
    latestScanId: "scn_01J_search_tpss_latest",
    canonicalTargetId: "ctg_01J_search_tpss",
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
  },
  {
    scanId: "scn_01J_search_vercel_latest",
    latestScanId: "scn_01J_search_vercel_latest",
    canonicalTargetId: "ctg_01J_search_vercel",
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
  },
  {
    scanId: "scn_01J_search_wp_latest",
    latestScanId: "scn_01J_search_wp_latest",
    canonicalTargetId: "ctg_01J_search_wordpress",
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
  },
  {
    scanId: "scn_01J_search_login_latest",
    latestScanId: "scn_01J_search_login_latest",
    canonicalTargetId: "ctg_01J_search_login",
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
  },
  {
    scanId: "scn_01J_search_queue_failed",
    latestScanId: "scn_01J_search_queue_failed",
    canonicalTargetId: "ctg_01J_search_queue",
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
  },
] as const;

type SearchResultsResponse = Awaited<ReturnType<typeof getWorkspaceSearchResults>>;

function normalizeSearchToken(value: string): string {
  return value.trim().toLowerCase();
}

function buildSearchResultItemFromDocument(document: SearchDocument) {
  return searchResultsResponseSchema.shape.items.element.parse({
    canonicalTargetId: document.canonicalTargetId,
    normalizedTarget: document.normalizedTarget,
    latestScanId: document.latestScanId,
    title: document.title,
    technologies: [...document.technologies],
    lastScannedAt: document.scannedAt,
  });
}

function getSearchDocumentTimestamp(document: SearchDocument): number {
  return new Date(document.scannedAt).getTime();
}

function compareSearchDocuments(left: SearchDocument, right: SearchDocument): number {
  const timestampDifference = getSearchDocumentTimestamp(right) - getSearchDocumentTimestamp(left);

  if (timestampDifference !== 0) {
    return timestampDifference;
  }

  const targetDifference = left.normalizedTarget.localeCompare(right.normalizedTarget);

  if (targetDifference !== 0) {
    return targetDifference;
  }

  return left.scanId.localeCompare(right.scanId);
}

function getCompletedSearchDocuments(documents: readonly SearchDocument[]): SearchDocument[] {
  return documents
    .filter((document) => document.scanStatus === "completed")
    .sort(compareSearchDocuments);
}

function getLatestSuccessfulSearchDocuments(documents: readonly SearchDocument[]): SearchDocument[] {
  const latestDocumentsByTarget = new Map<string, SearchDocument>();

  for (const document of getCompletedSearchDocuments(documents)) {
    if (!latestDocumentsByTarget.has(document.canonicalTargetId)) {
      latestDocumentsByTarget.set(document.canonicalTargetId, document);
    }
  }

  return [...latestDocumentsByTarget.values()].sort(compareSearchDocuments);
}

function matchesSearchTokenList(values: readonly string[], filters: readonly string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  const normalizedValues = values.map(normalizeSearchToken);

  return filters.some((filter) => normalizedValues.includes(filter));
}

function matchesSearchSubstring(value: string | null, filters: readonly string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  const normalizedValue = normalizeSearchToken(value ?? "");

  return filters.some((filter) => normalizedValue.includes(filter));
}

function matchesSearchCpe(document: SearchDocument, filters: readonly string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  const normalizedCpeValues = document.cpe.map((value) => normalizeSearchToken(value));

  return filters.some((filter) => normalizedCpeValues.some((cpeValue) => cpeValue.includes(filter)));
}

function matchesSearchDateRange(document: SearchDocument, query: SearchQuery): boolean {
  const scannedAtTimestamp = getSearchDocumentTimestamp(document);

  if (query.from) {
    const fromTimestamp = new Date(query.from).getTime();

    if (scannedAtTimestamp < fromTimestamp) {
      return false;
    }
  }

  if (query.to) {
    const toTimestamp = new Date(query.to).getTime();

    if (scannedAtTimestamp > toTimestamp) {
      return false;
    }
  }

  return true;
}

function matchesSearchQuery(document: SearchDocument, query: SearchQuery): boolean {
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
      .toLowerCase();

    if (!searchableText.includes(query.q)) {
      return false;
    }
  }

  if (!matchesSearchTokenList(document.technologies, query.technology)) {
    return false;
  }

  if (!matchesSearchSubstring(document.cdn, query.cdn)) {
    return false;
  }

  if (!matchesSearchSubstring(document.server, query.server)) {
    return false;
  }

  if (!matchesSearchTokenList(document.wordpressPlugins, query.plugin)) {
    return false;
  }

  if (!matchesSearchTokenList(document.wordpressThemes, query.theme)) {
    return false;
  }

  if (!matchesSearchCpe(document, query.cpe)) {
    return false;
  }

  if (query.statusCode.length > 0 && !query.statusCode.includes(document.statusCode)) {
    return false;
  }

  return matchesSearchDateRange(document, query);
}

export { buildSearchRow, buildSearchRows, parseSearchQuery }

export function getSearchResults(searchParams?: SearchParamsInput): SearchResultsResponse {
  const query = parseSearchQuery(searchParams);
  const baseDocuments =
    query.mode === "snapshots"
      ? getCompletedSearchDocuments(mockSearchDocuments)
      : getLatestSuccessfulSearchDocuments(mockSearchDocuments);

  const filteredItems = baseDocuments
    .filter((document) => matchesSearchQuery(document, query))
    .map(buildSearchResultItemFromDocument);
  const cursorOffset = query.cursor ? Number.parseInt(query.cursor, 10) : 0;
  const startOffset = Number.isInteger(cursorOffset) && cursorOffset >= 0 ? cursorOffset : 0;
  const endOffset = query.limit ? startOffset + query.limit : undefined;
  const items = filteredItems.slice(startOffset, endOffset);
  const nextCursor = query.limit && endOffset !== undefined && endOffset < filteredItems.length
    ? String(endOffset)
    : null;

  return searchResultsResponseSchema.parse({
    items,
    nextCursor,
  });
}

export async function getSearchPageData(searchParams?: SearchParamsInput): Promise<SearchPageData> {
  const session = await requireAppSession();
  const query = parseSearchQuery(searchParams);
  const response = await getWorkspaceSearchResults(session, searchParams);

  return {
    query,
    rows: buildSearchRows(response.items),
  };
}
