import {
  type CreateScanResponse,
  createScanResponseSchema,
  getScanResponseSchema,
  getScanResultsResponseSchema,
  listScansResponseSchema,
} from "@/lib/contracts/scans";
import { scanEventEnvelopeSchema, type ScanEventEnvelope } from "@/lib/contracts/events";
import { savedSearchSchema, searchResultsResponseSchema, targetHistoryResponseSchema } from "@/lib/contracts/search";

const now = new Date("2026-03-23T16:00:00.000Z");

function toIsoString(value: Date): string {
  return value.toISOString();
}

export const mockSavedSearches = [
  savedSearchSchema.parse({
    id: "ss_01",
    name: "WordPress + WooCommerce",
    pinned: true,
    queryDescription: "Technology = WordPress, WooCommerce",
  }),
  savedSearchSchema.parse({
    id: "ss_02",
    name: "Behind Fastly",
    pinned: false,
    queryDescription: "CDN = Fastly",
  }),
];

export const mockScanList = listScansResponseSchema.parse({
  items: [
    {
      scanId: "scn_01J_demo_recent",
      status: "completed",
      profile: "stack-default",
      source: "ui",
      targetCount: 1,
      submittedAt: toIsoString(now),
      completedAt: toIsoString(new Date(now.getTime() + 12_000)),
    },
    {
      scanId: "scn_01J_demo_running",
      status: "running",
      profile: "stack-js",
      source: "ui",
      targetCount: 1,
      submittedAt: toIsoString(new Date(now.getTime() - 120_000)),
      completedAt: null,
    },
  ],
  nextCursor: null,
});

export const mockCreateScanResponse: CreateScanResponse = createScanResponseSchema.parse({
  scanId: "scn_01J_demo_created",
  status: "queued",
  reused: false,
});

export const mockScanDetail = getScanResponseSchema.parse({
  scanId: "scn_01J_demo_recent",
  status: "running",
  profile: "stack-default",
  source: "ui",
  targets: [
    {
      scanTargetId: "tgt_01J_demo",
      inputTarget: "https://tpss.coop",
      normalizedTarget: "https://tpss.coop",
    },
  ],
  currentAttempt: {
    attemptId: "att_01J_demo",
    attemptNumber: 1,
    status: "running",
  },
  progress: {
    processedTargets: 1,
    totalTargets: 1,
    resultCount: 1,
  },
});

export const mockScanResults = getScanResultsResponseSchema.parse({
  items: [
    {
      resultId: "res_01J_demo",
      target: "https://tpss.coop",
      url: "https://tpss.coop",
      title: "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      statusCode: 200,
      server: "Flywheel/5.1.0",
      cdn: {
        enabled: true,
        name: "fastly",
        type: "cdn",
      },
      technologies: ["WordPress", "WooCommerce", "PHP", "Jetpack"],
      wordpress: {
        plugins: ["jetpack", "ajax-search-for-woocommerce"],
        themes: ["pro"],
      },
      cpe: ["cpe:2.3:a:webp_server_go:webp_server_go:*:*:*:*:*:*:*:*"],
    },
  ],
  page: 1,
  pageSize: 20,
  total: 1,
});

export const mockSearchResults = searchResultsResponseSchema.parse({
  items: [
    {
      canonicalTargetId: "ctg_01J_demo",
      normalizedTarget: "https://tpss.coop",
      latestScanId: "scn_01J_demo_recent",
      title: "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      technologies: ["WordPress", "WooCommerce", "PHP"],
      lastScannedAt: toIsoString(new Date(now.getTime() - 30_000)),
    },
    {
      canonicalTargetId: "ctg_01J_github",
      normalizedTarget: "https://github.com",
      latestScanId: "scn_01J_github",
      title: "GitHub · Build and ship software on a single, collaborative platform",
      technologies: ["Ruby on Rails", "MySQL", "GitHub Enterprise"],
      lastScannedAt: toIsoString(new Date(now.getTime() - 3600_000)),
    },
  ],
  nextCursor: null,
});

export const mockTargetHistory = targetHistoryResponseSchema.parse({
  canonicalTargetId: "ctg_01J_demo",
  normalizedTarget: "https://tpss.coop",
  items: [
    {
      scanId: "scn_01J_demo_recent",
      status: "completed",
      title: "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      technologies: ["WordPress", "WooCommerce", "PHP"],
      completedAt: toIsoString(new Date(now.getTime() - 30_000)),
    },
    {
      scanId: "scn_01J_demo_previous",
      status: "completed",
      title: "Takoma Park Silver Spring Co-op",
      technologies: ["WordPress", "PHP"],
      completedAt: toIsoString(new Date(now.getTime() - 86_400_000)),
    },
  ],
});

export const mockScanEvents: ScanEventEnvelope[] = [
  scanEventEnvelopeSchema.parse({
    event: "scan.status",
    data: {
      scanId: "scn_01J_demo_recent",
      status: "running",
      attemptId: "att_01J_demo",
      at: toIsoString(new Date(now.getTime() - 15_000)),
    },
  }),
  scanEventEnvelopeSchema.parse({
    event: "scan.progress",
    data: {
      scanId: "scn_01J_demo_recent",
      processedTargets: 1,
      totalTargets: 1,
      resultCount: 1,
      at: toIsoString(new Date(now.getTime() - 10_000)),
    },
  }),
  scanEventEnvelopeSchema.parse({
    event: "scan.result",
    data: {
      scanId: "scn_01J_demo_recent",
      resultId: "res_01J_demo",
      target: "https://tpss.coop",
      statusCode: 200,
      title: "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      technologies: ["WordPress", "WooCommerce", "PHP"],
      at: toIsoString(new Date(now.getTime() - 9_000)),
    },
  }),
  scanEventEnvelopeSchema.parse({
    event: "scan.complete",
    data: {
      scanId: "scn_01J_demo_recent",
      status: "completed",
      resultCount: 1,
      at: toIsoString(new Date(now.getTime() - 8_000)),
    },
  }),
];
