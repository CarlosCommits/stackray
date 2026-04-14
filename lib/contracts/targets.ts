import { z } from "zod";

import { isoDateSchema, scanStatusSchema } from "@/lib/contracts/common";
import { technologyInventoryItemSchema } from "@/lib/contracts/scans";

export const targetResultItemSchema = z.object({
  canonicalTargetId: z.string(),
  normalizedTarget: z.string(),
  latestScanId: z.string(),
  title: z.string(),
  technologies: z.array(z.string()),
  lastScannedAt: isoDateSchema,
  faviconUrl: z.string().nullable(),
});

export const targetResultsResponseSchema = z.object({
  items: z.array(targetResultItemSchema),
  nextCursor: z.string().nullable(),
});

const targetHistoryItemSchema = z.object({
  scanId: z.string(),
  status: scanStatusSchema,
  title: z.string(),
  technologies: z.array(z.string()),
  submittedAt: isoDateSchema,
  completedAt: isoDateSchema.nullable(),
});

export const targetHistoryResponseSchema = z.object({
  canonicalTargetId: z.string(),
  normalizedTarget: z.string(),
  items: z.array(targetHistoryItemSchema),
});

export const getTargetTechnologiesResponseSchema = z.object({
  canonicalTargetId: z.string(),
  normalizedTarget: z.string(),
  latestScanId: z.string().nullable(),
  scanId: z.string().nullable(),
  lastScannedAt: isoDateSchema.nullable(),
  items: z.array(technologyInventoryItemSchema),
});

export type TargetResultItem = z.infer<typeof targetResultItemSchema>;
