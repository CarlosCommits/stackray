import { and, count, desc, eq, inArray, ne, notInArray } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/lib/db/client";
import {
  scanComparisons,
  scanChangeItems,
  scanSchedules,
  scanScheduleTargets,
  scans,
  targetMonitoringSettings,
} from "@/lib/db/schema";
import type { ChangeFeedQuery } from "@/lib/contracts/changes";
import type { ActorContext } from "@/lib/session/actor-context";
import { canManageAlerts, canManageBaselines, canRunScans } from "@/lib/authorization/authz";
import { RETIRED_CHANGE_TYPES } from "@/lib/changes/change-types";
import { getTargetAlertCoverage } from "@/lib/server/alerts/service";
import { listTargetChangeHistory } from "@/lib/server/changes/service";
import { getVisibleScansFilter } from "@/lib/server/scans/access";
import {
  getAuthoritativeScanResult,
  listCompletedResultSnapshots,
} from "@/lib/server/scans/read-service";

const TARGET_OVERVIEW_SCAN_LIMIT = 8;
const TARGET_SCHEDULE_LIMIT = 10;

const defaultChangeQuery: ChangeFeedQuery = {
  cursor: null,
  limit: 20,
  category: null,
  target: null,
};

const getTargetProfileIdentityCached = cache(async (actor: ActorContext, canonicalTargetId: string) => {
  const [latestScan] = await db
    .select()
    .from(scans)
    .where(and(
      eq(scans.canonicalTargetId, canonicalTargetId),
      getVisibleScansFilter(actor),
    ))
    .orderBy(desc(scans.completedAt), desc(scans.submittedAt), desc(scans.id))
    .limit(1);

  if (!latestScan) {
    return null;
  }

  const completed = latestScan.status === "completed";
  const [snapshots, result] = await Promise.all([
    completed ? listCompletedResultSnapshots(actor, [latestScan.id]) : Promise.resolve([]),
    completed ? getAuthoritativeScanResult(actor, latestScan.id) : Promise.resolve(null),
  ]);
  const snapshot = snapshots[0] ?? null;

  return {
    canonicalTargetId,
    target: latestScan.normalizedTarget,
    inputTarget: latestScan.inputTarget,
    title: snapshot?.title ?? result?.title ?? "",
    faviconUrl: snapshot?.faviconUrl ?? result?.favicon.proxyUrl ?? result?.favicon.url ?? null,
    latestScanId: latestScan.id,
    latestScanStatus: latestScan.status,
    lastScannedAt: latestScan.completedAt?.toISOString() ?? latestScan.submittedAt.toISOString(),
    finalUrl: snapshot?.resultFinalUrl ?? result?.finalUrl ?? latestScan.normalizedTarget,
    statusCode: snapshot?.statusCode ?? result?.statusCode ?? null,
    hostIp: result?.dns.hostIp ?? null,
    server: snapshot?.server ?? result?.server ?? null,
    technologies: snapshot?.technologies ?? result?.technologies ?? [],
    tlsObserved: Boolean(result?.tls.sni || Object.keys(result?.tls.certificate ?? {}).length > 0),
    canRunScans: canRunScans(actor),
    canManageBaseline: canManageBaselines(actor),
  };
});

export function getTargetProfileIdentity(actor: ActorContext, canonicalTargetId: string) {
  return getTargetProfileIdentityCached(actor, canonicalTargetId);
}

export async function getTargetScanHistory(actor: ActorContext, canonicalTargetId: string) {
  const rows = await db
    .select()
    .from(scans)
    .where(and(
      eq(scans.canonicalTargetId, canonicalTargetId),
      getVisibleScansFilter(actor),
    ))
    .orderBy(desc(scans.submittedAt), desc(scans.id))
    .limit(TARGET_OVERVIEW_SCAN_LIMIT);
  const scanIds = rows.map((row) => row.id);
  const comparisons = scanIds.length > 0
    ? await db
        .select({
          scanId: scanComparisons.comparisonScanId,
          comparisonId: scanComparisons.id,
          changeCount: scanComparisons.changeCount,
          createdAt: scanComparisons.createdAt,
        })
        .from(scanComparisons)
        .where(and(
          inArray(scanComparisons.comparisonScanId, scanIds),
          eq(scanComparisons.status, "completed"),
          ne(scanComparisons.baselineMode, "ad_hoc"),
        ))
        .orderBy(desc(scanComparisons.createdAt), desc(scanComparisons.id))
        .limit(TARGET_OVERVIEW_SCAN_LIMIT * 2)
    : [];
  const comparisonIds = comparisons.map((comparison) => comparison.comparisonId);
  const activeChangeCounts = comparisonIds.length > 0
    ? await db
        .select({
          comparisonId: scanChangeItems.comparisonId,
          changeCount: count(),
        })
        .from(scanChangeItems)
        .where(and(
          inArray(scanChangeItems.comparisonId, comparisonIds),
          notInArray(scanChangeItems.changeType, RETIRED_CHANGE_TYPES),
        ))
        .groupBy(scanChangeItems.comparisonId)
    : [];
  const activeChangeCountByComparisonId = new Map(
    activeChangeCounts.map((row) => [row.comparisonId, row.changeCount]),
  );
  const latestComparisonByScanId = new Map<string, (typeof comparisons)[number]>();

  for (const comparison of comparisons) {
    if (!latestComparisonByScanId.has(comparison.scanId)) {
      latestComparisonByScanId.set(comparison.scanId, comparison);
    }
  }

  return rows.map((row) => {
    const comparison = latestComparisonByScanId.get(row.id);
    const durationMs = row.startedAt && row.completedAt
      ? Math.max(0, row.completedAt.getTime() - row.startedAt.getTime())
      : null;

    return {
      scanId: row.id,
      status: row.status,
      source: row.source,
      submittedAt: row.submittedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      durationMs,
      comparison: comparison ? {
        id: comparison.comparisonId,
        changeCount: activeChangeCountByComparisonId.get(comparison.comparisonId) ?? 0,
      } : null,
    };
  });
}

export async function getTargetMonitoring(actor: ActorContext, canonicalTargetId: string) {
  const canManageAlerting = canManageAlerts(actor);
  const [settingRows, schedules, completedScans, alertCoverage] = await Promise.all([
    db
      .select()
      .from(targetMonitoringSettings)
      .where(eq(targetMonitoringSettings.canonicalTargetId, canonicalTargetId))
      .limit(1),
    db
      .select({
        id: scanSchedules.id,
        frequency: scanSchedules.frequency,
        hour: scanSchedules.hour,
        minute: scanSchedules.minute,
        weekday: scanSchedules.weekday,
        dayOfMonth: scanSchedules.dayOfMonth,
        timezone: scanSchedules.timezone,
        enabled: scanSchedules.enabled,
        nextRunAt: scanSchedules.nextRunAt,
      })
      .from(scanScheduleTargets)
      .innerJoin(scanSchedules, eq(scanSchedules.id, scanScheduleTargets.scheduleId))
      .where(eq(scanScheduleTargets.canonicalTargetId, canonicalTargetId))
      .orderBy(desc(scanSchedules.enabled), scanSchedules.nextRunAt)
      .limit(TARGET_SCHEDULE_LIMIT),
    db
      .select({
        id: scans.id,
        completedAt: scans.completedAt,
      })
      .from(scans)
      .where(and(
        eq(scans.canonicalTargetId, canonicalTargetId),
        eq(scans.status, "completed"),
        getVisibleScansFilter(actor),
      ))
      .orderBy(desc(scans.completedAt), desc(scans.id))
      .limit(25),
    canManageAlerting
      ? getTargetAlertCoverage(actor, canonicalTargetId)
      : Promise.resolve(null),
  ]);
  const setting = settingRows[0] ?? null;
  const baselineMode: "previous" | "pinned" = setting?.baselineMode === "pinned" ? "pinned" : "previous";

  return {
    baselineMode,
    pinnedBaselineScanId: setting?.pinnedBaselineScanId ?? null,
    baselineOptions: completedScans.map((scan) => ({
      id: scan.id,
      completedAt: scan.completedAt?.toISOString() ?? null,
    })),
    schedules: schedules.map((schedule) => ({
      ...schedule,
      nextRunAt: schedule.nextRunAt.toISOString(),
    })),
    canManageBaseline: canManageBaselines(actor),
    canManageAlerts: canManageAlerting,
    alertCoverage,
  };
}

export function getTargetChangeHistory(
  actor: ActorContext,
  canonicalTargetId: string,
  query: ChangeFeedQuery = defaultChangeQuery,
  options: { keepDayTogether?: boolean; timeZone?: string | null } = {},
) {
  return listTargetChangeHistory(actor, canonicalTargetId, query, options);
}

export async function getTargetOverview(actor: ActorContext, canonicalTargetId: string) {
  const [identity, changes, scansHistory, monitoring] = await Promise.all([
    getTargetProfileIdentity(actor, canonicalTargetId),
    getTargetChangeHistory(
      actor,
      canonicalTargetId,
      { ...defaultChangeQuery, limit: 3 },
      { keepDayTogether: false },
    ),
    getTargetScanHistory(actor, canonicalTargetId),
    getTargetMonitoring(actor, canonicalTargetId),
  ]);

  return {
    identity,
    recentChanges: changes.items,
    recentScans: scansHistory,
    monitoring,
  };
}
