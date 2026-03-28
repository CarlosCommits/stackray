import { z } from "zod";

import {
  actorSourceSchema,
  asnSchema,
  capabilitiesSchema,
  cdnSchema,
  cpeItemSchema,
  dnsSchema,
  faviconSchema,
  screenshotSchema,
  hashesSchema,
  isoDateSchema,
  redirectChainSchema,
  scanProfileSchema,
  scanStatusSchema,
  tlsSchema,
  wordpressSchema,
} from "@/lib/contracts/common";

export const createScanRequestSchema = z.object({
  targets: z.array(z.string().min(1)).min(1),
  profile: scanProfileSchema.default("stack-deep"),
  options: z.object({
    followRedirects: z.boolean().default(true),
    includeRawResponse: z.boolean().default(false),
    headless: z.boolean().default(false),
  }),
  idempotencyKey: z.string().min(1).optional(),
  client: z.object({
    source: actorSourceSchema.exclude(["system"]),
  }),
});

export const createScanResponseSchema = z.object({
  scanId: z.string(),
  status: scanStatusSchema,
  reused: z.boolean(),
});

export const scanListItemSchema = z.object({
  scanId: z.string(),
  status: scanStatusSchema,
  profile: scanProfileSchema,
  source: actorSourceSchema,
  targetCount: z.number().int().nonnegative(),
  submittedAt: isoDateSchema,
  completedAt: isoDateSchema.nullable(),
});

export const listScansResponseSchema = z.object({
  items: z.array(scanListItemSchema),
  nextCursor: z.string().nullable(),
});

export const scanTargetSchema = z.object({
  scanTargetId: z.string(),
  inputTarget: z.string(),
  normalizedTarget: z.string(),
});

export const scanProgressSchema = z.object({
  processedTargets: z.number().int().nonnegative(),
  totalTargets: z.number().int().positive(),
  resultCount: z.number().int().nonnegative(),
});

export const scanAttemptSummarySchema = z.object({
  attemptId: z.string(),
  attemptNumber: z.number().int().positive(),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  requestProfile: z.enum(["baseline", "browser_headers", "tlsi_final_url"]),
  fallbackReason: z.string().nullable(),
  resultCount: z.number().int().nonnegative(),
  forbiddenResultCount: z.number().int().nonnegative(),
});

export const getScanResponseSchema = z.object({
  scanId: z.string(),
  status: scanStatusSchema,
  profile: scanProfileSchema,
  source: actorSourceSchema,
  targets: z.array(scanTargetSchema),
  currentAttempt: scanAttemptSummarySchema,
  attemptHistory: z.array(scanAttemptSummarySchema),
  progress: scanProgressSchema,
});

export const nucleiRunStatusSchema = z.enum(["pending", "running", "completed", "failed", "skipped"]);
export const nucleiStateSchema = z.enum(["not_run", "pending", "running", "completed", "failed", "skipped"]);

export const nucleiMatchSchema = z.object({
  matchId: z.string(),
  templateId: z.string(),
  templatePath: z.string().nullable(),
  matcherName: z.string().nullable(),
  protocolType: z.string().nullable(),
  severity: z.string().nullable(),
  matchedAt: z.string().nullable(),
  host: z.string().nullable(),
  ip: z.string().nullable(),
  port: z.string().nullable(),
  scheme: z.string().nullable(),
  url: z.string().nullable(),
  path: z.string().nullable(),
  extractedResults: z.array(z.string()),
  technologyName: z.string().nullable(),
  technologyVersion: z.string().nullable(),
  findingKind: z.string(),
  raw: z.record(z.string(), z.unknown()),
});

export const nucleiRunSchema = z.object({
  status: nucleiRunStatusSchema,
  targetUrl: z.string().nullable(),
  targetHost: z.string().nullable(),
  headers: z.array(z.string()),
  templateIds: z.array(z.string()),
  engineVersion: z.string().nullable(),
  templatesVersion: z.string().nullable(),
  errorMessage: z.string().nullable(),
  startedAt: isoDateSchema.nullable(),
  completedAt: isoDateSchema.nullable(),
});

export const nucleiSchema = z.object({
  state: nucleiStateSchema,
  run: nucleiRunSchema.nullable(),
  technologies: z.array(nucleiMatchSchema),
  findings: z.array(nucleiMatchSchema),
});

export const scanResultItemSchema = z.object({
  resultId: z.string(),
  target: z.string(),
  input: z.string(),
  url: z.string(),
  finalUrl: z.string(),
  path: z.string(),
  method: z.string(),
  title: z.string(),
  statusCode: z.number().int(),
  server: z.string().nullable(),
  location: z.string().nullable(),
  contentType: z.string().nullable(),
  contentLength: z.number().int().nonnegative(),
  responseTimeMs: z.number().int().nonnegative(),
  cdn: cdnSchema,
  dns: dnsSchema,
  asn: asnSchema,
  tls: tlsSchema,
  technologies: z.array(z.string()),
  wordpress: wordpressSchema,
  cpe: z.array(cpeItemSchema),
  favicon: faviconSchema,
  screenshot: screenshotSchema,
  hashes: hashesSchema,
  capabilities: capabilitiesSchema,
  redirectChain: redirectChainSchema,
  bodyPreview: z.string(),
  bodyDomains: z.array(z.string()),
  bodyFqdns: z.array(z.string()),
  rawHttpx: z.record(z.string(), z.unknown()),
  nuclei: nucleiSchema,
});

export const getScanResultsResponseSchema = z.object({
  items: z.array(scanResultItemSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

export const compareScansResponseSchema = z.object({
  scanId: z.string(),
  baselineScanId: z.string(),
  summary: z.object({
    addedTechnologies: z.number().int().nonnegative(),
    removedTechnologies: z.number().int().nonnegative(),
    changedTargets: z.number().int().nonnegative(),
  }),
  changes: z.object({
    technologiesAdded: z.array(z.string()),
    technologiesRemoved: z.array(z.string()),
    metadata: z.array(
      z.object({
        field: z.string(),
        before: z.string().nullable(),
        after: z.string().nullable(),
      }),
    ),
  }),
});

export type CreateScanRequest = z.infer<typeof createScanRequestSchema>;
export type CreateScanResponse = z.infer<typeof createScanResponseSchema>;
export type ScanListItem = z.infer<typeof scanListItemSchema>;
export type GetScanResponse = z.infer<typeof getScanResponseSchema>;
export type ScanResultItem = z.infer<typeof scanResultItemSchema>;
