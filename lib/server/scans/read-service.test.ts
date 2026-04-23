import { describe, expect, it } from "vitest";

import {
  getResultTechnologiesResponseSchema,
  scanResultItemSchema,
} from "@/lib/contracts/scans";
import {
  mapResultItem,
  mapCompletedResultSnapshot,
  mapDashboardRecentScan,
  mapTechnologyInventoryItems,
  selectAuthoritativeResultRecord,
  type ResultDecorations,
} from "@/lib/server/scans/read-service";
import type { CompletedResultSnapshot } from "@/lib/server/scans/read-service";
import type { ScanListItem } from "@/lib/contracts/scans";

type ResultRecord = typeof import("@/lib/db/schema").scanResults.$inferSelect;
type ScanRecord = typeof import("@/lib/db/schema").scans.$inferSelect;

function createResultRecord(overrides: Partial<ResultRecord> = {}): ResultRecord {
  return {
    id: "res_01",
    scanId: "scan_01",
    attemptId: "att_01",
    observedAt: new Date("2026-03-27T00:00:00.000Z"),
    url: "https://example.com",
    finalUrl: "https://example.com",
    input: "https://example.com",
    host: "example.com",
    scheme: "https",
    port: "443",
    path: "/",
    method: "GET",
    hostIp: "203.0.113.10",
    statusCode: 200,
    title: "Example",
    webServer: "nginx",
    location: null,
    contentType: "text/html",
    contentLength: 512,
    responseTimeMs: 125,
    words: 42,
    lines: 7,
    cdn: false,
    cdnName: null,
    cdnType: null,
    faviconMmh3: null,
    faviconMd5: null,
    faviconUrl: null,
    faviconPath: null,
    sni: null,
    jarmHash: null,
    bodyPreview: "Example body",
    rawHeaders: null,
    responseHeadersJson: {},
    dnsARecords: [],
    dnsAaaaRecords: [],
    dnsCnameRecords: [],
    dnsResolvers: [],
    asnJson: {},
    tlsJson: {},
    cspJson: {},
    hashesJson: {},
    bodyDomains: [],
    bodyFqdns: [],
    redirectChainStatusCodes: [],
    redirectChainJson: [],
    http2: true,
    pipeline: false,
    websocket: false,
    vhost: false,
    storedResponsePath: null,
    screenshotObjectKey: null,
    screenshotContentType: null,
    screenshotByteSize: null,
    screenshotCapturedAt: null,
    failed: false,
    rawJson: {
      tech: ["Nginx"],
      wordpress: {
        plugins: [],
        themes: [],
      },
    },
    searchDocument: "Nginx",
    ...overrides,
  };
}

function createScanRecord(overrides: Partial<ScanRecord> = {}): ScanRecord {
  return {
    id: "scan_01",
    createdByUserId: null,
    createdByTokenId: null,
    scheduleId: null,
    source: "ui",
    status: "completed",
    profile: "stack-deep",
    idempotencyKey: null,
    requestFingerprint: "fingerprint_01",
    requestSchemaVersion: 1,
    canonicalTargetId: "canonical_01",
    inputTarget: "https://example.com",
    normalizedTarget: "https://example.com",
    optionsJson: {},
    submittedAt: new Date("2026-03-27T00:00:00.000Z"),
    scheduledForAt: null,
    startedAt: new Date("2026-03-27T00:00:01.000Z"),
    completedAt: new Date("2026-03-27T00:00:02.000Z"),
    cancellationRequestedAt: null,
    errorCode: null,
    errorMessage: null,
    createdAt: new Date("2026-03-27T00:00:00.000Z"),
    ...overrides,
  } as ScanRecord;
}

function createScanListItem(overrides: Partial<ScanListItem> = {}): ScanListItem {
  return {
    scanId: "scan_01",
    status: "completed",
    source: "ui",
    target: "example.com",
    submittedAt: "2026-03-27T00:00:00.000Z",
    completedAt: "2026-03-27T00:00:02.000Z",
    ...overrides,
  };
}

function createCompletedSnapshot(overrides: Partial<CompletedResultSnapshot> = {}): CompletedResultSnapshot {
  return {
    resultId: "res_01",
    scanId: "scan_01",
    canonicalTargetId: "canonical_01",
    normalizedTarget: "example.com",
    title: "Example",
    technologies: ["Nginx"],
    wordpressPlugins: [],
    wordpressThemes: [],
    cpe: [],
    statusCode: 200,
    server: "nginx",
    cdn: null,
    completedAt: "2026-03-27T00:00:02.000Z",
    faviconUrl: null,
    ...overrides,
  };
}

function createDecorations(): ResultDecorations {
  return {
    technologies: [{ name: "Nginx", version: null, source: "wappalyzer" }],
    wordpressPlugins: [],
    wordpressThemes: [],
    cpe: [],
    nucleiRun: {
      id: "nr_01",
      resultId: "res_01",
      status: "completed",
      targetUrl: "https://example.com",
      targetHost: "example.com",
      originalDomainTarget: "alpha-company.test",
      finalDomainTarget: "beta-company.test",
      domainTarget: "alpha-company.test",
      headersJson: ["User-Agent: Browser"],
      templateIdsJson: ["tech-detect", "ssl-issuer"],
      engineVersion: null,
      templatesVersion: null,
      errorMessage: null,
      startedAt: new Date("2026-03-27T00:01:00.000Z"),
      completedAt: new Date("2026-03-27T00:01:05.000Z"),
      createdAt: new Date("2026-03-27T00:01:00.000Z"),
    },
    nucleiMatches: [
      {
        id: "nm_tech",
        runId: "nr_01",
        resultId: "res_01",
        templateId: "tech-detect",
        templatePath: "http/technologies/tech-detect.yaml",
        matcherName: "Next.js",
        protocolType: "http",
        severity: "info",
        matchedAt: "https://example.com/",
        host: "https://example.com",
        ip: "203.0.113.10",
        port: "443",
        scheme: "https",
        url: "https://example.com",
        path: "/",
        extractedResultsJson: ["nextjs"],
        technologyName: "Next.js",
        technologyVersion: null,
        findingKind: "technology",
        subject: "https://example.com",
        subjectType: "url",
        rawJson: {
          "template-id": "tech-detect",
          "matcher-name": "Next.js",
        },
        createdAt: new Date("2026-03-27T00:01:01.000Z"),
      },
      {
        id: "nm_ssl",
        runId: "nr_01",
        resultId: "res_01",
        templateId: "ssl-issuer",
        templatePath: "ssl/detect-ssl-issuer.yaml",
        matcherName: "Let's Encrypt",
        protocolType: "ssl",
        severity: "info",
        matchedAt: "example.com:443",
        host: "example.com",
        ip: "203.0.113.10",
        port: "443",
        scheme: "https",
        url: "https://example.com",
        path: "/",
        extractedResultsJson: ["C=US, O=Let's Encrypt, CN=R3"],
        technologyName: null,
        technologyVersion: null,
        findingKind: "ssl_issuer",
        subject: "https://example.com",
        subjectType: "url",
        rawJson: {
          "template-id": "ssl-issuer",
          "matcher-name": "Let's Encrypt",
        },
        createdAt: new Date("2026-03-27T00:01:02.000Z"),
      },
    ],
    nucleiTechnologyNames: ["Next.js"],
  };
}

describe("mapResultItem", () => {
  it("merges nuclei technology names into visible technologies and exposes nuclei provenance", () => {
    const parsed = scanResultItemSchema.parse(
      mapResultItem(createResultRecord(), createScanRecord(), createDecorations()),
    );

    expect(parsed.technologies).toEqual(["Nginx", "Next.js"]);
    expect(parsed.technologyDetections.map((technology) => technology.name)).toEqual(["Nginx", "Next.js"]);
    expect(parsed.technologyDetections[0]).toMatchObject({
      name: "Nginx",
      bucket: "infrastructure",
      sources: ["wappalyzer"],
    });
    expect(parsed.technologyDetections[1]).toMatchObject({
      name: "Next.js",
      bucket: "framework",
      sources: ["nuclei"],
    });
    expect(parsed.nuclei?.run).toEqual({
      status: "completed",
      targetUrl: "https://example.com",
      targetHost: "example.com",
      originalDomainTarget: "alpha-company.test",
      finalDomainTarget: "beta-company.test",
      domainTarget: "alpha-company.test",
      headers: ["User-Agent: Browser"],
      templateIds: ["tech-detect", "ssl-issuer"],
      engineVersion: null,
      templatesVersion: null,
      errorMessage: null,
      startedAt: "2026-03-27T00:01:00.000Z",
      completedAt: "2026-03-27T00:01:05.000Z",
    });
    expect(parsed.nuclei?.state).toBe("completed");
    expect(parsed.nuclei?.technologies).toHaveLength(1);
    expect(parsed.nuclei?.technologies[0]?.technologyName).toBe("Next.js");
    expect(parsed.nuclei?.technologies[0]?.findingKind).toBe("technology");
    expect(parsed.nuclei?.technologies[0]?.subject).toBe("https://example.com");
    expect(parsed.nuclei?.technologies[0]?.subjectType).toBe("url");
    expect(parsed.nuclei?.findings).toHaveLength(1);
    expect(parsed.nuclei?.findings[0]?.findingKind).toBe("ssl_issuer");
    expect(parsed.nuclei?.findings[0]?.subject).toBe("https://example.com");
    expect(parsed.nuclei?.findings[0]?.subjectType).toBe("url");
    expect(parsed.nuclei?.findings[0]?.technologyName).toBeNull();
  });

  it("returns a stable not_run nuclei block when no enrichment data exists", () => {
    const parsed = scanResultItemSchema.parse(
      mapResultItem(createResultRecord(), createScanRecord(), {
        technologies: [{ name: "Nginx", version: null, source: "wappalyzer" }],
        wordpressPlugins: [],
        wordpressThemes: [],
        cpe: [],
        nucleiRun: null,
        nucleiMatches: [],
        nucleiTechnologyNames: [],
      }),
    );

    expect(parsed.nuclei).toEqual({
      state: "not_run",
      run: null,
      technologies: [],
      findings: [],
    });
  });

  it("normalizes legacy favicon rows that stored the hash in faviconUrl", () => {
    const parsed = scanResultItemSchema.parse(
      mapResultItem(
        createResultRecord({
          faviconMmh3: null,
          faviconMd5: "c4a5b58b9454b49b47a9ce9d1ca02b05",
          faviconUrl: "-1830687435",
          faviconPath: "https://www.path-target.example.test/wp-content/uploads/2024/02/sample-favicon-150x150.png",
          rawJson: {
            favicon: "-1830687435",
            favicon_url: "https://www.path-target.example.test/wp-content/uploads/2024/02/sample-favicon-150x150.png",
            favicon_path: "https://www.path-target.example.test/wp-content/uploads/2024/02/sample-favicon-150x150.png",
            favicon_md5: "c4a5b58b9454b49b47a9ce9d1ca02b05",
          },
        }),
        createScanRecord(),
        createDecorations(),
      ),
    );

    expect(parsed.favicon).toEqual({
      mmh3: "-1830687435",
      md5: "c4a5b58b9454b49b47a9ce9d1ca02b05",
      url: "https://www.path-target.example.test/wp-content/uploads/2024/02/sample-favicon-150x150.png",
      path: "https://www.path-target.example.test/wp-content/uploads/2024/02/sample-favicon-150x150.png",
    });
  });

  it("produces flattened canonical technology rows for the dedicated technology endpoints", () => {
    const rawItems = mapTechnologyInventoryItems(
      createResultRecord(),
      createScanRecord(),
      {
        ...createDecorations(),
        technologies: [
          { name: "Nginx", version: null, source: "wappalyzer" },
          { name: "Nginx", version: null, source: "cpe" },
        ],
      },
    );
    const items = getResultTechnologiesResponseSchema.parse({
      items: rawItems,
      total: rawItems.length,
    }).items;

    expect(items.map((item) => [item.kind, item.displayName])).toEqual([
      ["technology", "Nginx"],
      ["technology", "Next.js"],
    ]);
    expect(items[0]).toMatchObject({
      scanId: "scan_01",
      resultId: "res_01",
      canonicalTargetId: "canonical_01",
      url: "https://example.com",
      normalizedName: "nginx",
      bucket: "infrastructure",
      sources: ["wappalyzer", "cpe"],
    });
  });
});

describe("mapDashboardRecentScan", () => {
  it("renders a completed scan as complete even when no result snapshot exists", () => {
    expect(mapDashboardRecentScan(createScanListItem(), undefined)).toEqual({
      id: "scan_01",
      target: "example.com",
      ip: "—",
      status: "complete",
      technologies: [],
      timestamp: "2026-03-27T00:00:02.000Z",
      statusCode: undefined,
      server: undefined,
      cdn: undefined,
      responseTimeMs: undefined,
      techCount: 0,
      faviconUrl: undefined,
    });
  });

  it("uses snapshot metadata for completed scans when present", () => {
    expect(
      mapDashboardRecentScan(
        createScanListItem(),
        createCompletedSnapshot({
          technologies: ["Pantheon", "Fastly"],
          server: "Pantheon",
          cdn: "Fastly",
          faviconUrl: "https://example.com/favicon.ico",
        }),
      ),
    ).toMatchObject({
      status: "complete",
      technologies: ["Pantheon", "Fastly"],
      server: "Pantheon",
      cdn: "Fastly",
      techCount: 2,
      faviconUrl: "https://example.com/favicon.ico",
    });
  });

  it("keeps only in-flight scan statuses in the analyzing state", () => {
    expect(mapDashboardRecentScan(createScanListItem({ status: "running", completedAt: null }), undefined)).toMatchObject({
      status: "analyzing",
      progress: 0,
    });
  });
});

describe("mapCompletedResultSnapshot", () => {
  it("uses the same enriched hosting labels as scan detail instead of raw server/CDN fields", () => {
    const snapshot = mapCompletedResultSnapshot(
      createScanRecord({ normalizedTarget: "path-target.example.test" }),
      createResultRecord({
        webServer: "nginx",
        cdnName: null,
        dnsCnameRecords: ["sample-site.pantheonsite.io"],
        rawJson: {
          tech: ["Pantheon", "Fastly"],
          wordpress: {
            plugins: [],
            themes: [],
          },
        },
      }),
      {
        ...createDecorations(),
        technologies: [
          { name: "Pantheon", version: null, source: "wappalyzer" },
          { name: "Fastly", version: null, source: "wappalyzer" },
        ],
        nucleiMatches: [],
        nucleiTechnologyNames: [],
      },
      "2026-03-27T00:00:02.000Z",
    );

    expect(snapshot).toMatchObject({
      server: "Pantheon",
      cdn: "Fastly",
      technologies: expect.arrayContaining(["Pantheon", "Fastly"]),
    });
  });
});

describe("selectAuthoritativeResultRecord", () => {
  it("chooses the same authoritative requested-target row as the worker-facing selector", () => {
    const scan = createScanRecord({ normalizedTarget: "https://example.com" });
    const sibling403 = createResultRecord({
      id: "res_sibling_403",
      input: "https://www.example.com",
      url: "https://www.example.com",
      finalUrl: "https://example.com",
      statusCode: 403,
      observedAt: new Date("2026-03-27T00:00:02.000Z"),
    });
    const authoritative200 = createResultRecord({
      id: "res_authoritative_200",
      input: "https://example.com",
      url: "https://example.com",
      finalUrl: "https://example.com",
      statusCode: 200,
      observedAt: new Date("2026-03-27T00:00:01.000Z"),
    });

    expect(selectAuthoritativeResultRecord([sibling403, authoritative200], scan)).toEqual(authoritative200);
  });

  it("remains deterministic when matching rows are returned in different array orders", () => {
    const scan = createScanRecord({ normalizedTarget: "https://example.com" });
    const older = createResultRecord({
      id: "res_older",
      observedAt: new Date("2026-03-27T00:00:00.000Z"),
    });
    const newer = createResultRecord({
      id: "res_newer",
      observedAt: new Date("2026-03-27T00:00:01.000Z"),
      statusCode: 403,
    });

    expect(selectAuthoritativeResultRecord([older, newer], scan)?.id).toBe("res_older");
    expect(selectAuthoritativeResultRecord([newer, older], scan)?.id).toBe("res_older");
  });
});
