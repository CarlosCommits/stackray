import { describe, expect, it } from "vitest";

import {
  getResultTechnologiesResponseSchema,
  getScanTechnologiesResponseSchema,
} from "@/lib/contracts/scans";
import { getTargetTechnologiesResponseSchema } from "@/lib/contracts/targets";

import {
  getMockScanListEnrichment,
  mockScanDetail,
  mockScanEvents,
  mockScanList,
  mockScanListEnrichmentByScanId,
  mockScanResults,
  mockTargetResults,
} from "@/lib/mocks/scans";

describe("scan mocks", () => {
  it("provides list items for history surfaces", () => {
    expect(mockScanList.items.length).toBeGreaterThan(0);
    expect(mockScanList.items[0]?.scanId).toMatch(/^scn_/);
  });

  it("keeps public scan list contracts clean and stores history-only data in enrichment", () => {
    const recentScan = mockScanList.items[0];

    expect(recentScan).toBeDefined();
    expect(recentScan).not.toHaveProperty("createdBy");
    expect(recentScan).not.toHaveProperty("hiddenTargets");
    expect(recentScan).not.toHaveProperty("topTechnologies");

    const enrichment = getMockScanListEnrichment(recentScan!.scanId);

    expect(enrichment).toEqual({
      createdBy: {
        label: "Ada Lovelace",
        kind: "user",
        userId: "usr_01_demo_ada",
        tokenId: null,
      },
      hiddenTargets: ["https://primary.example.test", "primary.example.test"],
      topTechnologies: ["WordPress", "WooCommerce", "PHP", "Jetpack", "MySQL", "Nginx"],
    });
  });

  it("provides ordered enrichment keyed by scanId for every history row", () => {
    const scanIds = mockScanList.items.map((item) => item.scanId);

    expect(scanIds.every((scanId) => scanId in mockScanListEnrichmentByScanId)).toBe(true);
    expect(getMockScanListEnrichment("scn_01J_demo_running")).toEqual({
      createdBy: {
        label: "automation-token-7f3a",
        kind: "token",
        userId: null,
        tokenId: "tok_01_demo_automation",
      },
      hiddenTargets: ["https://queue.example.com", "queue.example.com"],
      topTechnologies: ["Next.js", "PostgreSQL"],
    });
  });

  it("throws a clear error when enrichment is missing for a scanId", () => {
    expect(() => getMockScanListEnrichment("scn_missing")).toThrow(
      "Missing mock scan list enrichment for scanId: scn_missing",
    );
  });

  it("provides scan detail with a singular target", () => {
    expect(mockScanDetail.target.normalizedTarget).toBeTruthy();
    expect(mockScanDetail.progress.resultCount).toBeGreaterThanOrEqual(0);
  });

  it("provides results and target rows for UI composition", () => {
    expect(mockScanResults.items.length).toBeGreaterThan(0);
    expect(mockTargetResults.items.length).toBeGreaterThan(0);
    expect(mockScanResults.items[0]?.finalUrl).toBeTruthy();
    expect(mockScanResults.items[0]?.dns.hostIp).toBeTruthy();
    expect(mockScanResults.items[0]?.rawHttpx).toBeTruthy();
  });

  it("provides a valid event sequence", () => {
    expect(mockScanEvents[0]?.event).toBe("scan.status");
    expect(mockScanEvents.at(-1)?.event).toBe("scan.complete");
    const resultEvent = mockScanEvents.find((event) => event.event === "scan.result");
    expect(resultEvent?.data).toHaveProperty("finalUrl");
    expect(resultEvent?.data).toHaveProperty("cdn");
  });

  describe("scan result fixture coverage", () => {
    const result = mockScanResults.items[0];

    it("has location field for redirect tracking", () => {
      expect(result?.location).toBeDefined();
      expect(typeof result?.location).toBe("string");
    });

    it("has contentType with realistic MIME type", () => {
      expect(result?.contentType).toBeTruthy();
      expect(result?.contentType).toMatch(/^text\/html/);
    });

    it("has responseTimeMs as non-negative integer", () => {
      expect(result?.responseTimeMs).toBeDefined();
      expect(typeof result?.responseTimeMs).toBe("number");
      expect(result?.responseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("has wordpress themes array", () => {
      expect(result?.wordpress.themes).toBeDefined();
      expect(Array.isArray(result?.wordpress.themes)).toBe(true);
      expect(result?.wordpress.themes.length).toBeGreaterThan(0);
    });

    it("has cpe array with valid entries", () => {
      expect(result?.cpe).toBeDefined();
      expect(Array.isArray(result?.cpe)).toBe(true);
      expect(result?.cpe.length).toBeGreaterThan(0);
      expect(result?.cpe[0]).toHaveProperty("cpe");
      expect(result?.cpe[0]).toHaveProperty("vendor");
      expect(result?.cpe[0]).toHaveProperty("product");
    });

    it("has dns with cname, resolvers, and full arrays", () => {
      expect(result?.dns).toBeDefined();
      expect(Array.isArray(result?.dns.cname)).toBe(true);
      expect(Array.isArray(result?.dns.resolvers)).toBe(true);
      expect(Array.isArray(result?.dns.a)).toBe(true);
      expect(Array.isArray(result?.dns.aaaa)).toBe(true);
      expect(result?.dns.resolvers.length).toBeGreaterThan(0);
    });

    it("has asn with country and range", () => {
      expect(result?.asn).toBeDefined();
      expect(result?.asn.asNumber).toBeTruthy();
      expect(result?.asn.org).toBeTruthy();
      expect(result?.asn.country).toBeDefined();
      expect(Array.isArray(result?.asn.range)).toBe(true);
    });

    it("has tls certificate with detailed fields", () => {
      expect(result?.tls).toBeDefined();
      expect(result?.tls.sni).toBeTruthy();
      expect(result?.tls.jarmHash).toBeTruthy();
      expect(result?.tls.certificate).toBeDefined();
      expect(result?.tls.certificate).toHaveProperty("subject");
      expect(result?.tls.certificate).toHaveProperty("issuer");
      expect(result?.tls.certificate).toHaveProperty("serial");
      expect(result?.tls.certificate).toHaveProperty("fingerprint");
      expect(result?.tls.certificate).toHaveProperty("notBefore");
      expect(result?.tls.certificate).toHaveProperty("notAfter");
    });

    it("has favicon with path, url, and mmh3", () => {
      expect(result?.favicon).toBeDefined();
      expect(result?.favicon.path).toBeTruthy();
      expect(result?.favicon.url).toBeTruthy();
      expect(result?.favicon.mmh3).toBeTruthy();
      expect(result?.favicon.md5).toBeTruthy();
    });

    it("has hashes with mmh3 and other algorithms", () => {
      expect(result?.hashes).toBeDefined();
      expect(result?.hashes.mmh3).toBeTruthy();
      expect(result?.hashes.md5).toBeTruthy();
      expect(result?.hashes.sha256).toBeTruthy();
    });

    it("has redirect chain with items", () => {
      expect(result?.redirectChain).toBeDefined();
      expect(Array.isArray(result?.redirectChain.statusCodes)).toBe(true);
      expect(Array.isArray(result?.redirectChain.items)).toBe(true);
      expect(result?.redirectChain.items.length).toBeGreaterThan(0);
      expect(result?.redirectChain.items[0]).toHaveProperty("url");
      expect(result?.redirectChain.items[0]).toHaveProperty("statusCode");
    });

    it("has bodyPreview with realistic content", () => {
      expect(result?.bodyPreview).toBeTruthy();
      expect(typeof result?.bodyPreview).toBe("string");
      expect(result?.bodyPreview.length).toBeGreaterThan(10);
    });

    it("has bodyDomains array", () => {
      expect(result?.bodyDomains).toBeDefined();
      expect(Array.isArray(result?.bodyDomains)).toBe(true);
      expect(result?.bodyDomains.length).toBeGreaterThan(0);
    });

    it("has bodyFqdns array", () => {
      expect(result?.bodyFqdns).toBeDefined();
      expect(Array.isArray(result?.bodyFqdns)).toBe(true);
      expect(result?.bodyFqdns.length).toBeGreaterThan(0);
    });

    it("has rich rawHttpx without fabricated wrapper keys", () => {
      expect(result?.rawHttpx).toBeDefined();
      expect(typeof result?.rawHttpx).toBe("object");

      // Verify key httpx fields exist
      expect(result?.rawHttpx).toHaveProperty("timestamp");
      expect(result?.rawHttpx).toHaveProperty("url");
      expect(result?.rawHttpx).toHaveProperty("status_code");
      expect(result?.rawHttpx).toHaveProperty("webserver");
      expect(result?.rawHttpx).toHaveProperty("tech");
      expect(result?.rawHttpx).toHaveProperty("tls");
      expect(result?.rawHttpx).toHaveProperty("hash");
      expect(result?.rawHttpx).toHaveProperty("chain");
      expect(result?.rawHttpx).toHaveProperty("header");

      // Verify NO fabricated wrapper keys like "analysis" exist
      expect(result?.rawHttpx).not.toHaveProperty("analysis");
      expect(result?.rawHttpx).not.toHaveProperty("fingerprints");
      expect(result?.rawHttpx).not.toHaveProperty("infrastructure");

      // Verify rawHttpx contains realistic httpx-native fields
      const raw = result?.rawHttpx;
      expect(raw).toHaveProperty("host_ip");
      expect(raw).toHaveProperty("content_type");
      expect(raw).toHaveProperty("response_time_ms");
      expect(raw).toHaveProperty("jarm");
      expect(raw).toHaveProperty("favicon_mmh3");
      expect(raw).toHaveProperty("body_preview");
      expect(raw).toHaveProperty("body_domains");
      expect(raw).toHaveProperty("body_fqdns");
    });

    it("can project the first result into the dedicated technology endpoint contracts", () => {
      const wordPressDetection = result!.technologyDetections.find((detection) => detection.name === "WordPress")!;
      const technologyItem = {
        scanId: mockScanDetail.scanId,
        canonicalTargetId: "ctg_01J_demo",
        resultId: result!.resultId,
        url: result!.finalUrl,
        kind: "technology" as const,
        sources: ["wappalyzer"] as const,
        displayName: wordPressDetection.name,
        normalizedName: "wordpress",
        version: wordPressDetection.version,
        description: wordPressDetection.description,
        website: wordPressDetection.website,
        iconUrl: wordPressDetection.iconUrl,
        categories: wordPressDetection.categories,
        primaryCategory: wordPressDetection.primaryCategory,
        bucket: wordPressDetection.bucket,
        inferred: wordPressDetection.inferred,
        vendor: null,
        product: null,
        cpe: null,
      };
      const cpeItem = {
        ...technologyItem,
        kind: "cpe" as const,
        sources: ["cpe"] as const,
        inferred: true,
        vendor: result!.cpe[0]!.vendor,
        product: result!.cpe[0]!.product,
        cpe: result!.cpe[0]!.cpe,
      };

      expect(getResultTechnologiesResponseSchema.parse({ items: [technologyItem, cpeItem], total: 2 })).toEqual({
        items: [technologyItem, cpeItem],
        total: 2,
      });
      expect(getScanTechnologiesResponseSchema.parse({
        items: [technologyItem, cpeItem],
        page: 1,
        pageSize: 20,
        total: 2,
      }).items).toHaveLength(2);
      expect(getTargetTechnologiesResponseSchema.parse({
        canonicalTargetId: "ctg_01J_demo",
        normalizedTarget: result!.target,
        latestScanId: mockScanDetail.scanId,
        scanId: mockScanDetail.scanId,
        lastScannedAt: mockScanResults.items[0]!.screenshot.capturedAt,
        items: [technologyItem, cpeItem],
      }).items[0]?.displayName).toBe("WordPress");
    });
  });
});
