import { z } from "zod";

import { isoDateSchema } from "@/lib/contracts/common";

export const scanStatusEventSchema = z.object({
  scanId: z.string(),
  status: z.enum(["running", "queued", "processing"]),
  attemptId: z.string(),
  at: isoDateSchema,
});

export const scanProgressEventSchema = z.object({
  scanId: z.string(),
  processedTargets: z.number().int().nonnegative(),
  totalTargets: z.number().int().positive(),
  resultCount: z.number().int().nonnegative(),
  at: isoDateSchema,
});

export const scanResultEventSchema = z.object({
  scanId: z.string(),
  resultId: z.string(),
  target: z.string(),
  statusCode: z.number().int(),
  title: z.string(),
  technologies: z.array(z.string()),
  at: isoDateSchema,
});

export const scanCompleteEventSchema = z.object({
  scanId: z.string(),
  status: z.literal("completed"),
  resultCount: z.number().int().nonnegative(),
  at: isoDateSchema,
});

export const scanCancelledEventSchema = z.object({
  scanId: z.string(),
  status: z.literal("cancelled"),
  at: isoDateSchema,
});

export const scanFailedEventSchema = z.object({
  scanId: z.string(),
  status: z.literal("failed"),
  errorCode: z.string(),
  message: z.string(),
  at: isoDateSchema,
});

export const scanEventSchemas = {
  "scan.status": scanStatusEventSchema,
  "scan.progress": scanProgressEventSchema,
  "scan.result": scanResultEventSchema,
  "scan.complete": scanCompleteEventSchema,
  "scan.cancelled": scanCancelledEventSchema,
  "scan.failed": scanFailedEventSchema,
} as const;

export const scanEventEnvelopeSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("scan.status"), data: scanStatusEventSchema }),
  z.object({ event: z.literal("scan.progress"), data: scanProgressEventSchema }),
  z.object({ event: z.literal("scan.result"), data: scanResultEventSchema }),
  z.object({ event: z.literal("scan.complete"), data: scanCompleteEventSchema }),
  z.object({ event: z.literal("scan.cancelled"), data: scanCancelledEventSchema }),
  z.object({ event: z.literal("scan.failed"), data: scanFailedEventSchema }),
]);

export type ScanEventEnvelope = z.infer<typeof scanEventEnvelopeSchema>;
