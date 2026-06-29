import { scanEvents, scanResults, scans } from "../drizzle/schema.ts";
import { db } from "./db.ts";
import { buildStoredResultVisibleTechnologies } from "./result-detections.ts";
import { getPersistedTechnologyNames } from "./result-persistence.ts";

type ScanRow = typeof scans.$inferSelect;
type ScanResultRow = typeof scanResults.$inferSelect;

export async function emitResultEventForRow(result: ScanResultRow, target: Pick<ScanRow, "normalizedTarget">) {
  const persistedTechnologyNames = await getPersistedTechnologyNames(result.id);
  const visibleTechnologies = buildStoredResultVisibleTechnologies(result, [], persistedTechnologyNames ?? undefined);

  await db.insert(scanEvents).values({
    scanId: result.scanId,
    attemptId: result.attemptId,
    eventType: "scan.result",
    payload: {
      scanId: result.scanId,
      resultId: result.id,
      target: target.normalizedTarget,
      statusCode: result.statusCode ?? 0,
      finalUrl: result.finalUrl ?? result.url ?? target.normalizedTarget,
      title: result.title ?? "",
      server: result.webServer ?? null,
      cdn: {
        enabled: Boolean(result.cdn || result.cdnName || result.cdnType),
        name: result.cdnName ?? null,
        type: result.cdnType ?? null,
      },
      technologies: visibleTechnologies,
      screenshotAvailable: Boolean(result.screenshotObjectKey),
      at: new Date().toISOString(),
    },
  });
}
