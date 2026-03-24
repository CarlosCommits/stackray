import { z } from "zod";

import {
  searchModeSchema,
  searchResultItemSchema,
  searchResultsResponseSchema,
  type SearchResultItem,
} from "@/lib/contracts/search";

const SEARCH_MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

type SearchMode = z.infer<typeof searchModeSchema>;
type SearchResultsResponse = z.infer<typeof searchResultsResponseSchema>;

export const SEARCH_LATEST_SCAN_LINK_LABEL = "Open latest scan";

export interface SearchRowLastScannedAt {
  iso: SearchResultItem["lastScannedAt"];
  label: string;
}

export interface SearchRowLatestScan {
  scanId: SearchResultItem["latestScanId"];
  href: string;
  label: string;
  ariaLabel: string;
}

export interface SearchRow {
  canonicalTargetId: SearchResultItem["canonicalTargetId"];
  target: SearchResultItem["normalizedTarget"];
  title: SearchResultItem["title"];
  technologies: SearchResultItem["technologies"];
  lastScannedAt: SearchRowLastScannedAt;
  latestScan: SearchRowLatestScan;
}

export function getSearchScanDetailHref(scanId: string): string {
  return `/scans/${scanId}`;
}

export type SearchParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

export interface SearchQuery {
  q: string | null;
  technology: string[];
  cdn: string[];
  server: string[];
  plugin: string[];
  theme: string[];
  cpe: string[];
  statusCode: number[];
  from: string | null;
  to: string | null;
  cursor: string | null;
  limit: number | null;
  mode: SearchMode;
}

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

function normalizeSearchToken(value: string): string {
  return value.trim().toLowerCase();
}

function splitSearchParamValue(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function isSearchParamsRecord(
  searchParams: SearchParamsInput,
): searchParams is Record<string, string | string[] | undefined> {
  return !(searchParams instanceof URLSearchParams);
}

function getSearchParamValues(searchParams: SearchParamsInput | undefined, key: string): string[] {
  if (!searchParams) {
    return [];
  }

  if (isSearchParamsRecord(searchParams)) {
    const value = searchParams[key];

    if (typeof value === "string") {
      return splitSearchParamValue(value);
    }

    if (Array.isArray(value)) {
      return value.flatMap((item) => splitSearchParamValue(item));
    }

    return [];
  }

  return searchParams.getAll(key).flatMap((value) => splitSearchParamValue(value));
}

function getSingleSearchParam(searchParams: SearchParamsInput | undefined, key: string): string | null {
  const values = getSearchParamValues(searchParams, key);

  return values[0] ?? null;
}

function parseSearchTokenList(searchParams: SearchParamsInput | undefined, key: string): string[] {
  const normalizedValues = getSearchParamValues(searchParams, key).map(normalizeSearchToken);

  return [...new Set(normalizedValues.filter((value) => value.length > 0))];
}

function parseSearchStatusCodes(searchParams: SearchParamsInput | undefined): number[] {
  const parsedCodes = getSearchParamValues(searchParams, "statusCode")
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value));

  return [...new Set(parsedCodes)];
}

function parseSearchLimit(searchParams: SearchParamsInput | undefined): number | null {
  const limit = getSingleSearchParam(searchParams, "limit");

  if (!limit) {
    return null;
  }

  const parsedLimit = Number.parseInt(limit, 10);

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return null;
  }

  return parsedLimit;
}

function parseSearchCursor(searchParams: SearchParamsInput | undefined): string | null {
  const cursor = getSingleSearchParam(searchParams, "cursor");

  return cursor?.trim() || null;
}

function parseSearchDateBoundary(value: string | null, boundary: "from" | "to"): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmedValue);
  const parsedDate = new Date(
    isDateOnly
      ? `${trimmedValue}T${boundary === "from" ? "00:00:00.000" : "23:59:59.999"}Z`
      : trimmedValue,
  );

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

function parseSearchMode(mode: string | null): SearchMode {
  const parsedMode = searchModeSchema.safeParse(mode);

  return parsedMode.success ? parsedMode.data : "latest";
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

  const normalizedCpeValues = document.cpe.map(normalizeSearchToken);

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

function formatSearchLastScannedAtLabel(scannedAtIso: string): string {
  const scannedAt = new Date(scannedAtIso);

  if (Number.isNaN(scannedAt.getTime())) {
    return "--";
  }

  const month = SEARCH_MONTH_LABELS[scannedAt.getUTCMonth()];
  const day = scannedAt.getUTCDate();
  const year = scannedAt.getUTCFullYear();
  const hours = scannedAt.getUTCHours();
  const minutes = scannedAt.getUTCMinutes().toString().padStart(2, "0");
  const meridiem = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 || 12;

  return `${month} ${day}, ${year}, ${twelveHour}:${minutes} ${meridiem} UTC`;
}

export function parseSearchQuery(searchParams?: SearchParamsInput): SearchQuery {
  return {
    q: (() => {
      const rawQuery = getSingleSearchParam(searchParams, "q");

      if (!rawQuery) {
        return null;
      }

      const normalizedQuery = normalizeSearchToken(rawQuery);

      return normalizedQuery || null;
    })(),
    technology: parseSearchTokenList(searchParams, "technology"),
    cdn: parseSearchTokenList(searchParams, "cdn"),
    server: parseSearchTokenList(searchParams, "server"),
    plugin: parseSearchTokenList(searchParams, "plugin"),
    theme: parseSearchTokenList(searchParams, "theme"),
    cpe: parseSearchTokenList(searchParams, "cpe"),
    statusCode: parseSearchStatusCodes(searchParams),
    from: parseSearchDateBoundary(getSingleSearchParam(searchParams, "from"), "from"),
    to: parseSearchDateBoundary(getSingleSearchParam(searchParams, "to"), "to"),
    cursor: parseSearchCursor(searchParams),
    limit: parseSearchLimit(searchParams),
    mode: parseSearchMode(getSingleSearchParam(searchParams, "mode")),
  };
}

export function buildSearchResultItem(document: SearchDocument): SearchResultItem {
  return searchResultItemSchema.parse({
    canonicalTargetId: document.canonicalTargetId,
    normalizedTarget: document.normalizedTarget,
    latestScanId: document.latestScanId,
    title: document.title,
    technologies: [...document.technologies],
    lastScannedAt: document.scannedAt,
  });
}

export function buildSearchRow(item: SearchResultItem): SearchRow {
  return {
    canonicalTargetId: item.canonicalTargetId,
    target: item.normalizedTarget,
    title: item.title,
    technologies: [...item.technologies],
    lastScannedAt: {
      iso: item.lastScannedAt,
      label: formatSearchLastScannedAtLabel(item.lastScannedAt),
    },
    latestScan: {
      scanId: item.latestScanId,
      href: getSearchScanDetailHref(item.latestScanId),
      label: SEARCH_LATEST_SCAN_LINK_LABEL,
      ariaLabel: `${SEARCH_LATEST_SCAN_LINK_LABEL} for ${item.normalizedTarget}`,
    },
  };
}

export function buildSearchRows(items: readonly SearchResultItem[]): SearchRow[] {
  return items.map((item) => buildSearchRow(item));
}

export function getSearchResults(searchParams?: SearchParamsInput): SearchResultsResponse {
  const query = parseSearchQuery(searchParams);
  const baseDocuments =
    query.mode === "snapshots"
      ? getCompletedSearchDocuments(mockSearchDocuments)
      : getLatestSuccessfulSearchDocuments(mockSearchDocuments);

  const filteredItems = baseDocuments.filter((document) => matchesSearchQuery(document, query)).map(buildSearchResultItem);
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
  const query = parseSearchQuery(searchParams);
  const response = getSearchResults(searchParams);

  return {
    query,
    rows: buildSearchRows(response.items),
  };
}
