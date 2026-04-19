import { z } from "zod";

import { cdnSchema, isoDateSchema } from "@/lib/contracts/common";

const scanStatusEventSchema = z.object({
  scanId: z.string(),
  status: z.enum(["running", "queued", "processing"]),
  attemptId: z.string(),
  at: isoDateSchema,
});

const scanProgressEventSchema = z.object({
  scanId: z.string(),
  resultCount: z.number().int().nonnegative(),
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

const scanEventSchemas = {
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
