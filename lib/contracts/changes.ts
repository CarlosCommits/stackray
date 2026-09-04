import { z } from "zod";

import { CHANGE_FEED_PREVIEW_MAX_LENGTH } from "../changes/feed.ts";

export const changeCategorySchema = z.enum([
  "availability",
  "content",
  "infrastructure",
  "tls",
  "technology",
  "discovery",
  "security",
]);
export const comparisonStatusSchema = z.enum(["pending", "completed", "failed", "incompatible"]);

const boundedEvidenceSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
  z.record(z.string(), z.unknown()),
  z.null(),
]);

export const scanChangeItemSchema = z.object({
  id: z.string(),
  category: changeCategorySchema,
  changeType: z.string().min(1),
  fieldPath: z.string().min(1),
  summary: z.string().min(1),
  endpointIdentity: z.string().nullable(),
  before: boundedEvidenceSchema.optional(),
  after: boundedEvidenceSchema.optional(),
  alertEligible: z.boolean(),
});

export const changeFeedItemSchema = scanChangeItemSchema.pick({
  id: true,
  category: true,
  changeType: true,
  summary: true,
}).extend({
  preview: z.string().max(CHANGE_FEED_PREVIEW_MAX_LENGTH).nullable(),
});

export const comparisonScanReferenceSchema = z.object({
  id: z.string(),
  target: z.string(),
  completedAt: z.string().nullable(),
});

export const comparisonCurrentScanReferenceSchema = comparisonScanReferenceSchema.extend({
  faviconUrl: z.string().nullable().default(null),
});

export const scanComparisonSchema = z.object({
  id: z.string(),
  canonicalTargetId: z.string().nullable().optional(),
  status: comparisonStatusSchema,
  algorithmVersion: z.number().int().positive(),
  currentScan: comparisonCurrentScanReferenceSchema,
  baselineScan: comparisonScanReferenceSchema,
  baselineMode: z.enum(["previous", "pinned", "ad_hoc"]),
  counts: z.object({
    total: z.number().int().nonnegative(),
    alertEligible: z.number().int().nonnegative(),
  }),
  items: z.array(scanChangeItemSchema),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
});

export const changeFeedComparisonSchema = scanComparisonSchema.extend({
  counts: scanComparisonSchema.shape.counts.extend({
    matching: z.number().int().nonnegative(),
  }),
  items: z.array(changeFeedItemSchema),
  itemsTruncated: z.boolean(),
});

export const comparisonBaselineOptionSchema = comparisonScanReferenceSchema.extend({
  selected: z.boolean(),
  pinned: z.boolean(),
});

export const scanComparisonResponseSchema = z.object({
  comparison: scanComparisonSchema.nullable(),
  baselineOptions: z.array(comparisonBaselineOptionSchema),
  state: z.enum(["ready", "baseline_established", "pending", "failed", "incompatible"]),
  canManageBaseline: z.boolean(),
});

export const changeFeedQuerySchema = z.object({
  cursor: z.string().nullable().default(null),
  limit: z.number().int().positive().max(100).default(30),
  category: changeCategorySchema.nullable().default(null),
  target: z.string().trim().max(256).nullable().default(null),
});

export const changeFeedResponseSchema = z.object({
  items: z.array(changeFeedComparisonSchema),
  nextCursor: z.string().nullable(),
});

export const changeHistoryResponseSchema = z.object({
  items: z.array(scanComparisonSchema),
  nextCursor: z.string().nullable(),
});

export const updateMonitoringBaselineRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("previous") }),
  z.object({ mode: z.literal("pinned"), scanId: z.string().min(1) }),
]);

export type ChangeCategory = z.infer<typeof changeCategorySchema>;
export type ScanChangeItem = z.infer<typeof scanChangeItemSchema>;
export type ChangeFeedItem = z.infer<typeof changeFeedItemSchema>;
export type ScanComparison = z.infer<typeof scanComparisonSchema>;
export type ChangeFeedComparison = z.infer<typeof changeFeedComparisonSchema>;
export type ScanComparisonResponse = z.infer<typeof scanComparisonResponseSchema>;
export type ChangeFeedQuery = z.infer<typeof changeFeedQuerySchema>;
export type ChangeFeedResponse = z.infer<typeof changeFeedResponseSchema>;
export type ChangeHistoryResponse = z.infer<typeof changeHistoryResponseSchema>;
export type UpdateMonitoringBaselineRequest = z.infer<typeof updateMonitoringBaselineRequestSchema>;
