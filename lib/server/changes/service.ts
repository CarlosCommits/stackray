import { createHash } from "node:crypto";
import { and, asc, desc, eq, exists, getTableColumns, ilike, inArray, lt, lte, ne, notInArray, or, sql } from "drizzle-orm";

import {
  changeCategorySchema,
  changeFeedResponseSchema,
  changeHistoryResponseSchema,
  scanComparisonResponseSchema,
  scanComparisonSchema,
  type ChangeCategory,
  type ChangeFeedQuery,
  type ChangeFeedResponse,
  type ChangeHistoryResponse,
  type ScanComparison,
  type ScanComparisonResponse,
  type UpdateMonitoringBaselineRequest,
} from "../../contracts/changes.ts";
import { db } from "../../db/client.ts";
import {
  ipEnrichments,
  scanAttempts,
  scanChangeItems,
  scanComparisons,
  scanResultDetections,
  scanResults,
  scans,
  targetMonitoringBaselineEvents,
  targetMonitoringSettings,
} from "../../db/schema.ts";
import type { ActorContext } from "../../session/actor-context.ts";
import { canManageBaselines } from "../../authorization/authz.ts";
import { CHANGE_FEED_PREVIEW_LIMIT, CHANGE_FEED_PREVIEW_MAX_LENGTH } from "../../changes/feed.ts";
import { getChangePreview } from "../../changes/change-preview.ts";
import { isRetiredChangeType, RETIRED_CHANGE_TYPES } from "../../changes/change-types.ts";
import { isIgnoredResponseHeader } from "../../changes/response-headers.ts";
import { getVisibleScansFilter } from "../scans/access.ts";
import { listCompletedResultFaviconUrls } from "../scans/favicon-read-service.ts";
import { formatDateOnlyInTimeZone, isValidTimeZone } from "../../time.ts";
import {
  collectChangedIpRecordAddresses,
  compareScanResults,
  SCAN_COMPARISON_ALGORITHM_VERSION,
  type ComparableIpNetworkIdentity,
  type ComparableScanResult,
  type ScanChangeItem as EngineChangeItem,
} from "./compare-scan-results.ts";
import { canonicalizeEndpoint, stableFingerprint } from "./canonicalization.ts";

const ALGORITHM_VERSION = Number.parseInt(SCAN_COMPARISON_ALGORITHM_VERSION, 10);
const BASELINE_OPTION_LIMIT = 25;
const CHANGE_FEED_MAX_LIMIT = 100;
const CHANGE_FEED_ITEM_LIMIT = 100;
const IP_IDENTITY_LOOKUP_LIMIT = 64;

export type EnsureIpNetworkIdentities = (addresses: readonly string[]) => Promise<void>;

type ScanRow = typeof scans.$inferSelect;
type ChangeItemRow = typeof scanChangeItems.$inferSelect;
type MappedChangeItemRow = Pick<
  ChangeItemRow,
  "id" | "comparisonId" | "itemKey" | "endpointIdentity" | "baselineResultId" | "currentResultId" | "category" | "changeType" | "fieldPath" | "summary" | "beforeJson" | "afterJson" | "alertEligible"
>;
type ComparisonRow = typeof scanComparisons.$inferSelect;

type LoadedSnapshot = {
  results: ComparableScanResult[];
  resultIdByEndpoint: Map<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readIpNetworkIdentity(row: typeof ipEnrichments.$inferSelect): ComparableIpNetworkIdentity | null {
  const rdap = isRecord(row.rdapJson) ? row.rdapJson : {};
  const bgp = isRecord(row.bgpJson) ? row.bgpJson : {};
  const entities = Array.isArray(rdap.entities) ? rdap.entities.filter(isRecord) : [];
  const registrant = entities.find((entity) =>
    Array.isArray(entity.roles) && entity.roles.some((role) => role === "registrant"),
  );
  const registrantHandle = nonEmptyString(registrant?.handle);
  const registrantName = nonEmptyString(registrant?.org) ?? nonEmptyString(registrant?.fn);
  const networkHandle = nonEmptyString(rdap.handle);
  const networkName = nonEmptyString(rdap.name);
  const providerName = nonEmptyString(row.providerName);
  const originAsn = nonEmptyString(bgp.asNumber) ?? nonEmptyString(bgp.as_number);
  const registrantId = registrantHandle ?? registrantName ?? networkHandle ?? networkName ?? providerName;

  return registrantId && originAsn
    ? {
        registrantId,
        registrantName: registrantName ?? networkName,
        providerName,
        originAsn,
      }
    : null;
}

async function loadIpNetworkIdentities(addresses: readonly string[]) {
  if (addresses.length === 0) {
    return new Map<string, ComparableIpNetworkIdentity>();
  }

  const rows = await db
    .select()
    .from(ipEnrichments)
    .where(inArray(ipEnrichments.ip, [...addresses]));

  return new Map(rows.flatMap((row) => {
    const identity = readIpNetworkIdentity(row);
    return identity ? [[row.ip, identity] as const] : [];
  }));
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.flatMap((entry) => typeof entry === "string" ? [entry] : []) : [];
}

function normalizeHeaderName(value: string) {
  return value.trim().toLowerCase().replaceAll("_", "-");
}

function changedHeaderNames(after: unknown) {
  if (!isRecord(after)) return [];

  if (after.mode === "classified" && isRecord(after.changesByDisposition)) {
    const names = Object.values(after.changesByDisposition).flatMap((changeGroup) => {
      if (!isRecord(changeGroup)) return [];
      return [
        ...stringArray(changeGroup.added),
        ...stringArray(changeGroup.removed),
        ...stringArray(changeGroup.changed),
      ];
    });

    return [...new Set(names.map(normalizeHeaderName))].filter(Boolean).toSorted();
  }

  const added = stringArray(after.added);
  const removed = stringArray(after.removed);
  const changed = after.mode === "both" ? stringArray(after.semanticChanged) : stringArray(after.changed);

  return [...new Set([...added, ...removed, ...changed])]
    .filter((name) => !isIgnoredResponseHeader(name))
    .toSorted();
}

function selectHeaderValues(headers: Record<string, unknown> | null | undefined, names: readonly string[]) {
  if (!headers || names.length === 0) return {};

  const valuesByName = new Map(
    Object.entries(headers).map(([name, value]) => [normalizeHeaderName(name), value] as const),
  );

  return Object.fromEntries(names.flatMap((name) => {
    const value = valuesByName.get(normalizeHeaderName(name));
    return value === undefined ? [] : [[name, value]];
  }));
}

function hydrateResponseHeaderEvidence(
  row: MappedChangeItemRow,
  responseHeadersByResultId: ReadonlyMap<string, Record<string, unknown>>,
): MappedChangeItemRow {
  if (row.changeType !== "response_headers.changed") return row;

  const names = changedHeaderNames(row.afterJson);
  const before = isRecord(row.beforeJson) ? row.beforeJson : {};
  const after = isRecord(row.afterJson) ? row.afterJson : {};
  const baselineHeaders = row.baselineResultId ? responseHeadersByResultId.get(row.baselineResultId) : undefined;
  const currentHeaders = row.currentResultId ? responseHeadersByResultId.get(row.currentResultId) : undefined;

  return {
    ...row,
    beforeJson: {
      ...before,
      valuesByName: selectHeaderValues(baselineHeaders, names),
    },
    afterJson: {
      ...after,
      valuesByName: selectHeaderValues(currentHeaders, names),
    },
  };
}

function comparisonSignature(scan: ScanRow) {
  return stableFingerprint({
    profile: scan.profile,
    requestSchemaVersion: scan.requestSchemaVersion,
    options: scan.optionsJson,
  });
}

function isEarlierScanForSameTarget(currentScan: ScanRow, baselineScan: ScanRow) {
  return currentScan.canonicalTargetId !== null
    && currentScan.canonicalTargetId === baselineScan.canonicalTargetId
    && currentScan.completedAt !== null
    && baselineScan.completedAt !== null
    && baselineScan.completedAt < currentScan.completedAt;
}

function normalizeCategory(category: string): ChangeCategory {
  switch (category) {
    case "availability":
      return "availability";
    case "content":
      return "content";
    case "delivery":
      return "availability";
    case "dns":
      return "infrastructure";
    case "tls":
      return "tls";
    case "technology":
      return "technology";
    default:
      return "discovery";
  }
}

function summaryForChange(item: EngineChangeItem) {
  switch (item.type) {
    case "status.changed":
      return `HTTP status changed from ${String(item.before)} to ${String(item.after)}`;
    case "redirect.changed":
      return "Redirect behavior changed";
    case "body_fingerprint.changed":
      return "Exact response body changed";
    case "response_headers.changed":
      return "Response headers changed";
    case "favicon.changed":
      return "Favicon fingerprint changed";
    case "favicon_location.changed":
      return "Favicon location changed";
    case "dns.host_ip_changed":
      return `Resolved IP changed from ${String(item.before)} to ${String(item.after)}`;
    case "dns.a_changed":
      return "IPv4 DNS records changed";
    case "dns.aaaa_changed":
      return "IPv6 DNS records changed";
    case "dns.cname_changed":
      return "CNAME records changed";
    case "tls.certificate_changed":
      return "TLS certificate fingerprint changed";
    case "tls.jarm_changed":
      return "JARM fingerprint changed";
    case "technology.changed":
      return "Detected technologies changed";
    case "cpe.changed":
      return "Detected CPE identifiers changed";
    case "metadata.title_changed":
      return "Page title changed";
    case "metadata.server_changed":
      return "Web server identity changed";
    case "metadata.content_type_changed":
      return "Content type changed";
    case "metadata.cdn_changed":
      return "CDN or WAF identity changed";
    case "metadata.capabilities_changed":
      return "HTTP capabilities changed";
  }
}

function itemKey(item: EngineChangeItem) {
  return createHash("sha256")
    .update(`${item.algorithmVersion}\0${item.endpointKey}\0${item.type}`)
    .digest("hex");
}

async function loadScanSnapshot(scanId: string): Promise<LoadedSnapshot> {
  const [attempt] = await db
    .select({ id: scanAttempts.id })
    .from(scanAttempts)
    .where(eq(scanAttempts.scanId, scanId))
    .orderBy(desc(scanAttempts.attemptNumber))
    .limit(1);

  if (!attempt) {
    return { results: [], resultIdByEndpoint: new Map() };
  }

  const resultRows = await db
    .select()
    .from(scanResults)
    .where(eq(scanResults.attemptId, attempt.id))
    .orderBy(asc(scanResults.id))
    .limit(5_001);

  if (resultRows.length > 5_000) {
    throw new Error("Scan comparison exceeds the 5000 endpoint limit.");
  }

  const detections = resultRows.length > 0
    ? await db
        .select({
          resultId: scanResultDetections.resultId,
          kind: scanResultDetections.kind,
          name: scanResultDetections.name,
          version: scanResultDetections.version,
          cpe: scanResultDetections.cpe,
        })
        .from(scanResultDetections)
        .where(inArray(scanResultDetections.resultId, resultRows.map((result) => result.id)))
        .orderBy(asc(scanResultDetections.resultId), asc(scanResultDetections.name))
    : [];
  const detectionsByResultId = new Map<string, typeof detections>();

  for (const detection of detections) {
    const entries = detectionsByResultId.get(detection.resultId) ?? [];
    entries.push(detection);
    detectionsByResultId.set(detection.resultId, entries);
  }

  const comparableResults = resultRows.map((result): ComparableScanResult => {
    const resultDetections = detectionsByResultId.get(result.id) ?? [];

    return {
      ...result,
      resultId: result.id,
      technologies: resultDetections
        .filter((detection) => detection.kind === "technology")
        .map((detection) => detection.name),
      technologyDetections: resultDetections
        .filter((detection) => detection.kind === "technology")
        .map((detection) => ({ name: detection.name, version: detection.version, cpe: detection.cpe })),
      cpe: resultDetections.flatMap((detection) => detection.cpe ? [detection.cpe] : []),
    };
  });
  const resultIdByEndpoint = new Map<string, string>();

  for (const result of comparableResults) {
    const endpoint = canonicalizeEndpoint(result);
    if (endpoint) {
      resultIdByEndpoint.set(endpoint, result.resultId ?? result.id ?? "");
    }
  }

  return { results: comparableResults, resultIdByEndpoint };
}

async function getScan(scanId: string) {
  const [scan] = await db.select().from(scans).where(eq(scans.id, scanId)).limit(1);
  return scan ?? null;
}

async function getVisibleScan(actor: ActorContext, scanId: string) {
  const visibleFilter = getVisibleScansFilter(actor);
  const [scan] = await db
    .select()
    .from(scans)
    .where(and(eq(scans.id, scanId), visibleFilter))
    .limit(1);
  return scan ?? null;
}

async function listPreviousBaselineScans(currentScan: ScanRow) {
  if (!currentScan.canonicalTargetId) {
    return [];
  }

  const candidates = await db
    .select()
    .from(scans)
    .where(and(
      eq(scans.canonicalTargetId, currentScan.canonicalTargetId),
      eq(scans.status, "completed"),
      currentScan.completedAt ? lt(scans.completedAt, currentScan.completedAt) : undefined,
    ))
    .orderBy(desc(scans.completedAt), desc(scans.submittedAt), desc(scans.id))
    .limit(BASELINE_OPTION_LIMIT + 1);

  return candidates.filter((candidate) => candidate.id !== currentScan.id);
}

async function resolveBaseline(currentScan: ScanRow, requestedBaselineScanId?: string | null) {
  const previousScans = await listPreviousBaselineScans(currentScan);

  if (requestedBaselineScanId) {
    const baseline = previousScans.find((candidate) => candidate.id === requestedBaselineScanId)
      ?? await getScan(requestedBaselineScanId);

    if (
      !baseline
      || baseline.id === currentScan.id
      || baseline.status !== "completed"
      || !isEarlierScanForSameTarget(currentScan, baseline)
    ) {
      throw new Error("The selected scan is not an earlier completed scan for this target.");
    }

    return { baseline, mode: "ad_hoc" as const, previousScans };
  }

  const [setting] = currentScan.canonicalTargetId
    ? await db
        .select()
        .from(targetMonitoringSettings)
        .where(eq(targetMonitoringSettings.canonicalTargetId, currentScan.canonicalTargetId))
        .limit(1)
    : [];

  if (setting?.baselineMode === "pinned" && setting.pinnedBaselineScanId) {
    const pinned = await getScan(setting.pinnedBaselineScanId);
    const pinAppliedBeforeCurrentScan = Boolean(
      currentScan.completedAt
      && pinned?.completedAt
      && pinned.completedAt < currentScan.completedAt
      && setting.updatedAt <= currentScan.completedAt,
    );
    if (
      pinned
      && pinAppliedBeforeCurrentScan
      && pinned.status === "completed"
      && isEarlierScanForSameTarget(currentScan, pinned)
      && pinned.id !== currentScan.id
    ) {
      return { baseline: pinned, mode: "pinned" as const, previousScans };
    }
  }

  return { baseline: previousScans[0] ?? null, mode: "previous" as const, previousScans };
}

async function markComparisonFailed(comparisonId: string, error: unknown) {
  await db
    .update(scanComparisons)
    .set({
      status: "failed",
      failureCode: "comparison_failed",
      failureMessage: error instanceof Error ? error.message.slice(0, 1_000) : "Unknown comparison failure",
      failedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(scanComparisons.id, comparisonId));
}

export async function computeScanChanges(
  scanId: string,
  requestedBaselineScanId?: string | null,
  ensureIpNetworkIdentities?: EnsureIpNetworkIdentities,
) {
  const currentScan = await getScan(scanId);

  if (!currentScan || currentScan.status !== "completed" || !currentScan.canonicalTargetId) {
    return null;
  }

  const resolved = await resolveBaseline(currentScan, requestedBaselineScanId);
  if (!resolved.baseline) {
    return null;
  }

  const signature = comparisonSignature(currentScan);
  const [completedComparison] = await db
    .select({ id: scanComparisons.id, baselineMode: scanComparisons.baselineMode })
    .from(scanComparisons)
    .where(and(
      eq(scanComparisons.comparisonScanId, currentScan.id),
      eq(scanComparisons.baselineScanId, resolved.baseline.id),
      eq(scanComparisons.algorithmVersion, ALGORITHM_VERSION),
      eq(scanComparisons.status, "completed"),
    ))
    .limit(1);

  // Comparison rows and their item IDs are immutable once complete. Alert
  // events retain the matched item IDs in their delivery snapshot, so deleting
  // and recreating completed items during an idempotent retry would make an
  // already queued notification lose its evidence.
  if (completedComparison) {
    if (resolved.mode !== "ad_hoc" && completedComparison.baselineMode !== resolved.mode) {
      await db
        .update(scanComparisons)
        .set({ baselineMode: resolved.mode, updatedAt: new Date() })
        .where(eq(scanComparisons.id, completedComparison.id));
    }
    return completedComparison.id;
  }

  const [comparison] = await db
    .insert(scanComparisons)
    .values({
      comparisonScanId: currentScan.id,
      baselineScanId: resolved.baseline.id,
      baselineMode: resolved.mode,
      canonicalTargetId: currentScan.canonicalTargetId,
      comparisonSignature: signature,
      algorithmVersion: ALGORITHM_VERSION,
      status: "pending",
      diffJson: {},
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [scanComparisons.comparisonScanId, scanComparisons.baselineScanId, scanComparisons.algorithmVersion],
      set: {
        canonicalTargetId: currentScan.canonicalTargetId,
        comparisonSignature: signature,
        baselineMode: resolved.mode,
        status: "pending",
        failureCode: null,
        failureMessage: null,
        failedAt: null,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!comparison) {
    throw new Error("Unable to persist scan comparison.");
  }

  try {
    const [baselineSnapshot, currentSnapshot] = await Promise.all([
      loadScanSnapshot(resolved.baseline.id),
      loadScanSnapshot(currentScan.id),
    ]);
    const affectedIpAddresses = collectChangedIpRecordAddresses(
      { results: baselineSnapshot.results },
      { results: currentSnapshot.results },
    ).slice(0, IP_IDENTITY_LOOKUP_LIMIT);

    if (ensureIpNetworkIdentities && affectedIpAddresses.length > 0) {
      try {
        await ensureIpNetworkIdentities(affectedIpAddresses);
      } catch {
        // Missing enrichment must keep the exact DNS change visible rather than
        // fail an otherwise valid comparison.
      }
    }

    const ipNetworkIdentities = await loadIpNetworkIdentities(affectedIpAddresses);
    const output = compareScanResults({
      baseline: { results: baselineSnapshot.results },
      current: { results: currentSnapshot.results },
      ipNetworkIdentities,
    });
    const categoryCounts: Record<string, number> = {};
    let alertEligibleCount = 0;

    const values = output.items.map((item) => {
      const category = normalizeCategory(item.category);
      categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
      alertEligibleCount += item.alertEligible ? 1 : 0;

      return {
        comparisonId: comparison.id,
        itemKey: itemKey(item),
        endpointIdentity: item.endpointKey,
        baselineResultId: baselineSnapshot.resultIdByEndpoint.get(item.endpointKey) || null,
        currentResultId: currentSnapshot.resultIdByEndpoint.get(item.endpointKey) || null,
        category,
        changeType: item.type,
        fieldPath: item.type,
        confidence: item.confidence,
        beforeJson: item.before,
        afterJson: item.after,
        summary: summaryForChange(item),
        summaryArgsJson: {},
        metadataJson: { algorithmVersion: item.algorithmVersion },
        alertEligible: item.alertEligible,
      } satisfies typeof scanChangeItems.$inferInsert;
    });

    await db.transaction(async (tx) => {
      await tx.delete(scanChangeItems).where(eq(scanChangeItems.comparisonId, comparison.id));
      if (values.length > 0) {
        await tx.insert(scanChangeItems).values(values);
      }
      await tx
        .update(scanComparisons)
        .set({
          status: "completed",
          changeCount: output.totalChangeCount,
          alertEligibleCount,
          categoryCountsJson: categoryCounts,
          diffJson: {
            algorithmVersion: output.algorithmVersion,
            comparedEndpointCount: output.comparedEndpointCount,
            skippedResultCount: output.skippedResultCount,
            omittedChangeCount: output.omittedChangeCount,
            truncated: output.truncated,
          },
          failureCode: null,
          failureMessage: null,
          completedAt: new Date(),
          failedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(scanComparisons.id, comparison.id));
    });

    return comparison.id;
  } catch (error) {
    await markComparisonFailed(comparison.id, error);
    throw error;
  }
}

function scanRef(scan: ScanRow) {
  return {
    id: scan.id,
    target: scan.normalizedTarget,
    completedAt: scan.completedAt?.toISOString() ?? null,
  };
}

function evidence(value: unknown) {
  if (value === undefined) {
    return null;
  }
  return value as string | number | boolean | Array<string | number | boolean> | Record<string, unknown> | null;
}

function changeFeedPreview(item: ScanComparison["items"][number], target: string) {
  const preview = getChangePreview(item, target);
  return preview && preview.length > CHANGE_FEED_PREVIEW_MAX_LENGTH
    ? `${preview.slice(0, CHANGE_FEED_PREVIEW_MAX_LENGTH - 1)}…`
    : preview;
}

function mapComparison(
  comparison: ComparisonRow,
  currentScan: ScanRow,
  baselineScan: ScanRow,
  rows: MappedChangeItemRow[],
  baselineMode: ScanComparison["baselineMode"],
  currentFaviconUrl: string | null = null,
  countOverride?: { total: number; alertEligible: number },
) {
  const activeRows = rows.filter((row) => !isRetiredChangeType(row.changeType));
  const retiredRows = rows.filter((row) => isRetiredChangeType(row.changeType));

  return scanComparisonSchema.parse({
    id: comparison.id,
    canonicalTargetId: comparison.canonicalTargetId,
    status: comparison.status,
    algorithmVersion: comparison.algorithmVersion,
    currentScan: {
      ...scanRef(currentScan),
      faviconUrl: currentFaviconUrl,
    },
    baselineScan: scanRef(baselineScan),
    baselineMode,
    counts: countOverride ?? {
      total: Math.max(0, comparison.changeCount - retiredRows.length),
      alertEligible: Math.max(0, comparison.alertEligibleCount - retiredRows.filter((row) => row.alertEligible).length),
    },
    items: activeRows.map((row) => ({
      id: row.id,
      category: changeCategorySchema.safeParse(row.category).success ? row.category : "discovery",
      changeType: row.changeType,
      fieldPath: row.fieldPath ?? row.changeType,
      summary: row.summary,
      endpointIdentity: row.endpointIdentity,
      before: evidence(row.beforeJson),
      after: evidence(row.afterJson),
      alertEligible: row.alertEligible,
    })),
    errorMessage: comparison.failureMessage,
    createdAt: comparison.createdAt.toISOString(),
  });
}

async function getPersistedComparison(comparisonId: string, baselineMode: ScanComparison["baselineMode"]) {
  const [comparison] = await db.select().from(scanComparisons).where(eq(scanComparisons.id, comparisonId)).limit(1);
  if (!comparison) {
    return null;
  }

  const [scanRows, itemRows] = await Promise.all([
    db.select().from(scans).where(inArray(scans.id, [comparison.comparisonScanId, comparison.baselineScanId])),
    db.select().from(scanChangeItems).where(eq(scanChangeItems.comparisonId, comparison.id)).orderBy(
      asc(scanChangeItems.category),
      asc(scanChangeItems.changeType),
      asc(scanChangeItems.itemKey),
    ).limit(2_000),
  ]);
  const headerResultIds = [...new Set(itemRows.flatMap((row) => (
    row.changeType === "response_headers.changed"
      ? [row.baselineResultId, row.currentResultId].flatMap((resultId) => resultId ? [resultId] : [])
      : []
  )))];
  const resultHeaders = headerResultIds.length > 0
    ? await db
        .select({ id: scanResults.id, responseHeadersJson: scanResults.responseHeadersJson })
        .from(scanResults)
        .where(inArray(scanResults.id, headerResultIds))
    : [];
  const responseHeadersByResultId = new Map(resultHeaders.map((result) => [
    result.id,
    isRecord(result.responseHeadersJson) ? result.responseHeadersJson : {},
  ]));
  const items = itemRows.map((row) => hydrateResponseHeaderEvidence(row, responseHeadersByResultId));
  const scanById = new Map(scanRows.map((scan) => [scan.id, scan]));
  const currentScan = scanById.get(comparison.comparisonScanId);
  const baselineScan = scanById.get(comparison.baselineScanId);

  return currentScan && baselineScan ? mapComparison(comparison, currentScan, baselineScan, items, baselineMode) : null;
}

export async function getComparisonForView(actor: ActorContext, comparisonId: string) {
  const visibleFilter = getVisibleScansFilter(actor);
  const [row] = await db
    .select({
      id: scanComparisons.id,
      baselineMode: scanComparisons.baselineMode,
    })
    .from(scanComparisons)
    .innerJoin(scans, eq(scans.id, scanComparisons.comparisonScanId))
    .where(and(eq(scanComparisons.id, comparisonId), visibleFilter))
    .limit(1);

  return row ? getPersistedComparison(row.id, row.baselineMode) : null;
}

export async function getScanComparisonForView(
  actor: ActorContext,
  scanId: string,
  requestedBaselineScanId?: string | null,
): Promise<ScanComparisonResponse> {
  const currentScan = await getVisibleScan(actor, scanId);

  if (!currentScan || currentScan.status !== "completed") {
    return scanComparisonResponseSchema.parse({
      comparison: null,
      baselineOptions: [],
      state: "pending",
      canManageBaseline: canManageBaselines(actor),
    });
  }

  const resolved = await resolveBaseline(currentScan, requestedBaselineScanId);
  if (!resolved.baseline) {
    return scanComparisonResponseSchema.parse({
      comparison: null,
      baselineOptions: [],
      state: "baseline_established",
      canManageBaseline: canManageBaselines(actor),
    });
  }

  let comparisonId: string | null = null;
  const [existing] = await db
    .select({ id: scanComparisons.id, status: scanComparisons.status })
    .from(scanComparisons)
    .where(and(
      eq(scanComparisons.comparisonScanId, currentScan.id),
      eq(scanComparisons.baselineScanId, resolved.baseline.id),
      eq(scanComparisons.algorithmVersion, ALGORITHM_VERSION),
    ))
    .limit(1);

  try {
    comparisonId = await computeScanChanges(currentScan.id, requestedBaselineScanId);
  } catch {
    comparisonId = existing?.id ?? null;
  }

  const comparison = comparisonId ? await getPersistedComparison(comparisonId, resolved.mode) : null;
  const [pinnedSetting] = currentScan.canonicalTargetId
    ? await db
        .select()
        .from(targetMonitoringSettings)
        .where(eq(targetMonitoringSettings.canonicalTargetId, currentScan.canonicalTargetId))
        .limit(1)
    : [];
  const optionScans = [
    resolved.baseline,
    ...resolved.previousScans.filter((scan) => scan.id !== resolved.baseline?.id),
  ].slice(0, BASELINE_OPTION_LIMIT);
  const baselineOptions = optionScans.map((scan) => ({
    ...scanRef(scan),
    selected: scan.id === resolved.baseline?.id,
    pinned: pinnedSetting?.pinnedBaselineScanId === scan.id,
  }));

  return scanComparisonResponseSchema.parse({
    comparison,
    baselineOptions,
    state: comparison?.status === "completed" ? "ready" : comparison?.status === "failed" ? "failed" : "pending",
    canManageBaseline: canManageBaselines(actor),
  });
}

type ChangeFeedCursor = {
  sortAt: Date;
  id: string;
  timeZone: string;
};

type ListedComparisonRow = {
  comparison: ComparisonRow;
  sortAt: Date | string;
};

type ChangeFeedCount = {
  total: number;
  matching: number;
  alertEligible: number;
};

function encodeCursor(row: ListedComparisonRow, timeZone: string) {
  const sortAt = row.sortAt instanceof Date ? row.sortAt : new Date(row.sortAt);

  return Buffer.from(JSON.stringify({
    sortAt: sortAt.toISOString(),
    id: row.comparison.id,
    timeZone,
  }), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | null): ChangeFeedCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<string, unknown>;
    const sortAt = new Date(typeof decoded.sortAt === "string" ? decoded.sortAt : "");
    const id = typeof decoded.id === "string" ? decoded.id : "";
    const timeZone = typeof decoded.timeZone === "string" && isValidTimeZone(decoded.timeZone)
      ? decoded.timeZone
      : "UTC";

    return id && Number.isFinite(sortAt.getTime()) ? { sortAt, id, timeZone } : null;
  } catch {
    return null;
  }
}

function takeComparisonPage(
  rows: ListedComparisonRow[],
  limit: number,
  timeZone: string,
  keepDayTogether: boolean,
) {
  if (!keepDayTogether || rows.length <= limit) {
    return rows.slice(0, limit);
  }

  const page = rows.slice(0, limit);
  const boundaryDay = formatDateOnlyInTimeZone(page.at(-1)?.sortAt ?? null, timeZone);

  if (!boundaryDay) {
    return page;
  }

  for (const row of rows.slice(limit)) {
    if (page.length >= CHANGE_FEED_MAX_LIMIT || formatDateOnlyInTimeZone(row.sortAt, timeZone) !== boundaryDay) {
      break;
    }
    page.push(row);
  }

  return page;
}

async function loadChangeHistoryPage(
  actor: ActorContext,
  query: ChangeFeedQuery,
  options: {
    canonicalTargetId?: string;
    itemLimit: number;
    keepDayTogether: boolean;
    timeZone?: string | null;
  },
) {
  const visibleFilter = getVisibleScansFilter(actor);
  const cursor = decodeCursor(query.cursor);
  const limit = Math.min(query.limit, CHANGE_FEED_MAX_LIMIT);
  const timeZone = cursor?.timeZone
    ?? (options.timeZone && isValidTimeZone(options.timeZone) ? options.timeZone : "UTC");
  const sortAt = sql<Date>`coalesce(${scans.completedAt}, ${scans.submittedAt})`;
  const conditions = [
    eq(scanComparisons.status, "completed"),
    ne(scanComparisons.baselineMode, "ad_hoc"),
    sql`${scanComparisons.id} = (
      select candidate.id
      from scan_comparisons candidate
      where candidate.comparison_scan_id = ${scanComparisons.comparisonScanId}
        and candidate.status = 'completed'
        and candidate.baseline_mode <> 'ad_hoc'
      order by candidate.algorithm_version desc, candidate.created_at desc, candidate.id desc
      limit 1
    )`,
  ];

  if (visibleFilter) {
    conditions.push(visibleFilter);
  }

  if (options.canonicalTargetId) {
    conditions.push(eq(scanComparisons.canonicalTargetId, options.canonicalTargetId));
  }

  if (query.target) {
    conditions.push(ilike(scans.normalizedTarget, `%${query.target.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`));
  }
  if (query.category) {
    conditions.push(exists(
      db.select({ value: sql`1` }).from(scanChangeItems).where(and(
        eq(scanChangeItems.comparisonId, scanComparisons.id),
        eq(scanChangeItems.category, query.category),
        notInArray(scanChangeItems.changeType, RETIRED_CHANGE_TYPES),
      )),
    ));
  }
  if (cursor) {
    conditions.push(or(
      lt(sortAt, cursor.sortAt),
      and(eq(sortAt, cursor.sortAt), lt(scanComparisons.id, cursor.id)),
    )!);
  }

  const rows = await db
    .select({ comparison: scanComparisons, sortAt })
    .from(scanComparisons)
    .innerJoin(scans, eq(scans.id, scanComparisons.comparisonScanId))
    .where(and(...conditions))
    .orderBy(desc(sortAt), desc(scanComparisons.id))
    .limit(options.keepDayTogether ? CHANGE_FEED_MAX_LIMIT + 1 : limit + 1);
  const pageRows = takeComparisonPage(rows, limit, timeZone, options.keepDayTogether);
  const page = pageRows.map((row) => row.comparison);
  const comparisonIds = page.map((comparison) => comparison.id);
  const scanIds = [...new Set(page.flatMap((comparison) => [comparison.comparisonScanId, comparison.baselineScanId]))];
  const rankedItems = comparisonIds.length > 0
    ? db.$with("ranked_change_feed_items").as(
        db
          .select({
            ...getTableColumns(scanChangeItems),
            itemRank: sql<number>`row_number() over (
              partition by ${scanChangeItems.comparisonId}
              order by ${scanChangeItems.category}, ${scanChangeItems.changeType}, ${scanChangeItems.itemKey}
            )`.as("item_rank"),
          })
          .from(scanChangeItems)
          .where(and(
            inArray(scanChangeItems.comparisonId, comparisonIds),
            notInArray(scanChangeItems.changeType, RETIRED_CHANGE_TYPES),
            query.category ? eq(scanChangeItems.category, query.category) : undefined,
          )),
      )
    : null;
  const currentScanIds = [...new Set(page.map((comparison) => comparison.comparisonScanId))];
  const [scanRows, itemRows, countRows, faviconUrls] = await Promise.all([
    scanIds.length > 0 ? db.select().from(scans).where(inArray(scans.id, scanIds)) : Promise.resolve([]),
    rankedItems
      ? db
          .with(rankedItems)
          .select({
            id: rankedItems.id,
            comparisonId: rankedItems.comparisonId,
            itemKey: rankedItems.itemKey,
            endpointIdentity: rankedItems.endpointIdentity,
            baselineResultId: rankedItems.baselineResultId,
            currentResultId: rankedItems.currentResultId,
            category: rankedItems.category,
            changeType: rankedItems.changeType,
            fieldPath: rankedItems.fieldPath,
            summary: rankedItems.summary,
            beforeJson: rankedItems.beforeJson,
            afterJson: rankedItems.afterJson,
            alertEligible: rankedItems.alertEligible,
          })
          .from(rankedItems)
          .where(lte(rankedItems.itemRank, options.itemLimit))
          .orderBy(asc(rankedItems.comparisonId), asc(rankedItems.itemRank))
      : Promise.resolve([]),
    comparisonIds.length > 0
      ? db
          .select({
            comparisonId: scanChangeItems.comparisonId,
            total: sql<number>`count(*)::int`,
            matching: query.category
              ? sql<number>`count(*) filter (where ${scanChangeItems.category} = ${query.category})::int`
              : sql<number>`count(*)::int`,
            alertEligible: sql<number>`count(*) filter (where ${scanChangeItems.alertEligible})::int`,
          })
          .from(scanChangeItems)
          .where(and(
            inArray(scanChangeItems.comparisonId, comparisonIds),
            notInArray(scanChangeItems.changeType, RETIRED_CHANGE_TYPES),
          ))
          .groupBy(scanChangeItems.comparisonId)
      : Promise.resolve([]),
    listCompletedResultFaviconUrls(actor, currentScanIds),
  ]);
  const scanById = new Map(scanRows.map((scan) => [scan.id, scan]));
  const itemsByComparisonId = new Map<string, MappedChangeItemRow[]>();
  const countsByComparisonId = new Map<string, ChangeFeedCount>(countRows.map((row) => [
    row.comparisonId,
    {
      total: row.total,
      matching: row.matching,
      alertEligible: row.alertEligible,
    },
  ]));

  for (const item of itemRows) {
    const items = itemsByComparisonId.get(item.comparisonId) ?? [];
    items.push(item);
    itemsByComparisonId.set(item.comparisonId, items);
  }

  const items = page.flatMap((comparison) => {
    const currentScan = scanById.get(comparison.comparisonScanId);
    const baselineScan = scanById.get(comparison.baselineScanId);
    const counts = countsByComparisonId.get(comparison.id) ?? { total: 0, matching: 0, alertEligible: 0 };
    return currentScan && baselineScan
      ? [mapComparison(
          comparison,
          currentScan,
          baselineScan,
          itemsByComparisonId.get(comparison.id) ?? [],
          comparison.baselineMode,
          faviconUrls.get(currentScan.id) ?? null,
          counts,
        )]
      : [];
  });

  return {
    items,
    countsByComparisonId,
    nextCursor: rows.length > pageRows.length && pageRows.at(-1)
      ? encodeCursor(pageRows.at(-1)!, timeZone)
      : null,
  };
}

export async function listChangeFeed(
  actor: ActorContext,
  query: ChangeFeedQuery,
  options: { timeZone?: string | null } = {},
): Promise<ChangeFeedResponse> {
  const page = await loadChangeHistoryPage(actor, query, {
    itemLimit: CHANGE_FEED_PREVIEW_LIMIT,
    keepDayTogether: true,
    timeZone: options.timeZone,
  });

  return changeFeedResponseSchema.parse({
    items: page.items.map((comparison) => {
      const counts = page.countsByComparisonId.get(comparison.id) ?? {
        total: comparison.counts.total,
        matching: comparison.items.length,
        alertEligible: comparison.counts.alertEligible,
      };

      return {
        ...comparison,
        counts,
        items: comparison.items.map((item) => ({
          id: item.id,
          category: item.category,
          changeType: item.changeType,
          summary: item.summary,
          preview: changeFeedPreview(item, comparison.currentScan.target),
        })),
        itemsTruncated: counts.matching > comparison.items.length,
      };
    }),
    nextCursor: page.nextCursor,
  });
}

export async function listTargetChangeHistory(
  actor: ActorContext,
  canonicalTargetId: string,
  query: ChangeFeedQuery,
  options: { keepDayTogether?: boolean; timeZone?: string | null } = {},
): Promise<ChangeHistoryResponse> {
  const page = await loadChangeHistoryPage(actor, query, {
    canonicalTargetId,
    itemLimit: CHANGE_FEED_ITEM_LIMIT,
    keepDayTogether: options.keepDayTogether ?? true,
    timeZone: options.timeZone,
  });

  return changeHistoryResponseSchema.parse({
    items: page.items,
    nextCursor: page.nextCursor,
  });
}

export async function updateMonitoringBaseline(
  actor: ActorContext,
  canonicalTargetId: string,
  input: UpdateMonitoringBaselineRequest,
) {
  if (!canManageBaselines(actor)) {
    throw new Error("You do not have permission to manage monitoring baselines.");
  }

  const pinnedScan = input.mode === "pinned" ? await getScan(input.scanId) : null;
  if (input.mode === "pinned" && (!pinnedScan || pinnedScan.status !== "completed" || pinnedScan.canonicalTargetId !== canonicalTargetId)) {
    throw new Error("The selected scan cannot be used as a baseline for this target.");
  }

  await db.transaction(async (tx) => {
    const [previous] = await tx
      .select()
      .from(targetMonitoringSettings)
      .where(eq(targetMonitoringSettings.canonicalTargetId, canonicalTargetId))
      .limit(1);
    const previousMode = previous?.baselineMode ?? "previous";
    const previousPinnedScanId = previous?.pinnedBaselineScanId ?? null;
    const pinnedBaselineScanId = input.mode === "pinned" ? input.scanId : null;

    await tx
      .insert(targetMonitoringSettings)
      .values({
        canonicalTargetId,
        baselineMode: input.mode,
        pinnedBaselineScanId,
        updatedByUserId: actor.user.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: targetMonitoringSettings.canonicalTargetId,
        set: {
          baselineMode: input.mode,
          pinnedBaselineScanId,
          updatedByUserId: actor.user.id,
          updatedAt: new Date(),
        },
      });
    await tx.insert(targetMonitoringBaselineEvents).values({
      canonicalTargetId,
      previousMode,
      previousPinnedScanId,
      newMode: input.mode,
      newPinnedScanId: pinnedBaselineScanId,
      changedByUserId: actor.user.id,
    });
  });

  return { canonicalTargetId, mode: input.mode, pinnedBaselineScanId: input.mode === "pinned" ? input.scanId : null };
}
