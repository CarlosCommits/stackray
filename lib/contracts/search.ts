import { z } from "zod";

import { isoDateSchema } from "@/lib/contracts/common";

export const searchModeSchema = z.enum(["latest", "snapshots"]);

export const searchResultItemSchema = z.object({
  canonicalTargetId: z.string(),
  normalizedTarget: z.string(),
  latestScanId: z.string(),
  title: z.string(),
  technologies: z.array(z.string()),
  lastScannedAt: isoDateSchema,
});

export const searchResultsResponseSchema = z.object({
  items: z.array(searchResultItemSchema),
  nextCursor: z.string().nullable(),
});

export const targetHistoryItemSchema = z.object({
  scanId: z.string(),
  status: z.enum(["completed", "failed", "cancelled"]),
  title: z.string(),
  technologies: z.array(z.string()),
  completedAt: isoDateSchema,
});

export const targetHistoryResponseSchema = z.object({
  canonicalTargetId: z.string(),
  normalizedTarget: z.string(),
  items: z.array(targetHistoryItemSchema),
});

export const savedSearchSchema = z.object({
  id: z.string(),
  name: z.string(),
  pinned: z.boolean(),
  queryDescription: z.string(),
});

export type SearchResultItem = z.infer<typeof searchResultItemSchema>;
export type SavedSearch = z.infer<typeof savedSearchSchema>;
