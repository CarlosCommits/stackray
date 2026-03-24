import { and, asc, eq, gt } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { scanEvents } from "@/lib/db/schema";
import { scanEventEnvelopeSchema } from "@/lib/contracts/events";
import type { ActorContext } from "@/lib/server/actor-context";
import { getWorkspaceScanRecord } from "@/lib/server/scans/read-service";

export interface PersistedScanEvent {
  id: number;
  envelope: ReturnType<typeof scanEventEnvelopeSchema.parse>;
  terminal: boolean;
}

export async function listWorkspaceScanEvents(
  actor: ActorContext,
  scanId: string,
  afterEventId = 0,
): Promise<PersistedScanEvent[] | null> {
  const scan = await getWorkspaceScanRecord(actor, scanId);

  if (!scan) {
    return null;
  }

  const rows = await db
    .select()
    .from(scanEvents)
    .where(and(eq(scanEvents.scanId, scanId), gt(scanEvents.id, afterEventId)))
    .orderBy(asc(scanEvents.id));

  return rows.map((row) => {
    const envelope = scanEventEnvelopeSchema.parse({
      event: row.eventType,
      data: row.payload,
    });

    return {
      id: row.id,
      envelope,
      terminal:
        row.eventType === "scan.complete" ||
        row.eventType === "scan.failed" ||
        row.eventType === "scan.cancelled",
    };
  });
}
