import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { RunsRow, RunsSourceValue, RunsStatusValue } from "@/components/runs/types";
import {
  RUNS_UNAVAILABLE_LABEL,
  deriveRunsDuration,
  formatRunsTargetCount,
  getRunsScanDetailHref,
  getRunsSourceLabel,
  getRunsStatusLabel,
  normalizeRunsStatus,
  summarizeRunsTopTechnologies,
} from "@/components/runs/types";
import {
  listRunsResponseSchema,
  runsListQuerySchema,
  type RunsListQuery,
  type RunsListResponse,
  type RunsSort,
} from "@/lib/contracts/runs";
import type { ScanListItem } from "@/lib/contracts/scans";
import { db } from "@/lib/db/client";
import { apiTokens, scans, users } from "@/lib/db/schema";
import type { RunsRowEnrichment } from "@/lib/queries/runs.types";
import { requireAppSession } from "@/lib/session/app-session";
import type { ActorContext } from "@/lib/session/actor-context";
import { getVisibleScansFilter } from "@/lib/server/scans/access";
import { listCompletedResultSnapshots } from "@/lib/server/scans/read-service";

type ScanRecord = typeof scans.$inferSelect;

const RUNS_MONTH_LABELS = [
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

export const RUNS_DEFAULT_PAGE_LIMIT = 50;

type RunsParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

interface RunsPageData {
  rows: RunsRow[];
  nextCursor: string | null;
}

function normalizeRunsSearchToken(value: string): string {
  return value.trim().toLowerCase();
}

function isRunsParamsRecord(
  searchParams: RunsParamsInput,
): searchParams is Record<string, string | string[] | undefined> {
  return !(searchParams instanceof URLSearchParams);
}

function getRunsParamValues(searchParams: RunsParamsInput | undefined, key: string): string[] {
  if (!searchParams) {
    return [];
  }

  if (isRunsParamsRecord(searchParams)) {
    const value = searchParams[key];

    if (typeof value === "string") {
      return [value];
    }

    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string");
    }

    return [];
  }

  return searchParams.getAll(key);
}

function getSingleRunsParam(searchParams: RunsParamsInput | undefined, key: string): string | null {
  return getRunsParamValues(searchParams, key)[0] ?? null;
}

function parseRunsQueryValue(searchParams: RunsParamsInput | undefined): string | null {
  const query = getSingleRunsParam(searchParams, "q");

  if (!query) {
    return null;
  }

  const normalizedQuery = normalizeRunsSearchToken(query);

  return normalizedQuery || null;
}

function parseRunsStatusFilter(searchParams: RunsParamsInput | undefined): RunsStatusValue | null {
  const status = getSingleRunsParam(searchParams, "status")?.trim();

  switch (status) {
    case "queued":
    case "running":
    case "completed":
    case "failed":
    case "cancelled":
      return status;
    default:
      return null;
  }
}

function parseRunsSourceFilter(searchParams: RunsParamsInput | undefined): RunsSourceValue | null {
  const source = getSingleRunsParam(searchParams, "source")?.trim();

  switch (source) {
    case "ui":
    case "cli":
    case "api":
    case "system":
      return source;
    default:
      return null;
  }
}

function parseRunsSort(searchParams: RunsParamsInput | undefined): RunsSort {
  return getSingleRunsParam(searchParams, "sort") === "oldest" ? "oldest" : "newest";
}

function parseRunsCursor(searchParams: RunsParamsInput | undefined): string | null {
  const cursor = getSingleRunsParam(searchParams, "cursor");

  return cursor?.trim() || null;
}

function parseRunsLimit(searchParams: RunsParamsInput | undefined): number {
  const limit = getSingleRunsParam(searchParams, "limit");

  if (!limit) {
    return RUNS_DEFAULT_PAGE_LIMIT;
  }

  const parsedLimit = Number.parseInt(limit, 10);

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return RUNS_DEFAULT_PAGE_LIMIT;
  }

  return parsedLimit;
}

function getRunsSubmittedAtTimestamp(row: RunsRow): number {
  const timestamp = new Date(row.submittedAt.iso).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getRawStatusesForRunsFilter(status: RunsStatusValue | null): ScanRecord["status"][] | null {
  switch (status) {
    case "queued":
      return ["pending", "queued"];
    case "running":
      return ["running", "processing"];
    case "completed":
      return ["completed"];
    case "failed":
      return ["failed"];
    case "cancelled":
      return ["cancelled"];
    default:
      return null;
  }
}

function compareRunsRows(left: RunsRow, right: RunsRow, sort: RunsSort): number {
  const timestampDifference = getRunsSubmittedAtTimestamp(left) - getRunsSubmittedAtTimestamp(right);

  if (timestampDifference !== 0) {
    return sort === "oldest" ? timestampDifference : -timestampDifference;
  }

  return sort === "oldest"
    ? left.scanId.localeCompare(right.scanId)
    : right.scanId.localeCompare(left.scanId);
}

function matchesRunsQuery(row: RunsRow, query: RunsListQuery): boolean {
  if (query.q) {
    const normalizedQuery = query.q;
    const matchesScanId = row.scanId.toLowerCase().includes(normalizedQuery);
    const matchesCreatedBy = row.createdBy.label.toLowerCase().includes(normalizedQuery);
    const matchesTechnologies = row.topTechnologies.searchTokens.some((technology) =>
      technology.toLowerCase().includes(normalizedQuery)
    );
    const matchesHiddenTargets = row.filters.hiddenTargets.some((target) => target.toLowerCase().includes(normalizedQuery));
    const matchesTargetUrls = row.targetUrls.some((url) => url.toLowerCase().includes(normalizedQuery));

    if (!matchesScanId && !matchesCreatedBy && !matchesTechnologies && !matchesHiddenTargets && !matchesTargetUrls) {
      return false;
    }
  }

  if (query.status && row.status.value !== query.status) {
    return false;
  }

  if (query.source && row.source.value !== query.source) {
    return false;
  }

  return true;
}

function formatRunsSubmittedAtLabel(submittedAtIso: string): string {
  const submittedAt = new Date(submittedAtIso);

  if (Number.isNaN(submittedAt.getTime())) {
    return RUNS_UNAVAILABLE_LABEL;
  }

  const month = RUNS_MONTH_LABELS[submittedAt.getUTCMonth()];
  const day = submittedAt.getUTCDate();
  const year = submittedAt.getUTCFullYear();
  const hours = submittedAt.getUTCHours();
  const minutes = submittedAt.getUTCMinutes().toString().padStart(2, "0");
  const meridiem = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 || 12;

  return `${month} ${day}, ${year}, ${twelveHour}:${minutes} ${meridiem}`;
}

function cloneRunsCreatedBy(createdBy: RunsRowEnrichment["createdBy"]): RunsRow["createdBy"] {
  return { ...createdBy };
}

function cloneOrderedValues(values: readonly string[]): string[] {
  return [...values];
}

export function parseRunsQuery(searchParams?: RunsParamsInput): RunsListQuery {
  return runsListQuerySchema.parse({
    q: parseRunsQueryValue(searchParams),
    status: parseRunsStatusFilter(searchParams),
    source: parseRunsSourceFilter(searchParams),
    sort: parseRunsSort(searchParams),
    cursor: parseRunsCursor(searchParams),
    limit: parseRunsLimit(searchParams),
  });
}

export function buildRunsRow(scan: ScanListItem, enrichment: RunsRowEnrichment, targetUrls: string[], faviconUrl: string | null): RunsRow {
  const normalizedStatus = normalizeRunsStatus(scan.status);
  const visibleTargetUrls = targetUrls.slice(0, 3);

  return {
    scanId: scan.scanId,
    href: getRunsScanDetailHref(scan.scanId),
    submittedAt: {
      iso: scan.submittedAt,
      label: formatRunsSubmittedAtLabel(scan.submittedAt),
    },
    targetCount: {
      value: targetUrls.length,
      label: formatRunsTargetCount(targetUrls.length),
    },
    targetUrls: visibleTargetUrls,
    hiddenTargetCount: Math.max(0, targetUrls.length - visibleTargetUrls.length),
    faviconUrl,
    status: {
      rawValue: scan.status,
      value: normalizedStatus,
      label: getRunsStatusLabel(normalizedStatus),
    },
    source: {
      value: scan.source,
      label: getRunsSourceLabel(scan.source),
    },
    createdBy: cloneRunsCreatedBy(enrichment.createdBy),
    duration: deriveRunsDuration(scan.submittedAt, scan.completedAt),
    topTechnologies: summarizeRunsTopTechnologies(cloneOrderedValues(enrichment.topTechnologies)),
    filters: {
      hiddenTargets: cloneOrderedValues(enrichment.hiddenTargets),
    },
  };
}

export function buildRunsRows(
  scans: readonly ScanListItem[],
  getEnrichment: (scanId: string) => RunsRowEnrichment,
  getTargets: (scanId: string) => string[],
  getFaviconUrl: (scanId: string, firstTargetUrl: string | null) => string | null,
): RunsRow[] {
  return scans.map((scan) => {
    const targets = getTargets(scan.scanId);
    return buildRunsRow(scan, getEnrichment(scan.scanId), targets, getFaviconUrl(scan.scanId, targets[0] ?? null));
  });
}

export function buildRunsListResponse(rows: readonly RunsRow[], searchParams?: RunsParamsInput): RunsListResponse {
  const query = parseRunsQuery(searchParams);
  const filteredRows = rows.filter((row) => matchesRunsQuery(row, query));
  const sortedRows = filteredRows.toSorted((left, right) => compareRunsRows(left, right, query.sort));
  const cursorOffset = query.cursor ? Number.parseInt(query.cursor, 10) : 0;
  const startOffset = Number.isInteger(cursorOffset) && cursorOffset >= 0 ? cursorOffset : 0;
  const endOffset = startOffset + query.limit;
  const items = sortedRows.slice(startOffset, endOffset);
  const nextCursor = endOffset < sortedRows.length ? String(endOffset) : null;

  return listRunsResponseSchema.parse({
    items,
    nextCursor,
  });
}

async function buildRunsRowsForScanRecords(actor: ActorContext, scanRows: readonly ScanRecord[]): Promise<RunsRow[]> {
  const scanIds = scanRows.map((scan) => scan.id);

  if (scanIds.length === 0) {
    return [];
  }

  const [targetRows, resultSnapshots] = await Promise.all([
    Promise.resolve(scanRows.map((scan) => ({ scanId: scan.id, normalizedTarget: scan.normalizedTarget }))),
    listCompletedResultSnapshots(actor, scanIds),
  ]);

  const userIds = new Set<string>();
  const tokenIds = new Set<string>();

  for (const scan of scanRows) {
    if (scan.createdByUserId) {
      userIds.add(scan.createdByUserId);
    }

    if (scan.createdByTokenId) {
      tokenIds.add(scan.createdByTokenId);
    }
  }

  const userIdList = [...userIds];
  const tokenIdList = [...tokenIds];
  const [userRows, tokenRows] = await Promise.all([
    userIdList.length > 0 ? db.select().from(users).where(inArray(users.id, userIdList)) : Promise.resolve([]),
    tokenIdList.length > 0 ? db.select().from(apiTokens).where(inArray(apiTokens.id, tokenIdList)) : Promise.resolve([]),
  ]);

  const userById = new Map(userRows.map((user) => [user.id, user]));
  const tokenById = new Map(tokenRows.map((token) => [token.id, token]));
  const targetsByScanId = new Map<string, string[]>();
  const technologiesByScanId = new Map<string, string[]>();
  const technologySetsByScanId = new Map<string, Set<string>>();
  const faviconByTarget = new Map<string, string | null>();

  for (const target of targetRows) {
    const existingTargets = targetsByScanId.get(target.scanId) ?? [];
    existingTargets.push(target.normalizedTarget);
    targetsByScanId.set(target.scanId, existingTargets);
  }

  for (const snapshot of resultSnapshots) {
    const existingTechnologies = technologiesByScanId.get(snapshot.scanId) ?? [];
    let existingTechnologySet = technologySetsByScanId.get(snapshot.scanId);

    if (!existingTechnologySet) {
      existingTechnologySet = new Set(existingTechnologies);
      technologySetsByScanId.set(snapshot.scanId, existingTechnologySet);
    }

    for (const technology of snapshot.technologies) {
      if (!existingTechnologySet.has(technology)) {
        existingTechnologySet.add(technology);
        existingTechnologies.push(technology);
      }
    }

    technologiesByScanId.set(snapshot.scanId, existingTechnologies);

    const key = `${snapshot.scanId}:${snapshot.normalizedTarget}`;
    if (!faviconByTarget.has(key)) {
      faviconByTarget.set(key, snapshot.faviconUrl);
    }
  }

  const enrichments = new Map<string, RunsRowEnrichment>(
    scanRows.map((scan) => {
      const user = scan.createdByUserId ? userById.get(scan.createdByUserId) : null;
      const token = scan.createdByTokenId ? tokenById.get(scan.createdByTokenId) : null;
      return [
        scan.id,
        {
          createdBy: token
            ? {
                label: token.name,
                kind: "token" as const,
                userId: user?.id ?? null,
                tokenId: token.id,
              }
            : user
              ? {
                  label: user.displayName ?? user.email,
                  kind: "user" as const,
                  userId: user.id,
                  tokenId: null,
                }
              : {
                  label: "Unknown actor",
                  kind: "unknown" as const,
                  userId: null,
                  tokenId: null,
                },
          hiddenTargets: targetsByScanId.get(scan.id) ?? [],
          topTechnologies: technologiesByScanId.get(scan.id) ?? [],
        } satisfies RunsRowEnrichment,
      ];
    }),
  );

  return buildRunsRows(
    scanRows.map((scan) => ({
      scanId: scan.id,
      status: scan.status,
      source: scan.source,
      target: scan.normalizedTarget,
      submittedAt: scan.submittedAt.toISOString(),
      completedAt: scan.completedAt?.toISOString() ?? null,
    })),
    (scanId) => enrichments.get(scanId) ?? {
      createdBy: {
        label: "Unknown actor",
        kind: "unknown",
        userId: null,
        tokenId: null,
      },
      hiddenTargets: [],
      topTechnologies: [],
    },
    (scanId) => targetsByScanId.get(scanId) ?? [],
    (scanId, firstTarget) => {
      if (!firstTarget) {
        return null;
      }

      const key = `${scanId}:${firstTarget}`;
      return faviconByTarget.get(key) ?? null;
    },
  );
}

async function getAllRunsRows(actor: ActorContext): Promise<RunsRow[]> {
  const visibleScansFilter = getVisibleScansFilter(actor);
  const scanRows = await db
    .select()
    .from(scans)
    .where(visibleScansFilter)
    .orderBy(desc(scans.submittedAt));

  return buildRunsRowsForScanRecords(actor, scanRows);
}

async function listRunsWithoutSearch(actor: ActorContext, query: RunsListQuery): Promise<RunsListResponse> {
  const normalizedStatuses = getRawStatusesForRunsFilter(query.status);
  const cursorOffset = query.cursor ? Number.parseInt(query.cursor, 10) : 0;
  const startOffset = Number.isInteger(cursorOffset) && cursorOffset >= 0 ? cursorOffset : 0;
  const orderByDirection = query.sort === "oldest" ? asc : desc;
  const visibleScansFilter = getVisibleScansFilter(actor);

  const scanRows = await db
    .select()
    .from(scans)
    .where(
      and(
        visibleScansFilter,
        normalizedStatuses ? inArray(scans.status, normalizedStatuses) : undefined,
        query.source ? eq(scans.source, query.source) : undefined,
      ),
    )
    .orderBy(orderByDirection(scans.submittedAt), orderByDirection(scans.id))
    .offset(startOffset)
    .limit(query.limit + 1);

  const hasMore = scanRows.length > query.limit;
  const visibleScanRows = hasMore ? scanRows.slice(0, query.limit) : scanRows;
  const items = await buildRunsRowsForScanRecords(actor, visibleScanRows);

  return listRunsResponseSchema.parse({
    items,
    nextCursor: hasMore ? String(startOffset + query.limit) : null,
  });
}

export async function listRuns(actor: ActorContext, searchParams?: RunsParamsInput): Promise<RunsListResponse> {
  const query = parseRunsQuery(searchParams);

  if (!query.q) {
    return listRunsWithoutSearch(actor, query);
  }

  const rows = await getAllRunsRows(actor);
  return buildRunsListResponse(rows, searchParams);
}

export async function getRunsPageData(searchParams?: RunsParamsInput): Promise<RunsPageData> {
  const session = await requireAppSession();
  const response = await listRuns(session, searchParams);

  return {
    rows: response.items,
    nextCursor: response.nextCursor,
  };
}
