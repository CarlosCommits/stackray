import { and, eq } from "drizzle-orm";

import {
  scanResultDetections,
  scanResults,
} from "../drizzle/schema.ts";
import { db } from "./db.ts";
import {
  buildScreenshotTechnologyDetectionRows,
  buildStoredResultSearchDocument,
  collectUniqueTechnologyNames,
  toObject,
} from "./result-detections.ts";

type ScanResultRow = typeof scanResults.$inferSelect;

export async function getPersistedTechnologyNames(resultId: string) {
  const rows = await db
    .select({
      name: scanResultDetections.name,
    })
    .from(scanResultDetections)
    .where(and(eq(scanResultDetections.resultId, resultId), eq(scanResultDetections.kind, "technology")));

  if (rows.length === 0) {
    return null;
  }

  return collectUniqueTechnologyNames(rows.map((row) => row.name));
}

export async function updateResultSearchDocument(result: ScanResultRow, nucleiTechnologyNames: readonly string[]) {
  const persistedTechnologyNames = await getPersistedTechnologyNames(result.id);

  await db
    .update(scanResults)
    .set({
      searchDocument: buildStoredResultSearchDocument(result, nucleiTechnologyNames, persistedTechnologyNames ?? undefined),
    })
    .where(eq(scanResults.id, result.id));
}

export async function persistResultRawJsonPatch(result: ScanResultRow, patch: Record<string, unknown>) {
  const [updatedResult] = await db
    .update(scanResults)
    .set({
      rawJson: {
        ...toObject(result.rawJson),
        ...patch,
      },
    })
    .where(eq(scanResults.id, result.id))
    .returning();

  return updatedResult ?? result;
}

export async function mergeScreenshotTechnologies(resultId: string, technologies: readonly string[]) {
  if (technologies.length === 0) {
    return [];
  }

  const existingDetections = await db
    .select({
      kind: scanResultDetections.kind,
      source: scanResultDetections.source,
      name: scanResultDetections.name,
      version: scanResultDetections.version,
      slug: scanResultDetections.slug,
      cpe: scanResultDetections.cpe,
    })
    .from(scanResultDetections)
    .where(
      and(
        eq(scanResultDetections.resultId, resultId),
        eq(scanResultDetections.kind, "technology"),
        eq(scanResultDetections.source, "wappalyzer"),
      ),
    );

  const detectionRows = buildScreenshotTechnologyDetectionRows({
    resultId,
    technologies,
    existingDetections,
  });

  if (detectionRows.length > 0) {
    await db.insert(scanResultDetections).values(detectionRows);
  }

  return detectionRows;
}
