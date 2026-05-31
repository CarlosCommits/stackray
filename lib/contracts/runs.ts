import { z } from "zod";

import { actorSourceSchema, isoDateSchema, scanStatusSchema } from "@/lib/contracts/common";

const runsStatusValueSchema = z.enum(["queued", "running", "completed", "failed", "cancelled"]);

export const runsSortSchema = z.enum(["newest", "oldest"]);

const runsRowSchema = z.object({
  scanId: z.string(),
  href: z.string(),
  submittedAt: z.object({
    iso: isoDateSchema,
    label: z.string(),
  }),
  targetCount: z.object({
    value: z.number().int().nonnegative(),
    label: z.string(),
  }),
  targetUrls: z.array(z.string()),
  hiddenTargetCount: z.number().int().nonnegative(),
  faviconUrl: z.string().nullable(),
  status: z.object({
    rawValue: scanStatusSchema,
    value: runsStatusValueSchema,
    label: z.string(),
  }),
  source: z.object({
    value: actorSourceSchema,
    label: z.string(),
  }),
  createdBy: z.object({
    label: z.string(),
    kind: z.enum(["user", "apiKey", "system", "unknown"]),
    userId: z.string().nullable(),
    apiKeyId: z.string().nullable(),
  }),
  duration: z.object({
    label: z.string(),
    milliseconds: z.number().int().nonnegative().nullable(),
    submittedAtIso: isoDateSchema,
    completedAtIso: isoDateSchema.nullable(),
  }),
  topTechnologies: z.object({
    visibleItems: z.array(z.string()),
    totalCount: z.number().int().nonnegative(),
    hiddenCount: z.number().int().nonnegative(),
    truncated: z.boolean(),
    overflowLabel: z.string().nullable(),
    searchTokens: z.array(z.string()),
  }),
  filters: z.object({
    hiddenTargets: z.array(z.string()),
  }),
});

export const runsListQuerySchema = z.object({
  q: z.string().nullable(),
  status: runsStatusValueSchema.nullable(),
  source: actorSourceSchema.nullable(),
  sort: runsSortSchema,
  cursor: z.string().nullable(),
  limit: z.number().int().positive(),
});

export const listRunsResponseSchema = z.object({
  items: z.array(runsRowSchema),
  nextCursor: z.string().nullable(),
});

export type RunsListQuery = z.infer<typeof runsListQuerySchema>;
export type RunsListResponse = z.infer<typeof listRunsResponseSchema>;
export type RunsSort = z.infer<typeof runsSortSchema>;
