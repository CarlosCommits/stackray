import { z } from "zod";

import { cdnSchema, isoDateSchema } from "./common.ts";
import { scanPhaseKindSchema, scanPhaseStatusSchema } from "./scans.ts";

const scanStatusEventSchema = z.object({
  scanId: z.string(),
  status: z.enum(["running", "queued", "processing"]),
  attemptId: z.string().nullable(),
  recoveryReason: z.enum(["missing_http_probe_job_requeued", "worker_interrupted"]).optional(),
  at: isoDateSchema,
});

type QueuedScanStatusEventPayloadInput = {
  readonly scanId: string;
  readonly at?: Date;
  readonly recoveryReason?: z.infer<typeof scanStatusEventSchema>["recoveryReason"];
};

export function buildQueuedScanStatusEventPayload({
  scanId,
  at = new Date(),
  recoveryReason,
}: QueuedScanStatusEventPayloadInput): z.infer<typeof scanStatusEventSchema> {
  return {
    scanId,
    status: "queued",
    attemptId: null,
    ...(recoveryReason ? { recoveryReason } : {}),
    at: at.toISOString(),
  };
}

const scanProgressEventSchema = z.object({
  scanId: z.string(),
  resultCount: z.number().int().nonnegative(),
  subdomainCount: z.number().int().nonnegative().optional(),
  at: isoDateSchema,
});

const scanPhaseEventSchema = z.object({
  scanId: z.string(),
  attemptId: z.string(),
  resultId: z.string().nullable(),
  phase: scanPhaseKindSchema,
  status: scanPhaseStatusSchema,
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  queuedAt: isoDateSchema,
  startedAt: isoDateSchema.nullable(),
  completedAt: isoDateSchema.nullable(),
  at: isoDateSchema,
});

const scanResultEventSchema = z.object({
  scanId: z.string(),
  resultId: z.string(),
  target: z.string(),
  statusCode: z.number().int(),
  finalUrl: z.string(),
  title: z.string(),
  server: z.string().nullable(),
  cdn: cdnSchema,
  technologies: z.array(z.string()),
  at: isoDateSchema,
});

const scanCompleteEventSchema = z.object({
  scanId: z.string(),
  status: z.literal("completed"),
  resultCount: z.number().int().nonnegative(),
  at: isoDateSchema,
});

const scanCancelledEventSchema = z.object({
  scanId: z.string(),
  status: z.literal("cancelled"),
  at: isoDateSchema,
});

const scanFailedEventSchema = z.object({
  scanId: z.string(),
  status: z.literal("failed"),
  errorCode: z.string(),
  message: z.string(),
  at: isoDateSchema,
});

export const scanEventEnvelopeSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("scan.status"), data: scanStatusEventSchema }),
  z.object({ event: z.literal("scan.phase"), data: scanPhaseEventSchema }),
  z.object({ event: z.literal("scan.progress"), data: scanProgressEventSchema }),
  z.object({ event: z.literal("scan.result"), data: scanResultEventSchema }),
  z.object({ event: z.literal("scan.complete"), data: scanCompleteEventSchema }),
  z.object({ event: z.literal("scan.cancelled"), data: scanCancelledEventSchema }),
  z.object({ event: z.literal("scan.failed"), data: scanFailedEventSchema }),
]);

export type ScanEventEnvelope = z.infer<typeof scanEventEnvelopeSchema>;
