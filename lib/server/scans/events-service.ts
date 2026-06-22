import { and, asc, desc, eq, gt } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { scanEvents } from "@/lib/db/schema";
import { scanEventEnvelopeSchema } from "@/lib/contracts/events";
import type { ActorContext } from "@/lib/session/actor-context";
import { getScanRecord } from "@/lib/server/scans/read-service";

interface PersistedScanEvent {
  id: number;
  envelope: ReturnType<typeof scanEventEnvelopeSchema.parse>;
  terminal: boolean;
}

export async function listScanEvents(
  actor: ActorContext,
  scanId: string,
  afterEventId = 0,
): Promise<PersistedScanEvent[] | null> {
  const scan = await getScanRecord(actor, scanId);

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

export async function getLatestScanEventId(actor: ActorContext, scanId: string): Promise<number | null> {
  const scan = await getScanRecord(actor, scanId);

  if (!scan) {
    return null;
  }

  const [latestEvent] = await db
    .select({ id: scanEvents.id })
    .from(scanEvents)
    .where(eq(scanEvents.scanId, scanId))
    .orderBy(desc(scanEvents.id))
    .limit(1);

  return latestEvent?.id ?? 0;
}
