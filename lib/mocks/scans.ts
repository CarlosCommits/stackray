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
      profile: "stack-deep",
      source: "ui",
      targetCount: 1,
      submittedAt: toIsoString(now),
      completedAt: toIsoString(new Date(now.getTime() + 12_000)),
    },
    {
      scanId: "scn_01J_demo_running",
      status: "running",
      profile: "stack-deep",
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
  profile: "stack-deep",
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
      input: "https://tpss.coop",
      url: "https://tpss.coop",
      finalUrl: "https://tpss.coop",
      path: "/",
      method: "GET",
      title: "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      statusCode: 200,
      server: "Flywheel/5.1.0",
      location: null,
      contentType: "text/html; charset=UTF-8",
      contentLength: 12345,
      responseTimeMs: 187,
      cdn: {
        enabled: true,
        name: "fastly",
        type: "cdn",
      },
      dns: {
        hostIp: "104.18.7.192",
        a: ["104.18.7.192"],
        aaaa: [],
        cname: [],
        resolvers: ["1.1.1.1:53"],
      },
      asn: {
        asNumber: "13335",
        org: "Cloudflare, Inc.",
      },
      tls: {
        sni: "tpss.coop",
        jarmHash: "29d29d00029d29d00041d41d00041d58f2ddf8c48d3aa4f8c9e5d4c5a4a2df",
        certificate: {},
      },
      technologies: ["WordPress", "WooCommerce", "PHP", "Jetpack"],
      wordpress: {
        plugins: ["jetpack", "ajax-search-for-woocommerce"],
        themes: ["pro"],
      },
      cpe: [
        {
          cpe: "cpe:2.3:a:webp_server_go:webp_server_go:*:*:*:*:*:*:*:*",
          vendor: "webp_server_go",
          product: "webp_server_go",
        },
      ],
      favicon: {
        mmh3: "1494302000",
        md5: "55a0d5d0ab8c2458921f7fef7d5ec6d0",
        url: "https://tpss.coop/favicon.ico",
        path: "/favicon.ico",
      },
      hashes: {
        md5: "ad2f7e2ff7f736a0e1c0c8614ed0b50d",
        mmh3: "1494302000",
        sha256: "8e0cc5a0f6d50243bb7f73ad92f8a50e4ec6e18cb6dc9f71655df94df6e7f8f2",
      },
      capabilities: {
        http2: true,
        pipeline: false,
        websocket: false,
        vhost: false,
      },
      redirectChain: {
        statusCodes: [301, 200],
        items: [],
      },
      bodyPreview: "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      bodyDomains: [],
      bodyFqdns: [],
      rawHttpx: {
        timestamp: toIsoString(now),
        webserver: "Flywheel/5.1.0",
        tech: ["WordPress", "WooCommerce", "PHP", "Jetpack"],
      },
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
      finalUrl: "https://tpss.coop",
      title: "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      server: "Flywheel/5.1.0",
      cdn: {
        enabled: true,
        name: "fastly",
        type: "cdn",
      },
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
