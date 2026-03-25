import { searchResultsResponseSchema } from "@/lib/contracts/search";
import type { ActorContext } from "@/lib/server/actor-context";
import { listCompletedResultSnapshots, type CompletedResultSnapshot } from "@/lib/server/scans/read-service";

export type SearchParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

export type SearchMode = "latest" | "snapshots";

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
  return mode === "snapshots" ? "snapshots" : "latest";
}

function getSnapshotTimestamp(snapshot: CompletedResultSnapshot): number {
  return new Date(snapshot.completedAt).getTime();
}

function compareSnapshots(left: CompletedResultSnapshot, right: CompletedResultSnapshot): number {
  const timestampDifference = getSnapshotTimestamp(right) - getSnapshotTimestamp(left);

  if (timestampDifference !== 0) {
    return timestampDifference;
  }

  const targetDifference = left.normalizedTarget.localeCompare(right.normalizedTarget);

  if (targetDifference !== 0) {
    return targetDifference;
  }

  return left.scanId.localeCompare(right.scanId);
}

function getLatestSnapshots(snapshots: readonly CompletedResultSnapshot[]) {
  const latestByTarget = new Map<string, CompletedResultSnapshot>();

  for (const snapshot of [...snapshots].sort(compareSnapshots)) {
    if (!latestByTarget.has(snapshot.canonicalTargetId)) {
      latestByTarget.set(snapshot.canonicalTargetId, snapshot);
    }
  }

  return [...latestByTarget.values()].sort(compareSnapshots);
}

function matchesTokenList(values: readonly string[], filters: readonly string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  const normalizedValues = values.map(normalizeSearchToken);

  return filters.some((filter) => normalizedValues.includes(filter));
}

function matchesSubstring(value: string | null, filters: readonly string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  const normalizedValue = normalizeSearchToken(value ?? "");

  return filters.some((filter) => normalizedValue.includes(filter));
}

function matchesCpe(snapshot: CompletedResultSnapshot, filters: readonly string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  const normalizedCpeValues = snapshot.cpe.map(normalizeSearchToken);

  return filters.some((filter) => normalizedCpeValues.some((cpe) => cpe.includes(filter)));
}

function matchesDateRange(snapshot: CompletedResultSnapshot, query: SearchQuery): boolean {
  const timestamp = getSnapshotTimestamp(snapshot);

  if (query.from && timestamp < new Date(query.from).getTime()) {
    return false;
  }

  if (query.to && timestamp > new Date(query.to).getTime()) {
    return false;
  }

  return true;
}

function matchesQuery(snapshot: CompletedResultSnapshot, query: SearchQuery): boolean {
  if (query.q) {
    const searchableText = [
      snapshot.normalizedTarget,
      snapshot.title,
      ...snapshot.technologies,
      snapshot.server ?? "",
      snapshot.cdn ?? "",
      ...snapshot.wordpressPlugins,
      ...snapshot.wordpressThemes,
      ...snapshot.cpe,
      String(snapshot.statusCode),
    ]
      .join(" ")
      .toLowerCase();

    if (!searchableText.includes(query.q)) {
      return false;
    }
  }

  if (!matchesTokenList(snapshot.technologies, query.technology)) {
    return false;
  }

  if (!matchesSubstring(snapshot.cdn, query.cdn)) {
    return false;
  }

  if (!matchesSubstring(snapshot.server, query.server)) {
    return false;
  }

  if (!matchesTokenList(snapshot.wordpressPlugins, query.plugin)) {
    return false;
  }

  if (!matchesTokenList(snapshot.wordpressThemes, query.theme)) {
    return false;
  }

  if (!matchesCpe(snapshot, query.cpe)) {
    return false;
  }

  if (query.statusCode.length > 0 && !query.statusCode.includes(snapshot.statusCode)) {
    return false;
  }

  return matchesDateRange(snapshot, query);
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

export async function getSearchResults(actor: ActorContext, searchParams?: SearchParamsInput) {
  const query = parseSearchQuery(searchParams);
  const snapshots = await listCompletedResultSnapshots(actor);
  const latestScanIdByTarget = new Map(getLatestSnapshots(snapshots).map((snapshot) => [snapshot.canonicalTargetId, snapshot.scanId]));
  const baseSnapshots = query.mode === "snapshots" ? [...snapshots].sort(compareSnapshots) : getLatestSnapshots(snapshots);
  const filtered = baseSnapshots.filter((snapshot) => matchesQuery(snapshot, query));
  const cursorOffset = query.cursor ? Number.parseInt(query.cursor, 10) : 0;
  const startOffset = Number.isInteger(cursorOffset) && cursorOffset >= 0 ? cursorOffset : 0;
  const endOffset = query.limit ? startOffset + query.limit : undefined;
  const items = filtered.slice(startOffset, endOffset).map((snapshot) => ({
    canonicalTargetId: snapshot.canonicalTargetId,
    normalizedTarget: snapshot.normalizedTarget,
    latestScanId: latestScanIdByTarget.get(snapshot.canonicalTargetId) ?? snapshot.scanId,
    title: snapshot.title,
    technologies: snapshot.technologies,
    lastScannedAt: snapshot.completedAt,
  }));
  const nextCursor = query.limit && endOffset !== undefined && endOffset < filtered.length ? String(endOffset) : null;

  return searchResultsResponseSchema.parse({
    items,
    nextCursor,
  });
}
