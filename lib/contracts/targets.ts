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
  screenshotUrl: z.string().nullable(),
});

export const targetResultsResponseSchema = z.object({
  items: z.array(targetResultItemSchema),
  nextCursor: z.string().nullable(),
});

export const technologyComparisonItemSchema = z.object({
  canonicalTargetId: z.string(),
  normalizedTarget: z.string(),
  latestScanId: z.string(),
  title: z.string(),
  technologies: z.array(z.string()),
  matchedTechnology: z.string(),
  matchedTechnologyIconUrl: z.string().nullable(),
  matchedTechnologies: z.array(z.object({
    name: z.string(),
    iconUrl: z.string().nullable(),
  })),
  lastScannedAt: isoDateSchema,
  faviconUrl: z.string().nullable(),
  screenshotUrl: z.string().nullable(),
});

export const technologyComparisonResponseSchema = z.object({
  technology: z.string(),
  technologies: z.array(z.string()),
  items: z.array(technologyComparisonItemSchema),
});

export const technologyComparisonOptionSchema = z.object({
  name: z.string(),
  iconUrl: z.string().nullable(),
  matchCount: z.number().int().nonnegative(),
});

export const technologyComparisonCombinationSchema = z.object({
  technologies: z.array(technologyComparisonOptionSchema),
  matchCount: z.number().int().nonnegative(),
});

export const technologyComparisonOptionsResponseSchema = z.object({
  items: z.array(technologyComparisonOptionSchema),
  suggestedCombinations: z.array(technologyComparisonCombinationSchema).default([]),
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
export type TechnologyComparisonItem = z.infer<typeof technologyComparisonItemSchema>;
export type TechnologyComparisonOption = z.infer<typeof technologyComparisonOptionSchema>;
export type TechnologyComparisonCombination = z.infer<typeof technologyComparisonCombinationSchema>;
