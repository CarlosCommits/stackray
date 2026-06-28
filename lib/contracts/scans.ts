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
  ipIntelligenceSchema,
  isoDateSchema,
  redirectChainSchema,
  scanStatusSchema,
  tlsSchema,
  wordpressSchema,
} from "@/lib/contracts/common";

export const createScanRequestSchema = z.object({
  target: z.string().min(1),
  options: z.object({
    followRedirects: z.boolean().default(true),
    includeRawResponse: z.boolean().default(false),
    headless: z.boolean().default(false),
  }),
  idempotencyKey: z.string().min(1).optional(),
  client: z.object({
    source: actorSourceSchema.exclude(["system"]),
  }).optional(),
});

export const createScanResponseSchema = z.object({
  scanId: z.string(),
  status: scanStatusSchema,
  reused: z.boolean(),
});

export const scanListItemSchema = z.object({
  scanId: z.string(),
  status: scanStatusSchema,
  source: actorSourceSchema,
  target: z.string(),
  faviconUrl: z.string().nullable(),
  submittedAt: isoDateSchema,
  completedAt: isoDateSchema.nullable(),
});

export const listScansResponseSchema = z.object({
  items: z.array(scanListItemSchema),
  nextCursor: z.string().nullable(),
});

const scanTargetSchema = z.object({
  inputTarget: z.string(),
  normalizedTarget: z.string(),
  canonicalTargetId: z.string().nullable(),
});

const scanProgressSchema = z.object({
  resultCount: z.number().int().nonnegative(),
  subdomainCount: z.number().int().nonnegative().optional(),
});

export const scanPhaseKindSchema = z.enum([
  "http_probe",
  "headless",
  "browser_fallback",
  "subfinder",
  "nuclei_dns",
  "nuclei_http",
  "ip_intel",
  "finalize",
]);

export const scanPhaseStatusSchema = z.enum(["queued", "running", "completed", "failed", "skipped", "cancelled"]);

export const scanPhaseRunSchema = z.object({
  phaseId: z.string(),
  scanId: z.string(),
  attemptId: z.string(),
  resultId: z.string().nullable(),
  phase: scanPhaseKindSchema,
  status: scanPhaseStatusSchema,
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  meta: z.record(z.string(), z.unknown()),
  queuedAt: isoDateSchema,
  startedAt: isoDateSchema.nullable(),
  completedAt: isoDateSchema.nullable(),
  updatedAt: isoDateSchema,
});

const scanAttemptSummarySchema = z.object({
  attemptId: z.string(),
  attemptNumber: z.number().int().positive(),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  requestProfile: z.enum(["baseline", "browser_headers"]),
  fallbackReason: z.string().nullable(),
  resultCount: z.number().int().nonnegative(),
  forbiddenResultCount: z.number().int().nonnegative(),
});

const subdomainDiscoveryStateSchema = z.enum(["not_run", "pending", "running", "completed", "failed", "skipped"]);

export const scanSubdomainSummarySchema = z.object({
  state: subdomainDiscoveryStateSchema,
  runId: z.string().nullable(),
  targetDomain: z.string().nullable(),
  resultCount: z.number().int().nonnegative(),
  engineVersion: z.string().nullable(),
  errorMessage: z.string().nullable(),
  startedAt: isoDateSchema.nullable(),
  completedAt: isoDateSchema.nullable(),
});

export const scanSubdomainItemSchema = z.object({
  subdomainId: z.string(),
  scanId: z.string(),
  host: z.string(),
  rootDomain: z.string(),
  ip: z.string().nullable(),
  source: z.string().nullable(),
  wildcardCertificate: z.boolean(),
  observedAt: isoDateSchema,
  rawSubfinder: z.record(z.string(), z.unknown()),
});

export const getScanResponseSchema = z.object({
  scanId: z.string(),
  status: scanStatusSchema,
  source: actorSourceSchema,
  target: scanTargetSchema,
  currentAttempt: scanAttemptSummarySchema,
  attemptHistory: z.array(scanAttemptSummarySchema),
  phases: z.array(scanPhaseRunSchema),
  progress: scanProgressSchema,
  subdomains: scanSubdomainSummarySchema,
});

const nucleiRunStatusSchema = z.enum(["pending", "running", "completed", "failed", "skipped"]);
const nucleiStateSchema = z.enum(["not_run", "pending", "running", "completed", "failed", "skipped"]);
const technologyBucketSchema = z.enum([
  "platform",
  "framework",
  "infrastructure",
  "business",
  "security",
  "ecosystem",
  "other",
]);
const technologyDetectionSourceSchema = z.enum(["wappalyzer", "wordpress", "cpe", "derived", "nuclei"]);
const technologyDetectionKindSchema = z.enum(["technology", "wordpress_plugin", "wordpress_theme", "cpe"]);

const technologyDetectionSchema = z.object({
  name: z.string(),
  version: z.string().nullable(),
  description: z.string().nullable(),
  website: z.string().nullable(),
  iconUrl: z.string().nullable(),
  categories: z.array(z.string()),
  primaryCategory: z.string().nullable(),
  bucket: technologyBucketSchema,
  sources: z.array(technologyDetectionSourceSchema),
  inferred: z.boolean(),
});

const nucleiMatchSchema = z.object({
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
  subject: z.string().nullable(),
  subjectType: z.string().nullable(),
  raw: z.record(z.string(), z.unknown()),
});

const nucleiRunSchema = z.object({
  status: nucleiRunStatusSchema,
  targetUrl: z.string().nullable(),
  targetHost: z.string().nullable(),
  originalDomainTarget: z.string().nullable(),
  finalDomainTarget: z.string().nullable(),
  domainTarget: z.string().nullable(),
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
  ipIntelligence: ipIntelligenceSchema.default(null),
  tls: tlsSchema,
  technologies: z.array(z.string()),
  technologyDetections: z.array(technologyDetectionSchema),
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

export const getScanSubdomainsResponseSchema = z.object({
  summary: scanSubdomainSummarySchema,
  items: z.array(scanSubdomainItemSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

export const technologyInventoryItemSchema = z.object({
  scanId: z.string(),
  resultId: z.string(),
  canonicalTargetId: z.string().nullable(),
  url: z.string(),
  kind: technologyDetectionKindSchema,
  sources: z.array(technologyDetectionSourceSchema),
  displayName: z.string(),
  normalizedName: z.string(),
  version: z.string().nullable(),
  description: z.string().nullable(),
  website: z.string().nullable(),
  iconUrl: z.string().nullable(),
  categories: z.array(z.string()),
  primaryCategory: z.string().nullable(),
  bucket: technologyBucketSchema,
  inferred: z.boolean(),
  vendor: z.string().nullable(),
  product: z.string().nullable(),
  cpe: z.string().nullable(),
});

export const getScanTechnologiesResponseSchema = z.object({
  items: z.array(technologyInventoryItemSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

export const getResultTechnologiesResponseSchema = z.object({
  items: z.array(technologyInventoryItemSchema),
  total: z.number().int().nonnegative(),
});

export const scanReportResponseSchema = z.object({
  scan: getScanResponseSchema.extend({
    submittedAt: isoDateSchema,
    completedAt: isoDateSchema.nullable(),
  }),
  authoritativeResult: z.object({
    resultId: z.string(),
    url: z.string(),
    finalUrl: z.string(),
    title: z.string(),
    statusCode: z.number().int(),
    server: z.string().nullable(),
    cdn: cdnSchema,
    screenshotUrl: z.string().nullable(),
    faviconUrl: z.string().nullable(),
  }).nullable(),
  technologies: z.object({
    scope: z.literal("authoritative"),
    items: z.array(technologyInventoryItemSchema),
    total: z.number().int().nonnegative(),
  }),
  infrastructure: z.object({
    dns: dnsSchema.nullable(),
    asn: asnSchema.nullable(),
    tls: tlsSchema.nullable(),
    capabilities: capabilitiesSchema.nullable(),
    ipIntelligence: ipIntelligenceSchema,
  }),
  subdomains: z.object({
    summary: scanSubdomainSummarySchema,
    sample: z.array(scanSubdomainItemSchema),
    total: z.number().int().nonnegative(),
    truncated: z.boolean(),
    next: z.string().nullable(),
  }),
  links: z.object({
    scan: z.string(),
    results: z.string(),
    technologies: z.string(),
    subdomains: z.string(),
    events: z.string(),
  }),
});

export type CreateScanRequest = z.infer<typeof createScanRequestSchema>;
export type CreateScanResponse = z.infer<typeof createScanResponseSchema>;
export type ScanListItem = z.infer<typeof scanListItemSchema>;
export type GetScanResponse = z.infer<typeof getScanResponseSchema>;
export type ScanPhaseRun = z.infer<typeof scanPhaseRunSchema>;
export type ScanResultItem = z.infer<typeof scanResultItemSchema>;
export type ScanSubdomainSummary = z.infer<typeof scanSubdomainSummarySchema>;
export type ScanSubdomainItem = z.infer<typeof scanSubdomainItemSchema>;
export type NucleiSchema = z.infer<typeof nucleiSchema>;
export type TechnologyInventoryItem = z.infer<typeof technologyInventoryItemSchema>;
export type ScanReportResponse = z.infer<typeof scanReportResponseSchema>;
