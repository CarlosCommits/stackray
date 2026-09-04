import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "../../db/client.ts";
import { scanAttempts, scanResults, scans } from "../../db/schema.ts";
import type { ActorContext } from "../../session/actor-context.ts";
import { getVisibleScansFilter } from "./access.ts";
import { selectAuthoritativeScanResult } from "./result-selection.ts";

function isHttpUrl(value: string | null | undefined) {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function listCompletedResultFaviconUrls(
  actor: ActorContext,
  filteredScanIds: string[],
): Promise<Map<string, string | null>> {
  if (filteredScanIds.length === 0) return new Map();

  const completedScans = await db
    .select({ id: scans.id, normalizedTarget: scans.normalizedTarget })
    .from(scans)
    .where(and(
      eq(scans.status, "completed"),
      getVisibleScansFilter(actor),
      inArray(scans.id, filteredScanIds),
    ));
  const attempts = await db
    .select({ id: scanAttempts.id, scanId: scanAttempts.scanId })
    .from(scanAttempts)
    .where(inArray(scanAttempts.scanId, completedScans.map((scan) => scan.id)))
    .orderBy(desc(scanAttempts.attemptNumber));
  const latestAttemptByScanId = new Map<string, string>();

  for (const attempt of attempts) {
    if (!latestAttemptByScanId.has(attempt.scanId)) {
      latestAttemptByScanId.set(attempt.scanId, attempt.id);
    }
  }

  const results = latestAttemptByScanId.size > 0
    ? await db
        .select({
          id: scanResults.id,
          scanId: scanResults.scanId,
          observedAt: scanResults.observedAt,
          input: scanResults.input,
          url: scanResults.url,
          finalUrl: scanResults.finalUrl,
          statusCode: scanResults.statusCode,
          faviconMmh3: scanResults.faviconMmh3,
          faviconMd5: scanResults.faviconMd5,
          faviconUrl: scanResults.faviconUrl,
          faviconPath: scanResults.faviconPath,
        })
        .from(scanResults)
        .where(inArray(scanResults.attemptId, [...latestAttemptByScanId.values()]))
    : [];
  const resultsByScanId = new Map<string, typeof results>();

  for (const result of results) {
    const existing = resultsByScanId.get(result.scanId) ?? [];
    existing.push(result);
    resultsByScanId.set(result.scanId, existing);
  }

  return new Map(completedScans.map((scan) => {
    const result = selectAuthoritativeScanResult(resultsByScanId.get(scan.id) ?? [], scan.normalizedTarget);
    const hasFaviconSource = Boolean(
      result?.faviconUrl
      || result?.faviconPath
      || result?.faviconMmh3
      || result?.faviconMd5
      || isHttpUrl(result?.finalUrl)
      || isHttpUrl(result?.url),
    );

    return [
      scan.id,
      result && hasFaviconSource
        ? `/api/v1/scans/${scan.id}/results/${result.id}/favicon`
        : null,
    ] as const;
  }));
}
