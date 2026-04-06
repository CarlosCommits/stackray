import { targetResultsResponseSchema } from "@/lib/contracts/targets";
import type { ActorContext } from "@/lib/session/actor-context";
import { listCompletedResultSnapshots, type CompletedResultSnapshot } from "@/lib/server/scans/read-service";
import { parseTargetQuery, type TargetParamsInput, type TargetQuery } from "@/lib/targets/shared";

function normalizeTargetToken(value: string): string {
  return value.trim().toLowerCase();
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

  const normalizedValues = values.map(normalizeTargetToken);

  return filters.some((filter) => normalizedValues.includes(filter));
}

function matchesSubstring(value: string | null, filters: readonly string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  const normalizedValue = normalizeTargetToken(value ?? "");

  return filters.some((filter) => normalizedValue.includes(filter));
}

function matchesCpe(snapshot: CompletedResultSnapshot, filters: readonly string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  const normalizedCpeValues = snapshot.cpe.map(normalizeTargetToken);

  return filters.some((filter) => normalizedCpeValues.some((cpe) => cpe.includes(filter)));
}

function matchesDateRange(snapshot: CompletedResultSnapshot, query: TargetQuery): boolean {
  const timestamp = getSnapshotTimestamp(snapshot);

  if (query.from && timestamp < new Date(query.from).getTime()) {
    return false;
  }

  if (query.to && timestamp > new Date(query.to).getTime()) {
    return false;
  }

  return true;
}

function matchesQuery(snapshot: CompletedResultSnapshot, query: TargetQuery): boolean {
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

  if (
    !matchesTokenList(snapshot.technologies, query.technology)
    && !matchesTokenList(snapshot.wordpressPlugins, query.technology)
  ) {
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

export async function getTargetResults(actor: ActorContext, searchParams?: TargetParamsInput) {
  void actor;
  const query = parseTargetQuery(searchParams);
  const snapshots = await listCompletedResultSnapshots();
  const latestSnapshots = getLatestSnapshots(snapshots);
  const latestScanIdByTarget = new Map(latestSnapshots.map((snapshot) => [snapshot.canonicalTargetId, snapshot.scanId]));
  const filtered = latestSnapshots.filter((snapshot) => matchesQuery(snapshot, query));
  const cursorOffset = query.cursor ? Number.parseInt(query.cursor, 10) : 0;
  const startOffset = Number.isInteger(cursorOffset) && cursorOffset >= 0 ? cursorOffset : 0;
  const endOffset = startOffset + query.limit;
  const items = filtered.slice(startOffset, endOffset).map((snapshot) => ({
    canonicalTargetId: snapshot.canonicalTargetId,
    normalizedTarget: snapshot.normalizedTarget,
    latestScanId: latestScanIdByTarget.get(snapshot.canonicalTargetId) ?? snapshot.scanId,
    title: snapshot.title,
    technologies: snapshot.technologies,
    lastScannedAt: snapshot.completedAt,
    faviconUrl: snapshot.faviconUrl,
  }));
  const nextCursor = endOffset < filtered.length ? String(endOffset) : null;

  return targetResultsResponseSchema.parse({
    items,
    nextCursor,
  });
}
