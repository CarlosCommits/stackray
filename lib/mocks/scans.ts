import {
  type CreateScanResponse,
  type ScanListItem,
  createScanResponseSchema,
  getScanResponseSchema,
  getScanResultsResponseSchema,
  listScansResponseSchema,
} from "@/lib/contracts/scans";
import { scanEventEnvelopeSchema, type ScanEventEnvelope } from "@/lib/contracts/events";
import type { RunsRowEnrichment } from "@/lib/queries/runs.types";
import { savedSearchSchema } from "@/lib/contracts/saved-searches";
import { targetHistoryResponseSchema, targetResultsResponseSchema } from "@/lib/contracts/targets";
import { buildStructuredTechnologyDetection } from "@/lib/server/scans/technology-catalog";

const now = new Date("2026-03-23T16:00:00.000Z");
const demoRecentTarget = "https://tpss.coop";
const demoRunningTarget = "https://queue.example.com";
const demoRecentTechnologies = ["WordPress", "WooCommerce", "PHP", "Jetpack", "MySQL", "Nginx"] as const;
const demoRunningTechnologies = ["Next.js", "PostgreSQL"] as const;

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
  savedSearchSchema.parse({
    id: "ss_03",
    name: "Cloudflare Login Pages",
    pinned: false,
    queryDescription: "Title contains Login, CDN = Cloudflare",
  }),
  savedSearchSchema.parse({
    id: "ss_04",
    name: "Next.js Marketing Sites",
    pinned: true,
    queryDescription: "Technology = Next.js, tag = marketing",
  }),
  savedSearchSchema.parse({
    id: "ss_05",
    name: "Regional Rails Apps",
    pinned: false,
    queryDescription: "Technology = Ruby on Rails, Region = us-east",
  }),
  savedSearchSchema.parse({
    id: "ss_06",
    name: "Shopify Storefronts",
    pinned: true,
    queryDescription: "Technology = Shopify",
  }),
];

const mockScanListItems = [
  {
    scanId: "scn_01J_demo_recent",
    status: "completed",
    source: "ui",
    targetCount: 1,
    submittedAt: toIsoString(now),
    completedAt: toIsoString(new Date(now.getTime() + 12_000)),
  },
  {
    scanId: "scn_01J_demo_running",
    status: "running",
    source: "ui",
    targetCount: 1,
    submittedAt: toIsoString(new Date(now.getTime() - 120_000)),
    completedAt: null,
  },
] as const satisfies readonly ScanListItem[];

export const mockScanList = listScansResponseSchema.parse({
  items: mockScanListItems,
  nextCursor: null,
});

type MockScanId = (typeof mockScanListItems)[number]["scanId"];

export const mockScanListEnrichmentByScanId = {
  scn_01J_demo_recent: {
    createdBy: {
      label: "Ada Lovelace",
      kind: "user",
      userId: "usr_01_demo_ada",
      tokenId: null,
    },
    hiddenTargets: [demoRecentTarget, demoRecentTarget.replace(/^https?:\/\//, "")],
    topTechnologies: [...demoRecentTechnologies],
  },
  scn_01J_demo_running: {
    createdBy: {
      label: "automation-token-7f3a",
      kind: "token",
      userId: null,
      tokenId: "tok_01_demo_automation",
    },
    hiddenTargets: [demoRunningTarget, demoRunningTarget.replace(/^https?:\/\//, "")],
    topTechnologies: [...demoRunningTechnologies],
  },
} satisfies Record<MockScanId, RunsRowEnrichment>;

const mockScanListEnrichmentLookup: Record<string, RunsRowEnrichment> = mockScanListEnrichmentByScanId;

export function getMockScanListEnrichment(scanId: string): RunsRowEnrichment {
  const enrichment = mockScanListEnrichmentLookup[scanId];

  if (!enrichment) {
    throw new Error(`Missing mock scan list enrichment for scanId: ${scanId}`);
  }

  return {
    createdBy: { ...enrichment.createdBy },
    hiddenTargets: [...enrichment.hiddenTargets],
    topTechnologies: [...enrichment.topTechnologies],
  };
}

export const mockCreateScanResponse: CreateScanResponse = createScanResponseSchema.parse({
  scanId: "scn_01J_demo_created",
  status: "queued",
  reused: false,
});

export const mockScanDetail = getScanResponseSchema.parse({
  scanId: "scn_01J_demo_recent",
  status: "running",
  source: "ui",
  targets: [
    {
      scanTargetId: "tgt_01J_demo",
      inputTarget: demoRecentTarget,
      normalizedTarget: demoRecentTarget,
    },
  ],
  currentAttempt: {
    attemptId: "att_01J_demo",
    attemptNumber: 1,
    status: "running",
    requestProfile: "baseline",
    fallbackReason: null,
    resultCount: 1,
    forbiddenResultCount: 0,
  },
  attemptHistory: [
    {
      attemptId: "att_01J_demo",
      attemptNumber: 1,
      status: "running",
      requestProfile: "baseline",
      fallbackReason: null,
      resultCount: 1,
      forbiddenResultCount: 0,
    },
  ],
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
      target: demoRecentTarget,
      input: demoRecentTarget,
      url: demoRecentTarget,
      finalUrl: demoRecentTarget,
      path: "/",
      method: "GET",
      title: "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      statusCode: 200,
      server: "Flywheel/5.1.0",
      location: "https://tpss.coop/shop",
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
        a: ["104.18.7.192", "104.18.6.192"],
        aaaa: ["2606:4700::6812:7c0", "2606:4700::6812:6c0"],
        cname: ["tpss.coop", "flywheel.netdna-cdn.com"],
        resolvers: ["1.1.1.1:53", "8.8.8.8:53", "9.9.9.9:53"],
      },
      asn: {
        asNumber: "13335",
        org: "Cloudflare, Inc.",
        country: "US",
        range: ["104.16.0.0/13", "104.18.0.0/14"],
      },
      tls: {
        sni: "tpss.coop",
        jarmHash: "29d29d00029d29d00041d41d00041d58f2ddf8c48d3aa4f8c9e5d4c5a4a2df",
        certificate: {
          subject: "CN=tpss.coop",
          issuer: "C=US, O=Let's Encrypt, CN=R3",
          serial: "00:ab:cd:ef:12:34:56:78:90",
          fingerprint: "a1:b2:c3:d4:e5:f6:07:08:09:10:11:12:13:14:15:16:17:18:19:20",
          notBefore: "2026-02-15T00:00:00Z",
          notAfter: "2026-05-16T23:59:59Z",
          subjectAltName: ["tpss.coop", "www.tpss.coop"],
          keyAlgorithm: "RSA",
          keySize: 2048,
          signatureAlgorithm: "SHA256-RSA",
          version: 3,
        },
      },
      technologies: [...demoRecentTechnologies],
      technologyDetections: [
        buildStructuredTechnologyDetection({ name: "WordPress", version: null, sources: ["wappalyzer"], inferred: false }),
        buildStructuredTechnologyDetection({ name: "WooCommerce", version: null, sources: ["wappalyzer"], inferred: false }),
        buildStructuredTechnologyDetection({ name: "PHP", version: null, sources: ["wappalyzer"], inferred: false }),
        buildStructuredTechnologyDetection({ name: "Jetpack", version: null, sources: ["wappalyzer"], inferred: false, bucketOverride: "ecosystem" }),
        buildStructuredTechnologyDetection({ name: "MySQL", version: null, sources: ["wappalyzer"], inferred: false }),
        buildStructuredTechnologyDetection({ name: "Nginx", version: null, sources: ["wappalyzer"], inferred: false }),
      ],
      wordpress: {
        plugins: ["jetpack", "ajax-search-for-woocommerce", "woocommerce-gateway-stripe", "wp-super-cache"],
        themes: ["pro", "twentytwentyfour", "storefront"],
      },
      cpe: [
        {
          cpe: "cpe:2.3:a:webp_server_go:webp_server_go:*:*:*:*:*:*:*:*",
          vendor: "webp_server_go",
          product: "webp_server_go",
        },
        {
          cpe: "cpe:2.3:a:wordpress:wordpress:6.4.3:*:*:*:*:*:*:*",
          vendor: "wordpress",
          product: "wordpress",
        },
        {
          cpe: "cpe:2.3:a:woocommerce:woocommerce:8.5.2:*:*:*:*:*:*:*",
          vendor: "woocommerce",
          product: "woocommerce",
        },
        {
          cpe: "cpe:2.3:a:nginx:nginx:1.24.0:*:*:*:*:*:*:*",
          vendor: "nginx",
          product: "nginx",
        },
      ],
      favicon: {
        mmh3: "1494302000",
        md5: "55a0d5d0ab8c2458921f7fef7d5ec6d0",
        url: "https://tpss.coop/favicon.ico",
        path: "/favicon.ico",
      },
      screenshot: {
        available: true,
        path: "/api/v1/scans/demo-scan/results/demo-result/screenshot",
        contentType: "image/webp",
        byteSize: 163840,
        capturedAt: toIsoString(now),
      },
      hashes: {
        md5: "ad2f7e2ff7f736a0e1c0c8614ed0b50d",
        mmh3: "1494302000",
        sha256: "8e0cc5a0f6d50243bb7f73ad92f8a50e4ec6e18cb6dc9f71655df94df6e7f8f2",
        sha1: "7f8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c",
      },
      capabilities: {
        http2: true,
        pipeline: false,
        websocket: false,
        vhost: false,
      },
      redirectChain: {
        statusCodes: [301, 200],
        items: [
          {
            url: "http://tpss.coop",
            statusCode: 301,
            location: "https://tpss.coop",
            contentLength: 0,
            responseTimeMs: 45,
          },
          {
            url: "https://tpss.coop",
            statusCode: 200,
            location: null,
            contentLength: 12345,
            responseTimeMs: 142,
          },
        ],
      },
      bodyPreview: "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store - Organic produce, bulk goods, and community-owned since 1981.",
      bodyDomains: ["tpss.coop", "google-analytics.com", "googleapis.com", "gstatic.com", "fastly.net"],
      bodyFqdns: ["www.tpss.coop", "fonts.googleapis.com", "ajax.googleapis.com", "cdn.fastly.net"],
      rawHttpx: {
        timestamp: toIsoString(now),
         url: demoRecentTarget,
         final_url: demoRecentTarget,
         input: demoRecentTarget,
        status_code: 200,
        title: "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
        webserver: "Flywheel/5.1.0",
        content_type: "text/html; charset=UTF-8",
        content_length: 12345,
        words: 3420,
        lines: 892,
        time: "187ms",
        response_time_ms: 187,
        location: "https://tpss.coop/shop",
        method: "GET",
        host_ip: "104.18.7.192",
        a: ["104.18.7.192", "104.18.6.192"],
        aaaa: ["2606:4700::6812:7c0", "2606:4700::6812:6c0"],
        cname: ["tpss.coop", "flywheel.netdna-cdn.com"],
        resolvers: ["1.1.1.1:53", "8.8.8.8:53", "9.9.9.9:53"],
        asn: {
          as_number: "13335",
          org: "Cloudflare, Inc.",
          country: "US",
          range: ["104.16.0.0/13", "104.18.0.0/14"],
        },
        cdn: "fastly",
        cdn_name: "fastly",
        cdn_type: "cdn",
        tech: ["WordPress", "WooCommerce", "PHP", "Jetpack", "MySQL", "Nginx"],
        wordpress: {
          plugins: ["jetpack", "ajax-search-for-woocommerce", "woocommerce-gateway-stripe", "wp-super-cache"],
          themes: ["pro", "twentytwentyfour", "storefront"],
        },
        cpe: [
          "cpe:2.3:a:webp_server_go:webp_server_go:*:*:*:*:*:*:*:*",
          "cpe:2.3:a:wordpress:wordpress:6.4.3:*:*:*:*:*:*:*",
          "cpe:2.3:a:woocommerce:woocommerce:8.5.2:*:*:*:*:*:*:*",
          "cpe:2.3:a:nginx:nginx:1.24.0:*:*:*:*:*:*:*",
        ],
        tls: {
          sni: "tpss.coop",
          jarm_hash: "29d29d00029d29d00041d41d00041d58f2ddf8c48d3aa4f8c9e5d4c5a4a2df",
          certificate: {
            subject: "CN=tpss.coop",
            issuer: "C=US, O=Let's Encrypt, CN=R3",
            serial: "00:ab:cd:ef:12:34:56:78:90",
            fingerprint: "a1:b2:c3:d4:e5:f6:07:08:09:10:11:12:13:14:15:16:17:18:19:20",
            not_before: "2026-02-15T00:00:00Z",
            not_after: "2026-05-16T23:59:59Z",
            subject_alt_name: ["tpss.coop", "www.tpss.coop"],
            key_algorithm: "RSA",
            key_size: 2048,
            signature_algorithm: "SHA256-RSA",
            version: 3,
          },
        },
        jarm: "29d29d00029d29d00041d41d00041d58f2ddf8c48d3aa4f8c9e5d4c5a4a2df",
        favicon: "https://tpss.coop/favicon.ico",
        favicon_path: "/favicon.ico",
        favicon_mmh3: "1494302000",
        favicon_md5: "55a0d5d0ab8c2458921f7fef7d5ec6d0",
        hash: {
          md5: "ad2f7e2ff7f736a0e1c0c8614ed0b50d",
          mmh3: "1494302000",
          sha256: "8e0cc5a0f6d50243bb7f73ad92f8a50e4ec6e18cb6dc9f71655df94df6e7f8f2",
          sha1: "7f8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c",
        },
        http2: true,
        pipeline: false,
        websocket: false,
        vhost: false,
        chain_status_codes: [301, 200],
        chain: [
          {
            url: "http://tpss.coop",
            status_code: 301,
            location: "https://tpss.coop",
            content_length: 0,
            response_time: "45ms",
          },
          {
            url: "https://tpss.coop",
            status_code: 200,
            location: null,
            content_length: 12345,
            response_time: "142ms",
          },
        ],
        body_preview: "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store - Organic produce, bulk goods, and community-owned since 1981.",
        body_domains: ["tpss.coop", "google-analytics.com", "googleapis.com", "gstatic.com", "fastly.net"],
        body_fqdns: ["www.tpss.coop", "fonts.googleapis.com", "ajax.googleapis.com", "cdn.fastly.net"],
        header: {
          "server": "Flywheel/5.1.0",
          "content-type": "text/html; charset=UTF-8",
          "cache-control": "max-age=3600, public",
          "x-cache": "HIT",
          "strict-transport-security": "max-age=31536000; includeSubDomains",
          "x-content-type-options": "nosniff",
          "x-frame-options": "SAMEORIGIN",
        },
        raw_header: "HTTP/1.1 200 OK\r\nServer: Flywheel/5.1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Length: 12345\r\nCache-Control: max-age=3600, public\r\nX-Cache: HIT\r\nStrict-Transport-Security: max-age=31536000; includeSubDomains\r\nX-Content-Type-Options: nosniff\r\nX-Frame-Options: SAMEORIGIN\r\n\r\n",
        port: "443",
        scheme: "https",
        path: "/",
        query: "",
         fragment: "",
       },
      nuclei: {
        state: "not_run",
        run: null,
        technologies: [],
        findings: [],
      },
    },
  ],
  page: 1,
  pageSize: 20,
  total: 1,
});

export const mockTargetResults = targetResultsResponseSchema.parse({
  items: [
    {
      canonicalTargetId: "ctg_01J_demo",
      normalizedTarget: demoRecentTarget,
      latestScanId: "scn_01J_demo_recent",
      title: "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      technologies: [...demoRecentTechnologies.slice(0, 3)],
      lastScannedAt: toIsoString(new Date(now.getTime() - 30_000)),
      faviconUrl: "https://tpss.coop/favicon.ico",
    },
    {
      canonicalTargetId: "ctg_01J_github",
      normalizedTarget: "https://github.com",
      latestScanId: "scn_01J_github",
      title: "GitHub · Build and ship software on a single, collaborative platform",
      technologies: ["Ruby on Rails", "MySQL", "GitHub Enterprise"],
      lastScannedAt: toIsoString(new Date(now.getTime() - 3600_000)),
      faviconUrl: "https://github.com/favicon.ico",
    },
  ],
  nextCursor: null,
});

export const mockTargetHistory = targetHistoryResponseSchema.parse({
  canonicalTargetId: "ctg_01J_demo",
  normalizedTarget: demoRecentTarget,
  items: [
    {
      scanId: "scn_01J_demo_recent",
      status: "completed",
      title: "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      technologies: [...demoRecentTechnologies.slice(0, 3)],
      submittedAt: toIsoString(new Date(now.getTime() - 30_000)),
      completedAt: toIsoString(new Date(now.getTime() - 30_000)),
    },
    {
      scanId: "scn_01J_demo_previous",
      status: "completed",
      title: "Takoma Park Silver Spring Co-op",
      technologies: ["WordPress", "PHP"],
      submittedAt: toIsoString(new Date(now.getTime() - 86_400_000)),
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
