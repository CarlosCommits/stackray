import { describe, it, expect } from "vitest"
import {
  buildOverviewSection,
  buildTechnologySection,
  buildDeliveryRedirectsSection,
  buildDnsInfrastructureSection,
  buildTlsFingerprintsSection,
  buildDomainIntelligenceSection,
  buildContentSignalsSection,
  buildRawEvidenceSection,
  buildScanDetailPageViewModel,
} from "./scan-detail-view-model"
import type { ScanResultItem, GetScanResponse } from "@/lib/contracts/scans"
import { buildStructuredTechnologyDetection } from "@/lib/server/scans/technology-metadata-catalog"

// Mock data helpers
const createMockResult = (overrides: Partial<ScanResultItem> = {}): ScanResultItem => ({
  resultId: "test-result-id",
  target: "example.com",
  input: "example.com",
  url: "https://example.com",
  finalUrl: "https://www.example.com",
  path: "/",
  method: "GET",
  title: "Example Domain",
  statusCode: 200,
  server: "nginx",
  location: null,
  contentType: "text/html",
  contentLength: 1024,
  responseTimeMs: 150,
  cdn: { enabled: true, name: "Cloudflare", type: "WAF" },
  dns: {
    hostIp: "192.0.2.1",
    a: ["192.0.2.1"],
    aaaa: ["2001:db8::1"],
    cname: ["www.example.com"],
    resolvers: ["1.1.1.1:53"],
  },
  asn: {
    asNumber: "AS15169",
    org: "Google LLC",
    country: "US",
    range: ["192.0.2.0/24"],
  },
  tls: {
    sni: "www.example.com",
    jarmHash: "3fd3fd0003fd3fd00041d41d00041d6b5eefa2404a56c2ced79a0d16afe36c",
    certificate: {
      subject: "CN=www.example.com",
      issuer: "CN=Let's Encrypt",
      serial: "1234567890",
      notBefore: "2024-01-01T00:00:00Z",
      notAfter: "2024-12-31T23:59:59Z",
    },
  },
  technologies: ["nginx", "PHP", "WordPress"],
  technologyDetections: [
    buildStructuredTechnologyDetection({ name: "nginx", version: null, sources: ["wappalyzer"], inferred: false }),
    buildStructuredTechnologyDetection({ name: "PHP", version: null, sources: ["wappalyzer"], inferred: false }),
    buildStructuredTechnologyDetection({ name: "WordPress", version: null, sources: ["wappalyzer"], inferred: false }),
  ],
  wordpress: {
    plugins: ["yoast-seo", "jetpack"],
    themes: ["twentytwentyfour"],
  },
  cpe: [{ cpe: "cpe:/a:nginx:nginx:1.20", vendor: "nginx", product: "nginx" }],
  favicon: {
    mmh3: "1234567890",
    md5: "abcdef1234567890",
    url: "https://www.example.com/favicon.ico",
    path: "/favicon.ico",
  },
  screenshot: {
    available: true,
    path: "/api/v1/scans/test/results/test/screenshot",
    contentType: "image/png",
    byteSize: 102400,
    capturedAt: "2024-01-01T00:00:00Z",
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
      { url: "https://example.com", statusCode: 301, location: "https://www.example.com" },
      { url: "https://www.example.com", statusCode: 200 },
    ],
  },
  bodyPreview: "<!DOCTYPE html><html><head><title>Example</title></head><body>...</body></html>",
  bodyDomains: ["google.com", "social-d.example.test"],
  bodyFqdns: ["www.google.com", "api.social-d.example.test"],
  hashes: {
    bodyMd5: "abc123",
    bodySha256: "def456",
  },
  rawHttpx: { url: "https://example.com", status_code: 200 },
  nuclei: {
    state: "completed",
    run: {
      status: "completed",
      targetUrl: "https://www.example.com",
      targetHost: "www.example.com",
      originalDomainTarget: "example.com",
      finalDomainTarget: "www.example.com",
      domainTarget: null,
      headers: [],
      templateIds: ["dns-saas-service-detection", "txt-service-detect"],
      engineVersion: "3.1.0",
      templatesVersion: "9.9.9",
      errorMessage: null,
      startedAt: "2024-01-01T00:00:00Z",
      completedAt: "2024-01-01T00:01:00Z",
    },
    technologies: [
      {
        matchId: "tech-1",
        templateId: "tech-detect",
        templatePath: null,
        matcherName: "nginx",
        protocolType: "http",
        severity: null,
        matchedAt: "https://www.example.com",
        host: "www.example.com",
        ip: "192.0.2.1",
        port: "443",
        scheme: "https",
        url: "https://www.example.com",
        path: "/",
        extractedResults: [],
        technologyName: "nginx",
        technologyVersion: null,
        findingKind: "technology_match",
        subject: "www.example.com",
        subjectType: "domain",
        raw: {},
      },
    ],
    findings: [
      {
        matchId: "finding-1",
        templateId: "dns-saas-service-detection",
        templatePath: null,
        matcherName: "Google Workspace",
        protocolType: "dns",
        severity: "info",
        matchedAt: "example.com",
        host: "example.com",
        ip: null,
        port: null,
        scheme: null,
        url: null,
        path: null,
        extractedResults: ["Google Workspace"],
        technologyName: null,
        technologyVersion: null,
        findingKind: "dns_service",
        subject: "example.com",
        subjectType: "domain",
        raw: { "extractor-name": ["service"] },
      },
      {
        matchId: "finding-2",
        templateId: "rdap-whois",
        templatePath: null,
        matcherName: null,
        protocolType: "whois",
        severity: null,
        matchedAt: "example.com",
        host: "example.com",
        ip: null,
        port: null,
        scheme: null,
        url: null,
        path: null,
        extractedResults: [
          "Example Registrar",
          "2024-01-01T00:00:00Z",
          "2025-01-01T00:00:00Z",
          "NS1.EXAMPLE.COM",
          "NS2.EXAMPLE.COM",
        ],
        technologyName: null,
        technologyVersion: null,
        findingKind: "domain_metadata",
        subject: "example.com",
        subjectType: "domain",
        raw: {
          "extractor-name": ["registrarName", "registrationDate", "expirationDate", "nameservers", "nameservers"],
        },
      },
    ],
  },
  ...overrides,
})

describe("scan-detail-view-model", () => {
  describe("buildOverviewSection", () => {
    it("should build overview section from scan result", () => {
      const result = createMockResult()
      const overview = buildOverviewSection(result)

      expect(overview.statusCode).toBe(200)
      expect(overview.statusText).toBe("OK")
      expect(overview.redirectCount).toBe(1)
      expect(overview.server).toBe("Google LLC")
      expect(overview.cdnName).toBe("Cloudflare")
      expect(overview.hostIp).toBe("192.0.2.1")
      expect(overview.asnOrg).toBe("Google LLC")
      expect(overview.finalUrl).toBe("https://www.example.com")
      expect(overview.title).toBe("Example Domain")
      expect(overview.responseTimeMs).toBe(150)
      expect(overview.contentType).toBe("text/html")
      expect(overview.contentLength).toBe(1024)
    })

    it("should handle different status codes with appropriate text", () => {
      expect(buildOverviewSection(createMockResult({ statusCode: 301 })).statusText).toBe("Moved Permanently")
      expect(buildOverviewSection(createMockResult({ statusCode: 404 })).statusText).toBe("Not Found")
      expect(buildOverviewSection(createMockResult({ statusCode: 500 })).statusText).toBe("Internal Server Error")
      expect(buildOverviewSection(createMockResult({ statusCode: 999 })).statusText).toBe("Unknown")
    })

    it("should calculate redirect count correctly", () => {
      const noRedirects = createMockResult({
        redirectChain: { statusCodes: [200], items: [{ url: "https://example.com", statusCode: 200 }] },
      })
      expect(buildOverviewSection(noRedirects).redirectCount).toBe(0)

      const twoRedirects = createMockResult({
        redirectChain: {
          statusCodes: [301, 302, 200],
          items: [
            { url: "http://example.com", statusCode: 301 },
            { url: "https://example.com", statusCode: 302 },
            { url: "https://www.example.com", statusCode: 200 },
          ],
        },
      })
      expect(buildOverviewSection(twoRedirects).redirectCount).toBe(2)
    })

    it("should use cname-derived hosting providers even with trailing dots", () => {
      const result = createMockResult({
        server: "nginx",
        cdn: { enabled: false, name: null, type: null },
        asn: { asNumber: null, org: null, country: null },
        dns: {
          ...createMockResult().dns,
          cname: ["app.example.vercel-dns.com."],
        },
        technologyDetections: [],
      })

      expect(buildOverviewSection(result).server).toBe("Vercel")
    })

    it("should infer hosting providers from technology detections when the server banner is blank", () => {
      const result = createMockResult({
        server: null,
        cdn: { enabled: false, name: null, type: null },
        asn: { asNumber: null, org: null, country: null },
        dns: {
          ...createMockResult().dns,
          cname: [],
        },
        technologyDetections: [
          buildStructuredTechnologyDetection({ name: "Pantheon", version: null, sources: ["wappalyzer"], inferred: false }),
        ],
      })

      expect(buildOverviewSection(result).server).toBe("Pantheon")
    })

    it("should fall back to CDN technologies when the httpx CDN field is blank", () => {
      const result = createMockResult({
        server: null,
        cdn: { enabled: false, name: null, type: null },
        asn: { asNumber: null, org: null, country: null },
        dns: {
          ...createMockResult().dns,
          cname: [],
        },
        technologyDetections: [
          buildStructuredTechnologyDetection({ name: "Fastly", version: null, sources: ["wappalyzer"], inferred: false }),
        ],
      })

      expect(buildOverviewSection(result).server).toBeNull()
      expect(buildOverviewSection(result).cdnName).toBe("Fastly")
    })

    it("should prefer the explicit httpx CDN field over technology-derived CDN guesses", () => {
      const result = createMockResult({
        cdn: { enabled: true, name: "Cloudflare", type: "WAF" },
        technologyDetections: [
          buildStructuredTechnologyDetection({ name: "Fastly", version: null, sources: ["wappalyzer"], inferred: false }),
        ],
      })

      expect(buildOverviewSection(result).cdnName).toBe("Cloudflare")
    })

    it("should return null instead of a generic server banner when no better host signal exists", () => {
      const result = createMockResult({
        server: "nginx",
        cdn: { enabled: false, name: null, type: null },
        asn: { asNumber: null, org: null, country: null },
        dns: {
          ...createMockResult().dns,
          cname: [],
        },
        technologyDetections: [],
      })

      expect(buildOverviewSection(result).server).toBeNull()
    })
  })

  describe("buildTechnologySection", () => {
    it("should build technology section with bucket items", () => {
      const result = createMockResult()
      const technologyDisplay = {
        buckets: [
          {
            id: "platform" as const,
            label: "Platform",
            items: [buildStructuredTechnologyDetection({ name: "WordPress", version: null, sources: ["wappalyzer"], inferred: false })],
          },
          {
            id: "infrastructure" as const,
            label: "Infrastructure / Backend",
            items: [
              buildStructuredTechnologyDetection({ name: "nginx", version: null, sources: ["wappalyzer"], inferred: false }),
              buildStructuredTechnologyDetection({ name: "PHP", version: null, sources: ["wappalyzer"], inferred: false }),
            ],
          },
          {
            id: "ecosystem" as const,
            label: "Ecosystem Add-ons",
            items: [
              buildStructuredTechnologyDetection({ name: "Yoast SEO", version: null, sources: ["wordpress"], inferred: false, bucketOverride: "ecosystem" }),
              buildStructuredTechnologyDetection({ name: "Twenty Twenty-Four", version: null, sources: ["wordpress"], inferred: false, bucketOverride: "ecosystem" }),
            ],
          },
        ],
      }

      const section = buildTechnologySection(result, technologyDisplay)

      expect(section.buckets).toHaveLength(3)
      expect(section.buckets[0]?.items[0]?.name).toBe("WordPress")
      expect(section.buckets[1]?.items).toHaveLength(2)
      expect(section.buckets[2]?.items).toHaveLength(2)
      expect(section.nucleiTechnologies).toHaveLength(1)
      expect(section.cpeEntries).toHaveLength(1)
      expect(section.cpeEntries[0].cpe).toBe("cpe:/a:nginx:nginx:1.20")
      expect(section.totalCount).toBeGreaterThan(0)
    })

    it("should handle null technology display", () => {
      const result = createMockResult()
      const section = buildTechnologySection(result, null)

      expect(section.buckets).toHaveLength(2)
      expect(section.buckets[0]?.id).toBe("platform")
      expect(section.buckets[1]?.id).toBe("infrastructure")
      expect(section.buckets[0]?.items).toHaveLength(1)
      expect(section.buckets[1]?.items).toHaveLength(2)
    })

    it("should include CPE entries from scan result", () => {
      const result = createMockResult({
        cpe: [
          { cpe: "cpe:/a:nginx:nginx:1.20", vendor: "nginx", product: "nginx" },
          { cpe: "cpe:/a:php:php:8.0", vendor: "php", product: "php" },
          { cpe: "cpe:/a:wordpress:wordpress:6.0", vendor: "wordpress", product: "wordpress" },
        ],
      })
      const section = buildTechnologySection(result, null)

      expect(section.cpeEntries).toHaveLength(3)
      expect(section.cpeEntries[0]).toEqual({
        cpe: "cpe:/a:nginx:nginx:1.20",
        vendor: "nginx",
        product: "nginx",
      })
      expect(section.cpeEntries[1]).toEqual({
        cpe: "cpe:/a:php:php:8.0",
        vendor: "php",
        product: "php",
      })
      expect(section.cpeEntries[2]).toEqual({
        cpe: "cpe:/a:wordpress:wordpress:6.0",
        vendor: "wordpress",
        product: "wordpress",
      })
      expect(section.totalCount).toBe(6)
    })

    it("should handle empty CPE entries", () => {
      const result = createMockResult({ cpe: [] })
      const section = buildTechnologySection(result, null)

      expect(section.cpeEntries).toHaveLength(0)
      expect(section.totalCount).toBe(3)
    })
  })

  describe("buildDeliveryRedirectsSection", () => {
    it("should build delivery and redirects section", () => {
      const result = createMockResult()
      const section = buildDeliveryRedirectsSection(result)

      expect(section.input).toBe("example.com")
      expect(section.url).toBe("https://example.com")
      expect(section.finalUrl).toBe("https://www.example.com")
      expect(section.path).toBe("/")
      expect(section.method).toBe("GET")
      expect(section.statusCode).toBe(200)
      expect(section.location).toBeNull()
      expect(section.responseTimeMs).toBe(150)
      expect(section.contentType).toBe("text/html")
      expect(section.contentLength).toBe(1024)
      expect(section.redirectChain.items).toHaveLength(2)
    })
  })

  describe("buildDnsInfrastructureSection", () => {
    it("should build DNS infrastructure section with nuclei findings", () => {
      const result = createMockResult()
      const section = buildDnsInfrastructureSection(result)

      expect(section.hostIp).toBe("192.0.2.1")
      expect(section.a).toEqual(["192.0.2.1"])
      expect(section.aaaa).toEqual(["2001:db8::1"])
      expect(section.cname).toEqual(["www.example.com"])
      expect(section.resolvers).toEqual(["1.1.1.1:53"])
      expect(section.asn.asNumber).toBe("AS15169")
      expect(section.asn.org).toBe("Google LLC")
      expect(section.capabilities.http2).toBe(true)
      expect(section.dnsServices).toHaveLength(1)
      expect(section.dnsServices[0].serviceName).toBe("Google Workspace")
      expect(section.dnsServices[0].provenance).toBe("original")
    })

    it("should prefer clean DNS service matcher names over raw TXT values", () => {
      const result = createMockResult({
        nuclei: {
          ...createMockResult().nuclei,
          findings: [
            {
              matchId: "finding-brevo",
              templateId: "txt-service-detect",
              templatePath: "dns/txt-service-detect.yaml",
              matcherName: "brevo",
              protocolType: "dns",
              severity: "info",
              matchedAt: "example.com",
              host: "example.com",
              ip: null,
              port: null,
              scheme: null,
              url: null,
              path: null,
              extractedResults: ["brevo-code:f6498ae8180a890715fbd4b5f03bd728"],
              technologyName: null,
              technologyVersion: null,
              findingKind: "dns_service",
              subject: "example.com",
              subjectType: "domain",
              raw: { "matcher-name": "brevo" },
            },
          ],
        },
      })

      const section = buildDnsInfrastructureSection(result)

      expect(section.dnsServices[0].serviceName).toBe("Brevo")
    })

    it("should extract nameservers from domain metadata with case-insensitive deduplication", () => {
      const result = createMockResult({
        nuclei: {
          ...createMockResult().nuclei,
          findings: [
            {
              matchId: "finding-ns-dns",
              templateId: "rdap-whois",
              templatePath: null,
              matcherName: null,
              protocolType: "whois",
              severity: null,
              matchedAt: "example.com",
              host: "example.com",
              ip: null,
              port: null,
              scheme: null,
              url: null,
              path: null,
              extractedResults: [
                "NS1.EXAMPLE.COM",
                "ns1.example.com",
                "NS2.EXAMPLE.COM",
              ],
              technologyName: null,
              technologyVersion: null,
              findingKind: "domain_metadata",
              subject: "example.com",
              subjectType: "domain",
              raw: {
                "extractor-name": ["nameservers", "nameservers", "nameservers"],
              },
            },
          ],
        },
      })
      const section = buildDnsInfrastructureSection(result)

      expect(section.nameservers).toHaveLength(2)
      expect(section.nameservers.map(ns => ns.toLowerCase()).sort()).toEqual([
        "ns1.example.com",
        "ns2.example.com",
      ])
    })
  })

  describe("buildTlsFingerprintsSection", () => {
    it("should build TLS fingerprints section", () => {
      const result = createMockResult()
      const section = buildTlsFingerprintsSection(result)

      expect(section.sni).toBe("www.example.com")
      expect(section.jarmHash).toBe("3fd3fd0003fd3fd00041d41d00041d6b5eefa2404a56c2ced79a0d16afe36c")
      expect(section.certificate).toBeDefined()
      expect(section.favicon.mmh3).toBe("1234567890")
      expect(section.favicon.md5).toBe("abcdef1234567890")
      expect(section.hashes.bodyMd5).toBe("abc123")
    })
  })

  describe("buildDomainIntelligenceSection", () => {
    it("should build domain intelligence section with RDAP metadata", () => {
      const result = createMockResult()
      const section = buildDomainIntelligenceSection(result)

      expect(section.metadata).toHaveLength(1)
      expect(section.metadata[0].subject).toBe("example.com")
      expect(section.metadata[0].registrarName).toBe("Example Registrar")
      expect(section.metadata[0].registrationDate).toBe("2024-01-01T00:00:00Z")
      expect(section.metadata[0].expirationDate).toBe("2025-01-01T00:00:00Z")
      expect(section.metadata[0].nameservers).toContain("NS1.EXAMPLE.COM")
      expect(section.metadata[0].provenance).toBe("original")
      expect(section.hasOriginalDomain).toBe(true)
      expect(section.hasFinalDomain).toBe(false)
    })

    it("should deduplicate status values to prevent duplicate-key runtime errors", () => {
      const result = createMockResult({
        nuclei: {
          ...createMockResult().nuclei,
          findings: [
            {
              matchId: "finding-dup-status",
              templateId: "rdap-whois",
              templatePath: null,
              matcherName: null,
              protocolType: "whois",
              severity: null,
              matchedAt: "example.com",
              host: "example.com",
              ip: null,
              port: null,
              scheme: null,
              url: null,
              path: null,
              extractedResults: [
                "client transfer prohibited",
                "client transfer prohibited",
                "client delete prohibited",
              ],
              technologyName: null,
              technologyVersion: null,
              findingKind: "domain_metadata",
              subject: "example.com",
              subjectType: "domain",
              raw: {
                "extractor-name": ["status", "status", "status"],
              },
            },
          ],
        },
      })

      const section = buildDomainIntelligenceSection(result)

      expect(section.metadata).toHaveLength(1)
      expect(section.metadata[0].status).toHaveLength(2)
      expect(section.metadata[0].status).toContain("client transfer prohibited")
      expect(section.metadata[0].status).toContain("client delete prohibited")
      const uniqueStatuses = new Set(section.metadata[0].status)
      expect(uniqueStatuses.size).toBe(section.metadata[0].status.length)
    })

    it("should extract multiple nameservers with case-insensitive deduplication", () => {
      const result = createMockResult({
        nuclei: {
          ...createMockResult().nuclei,
          findings: [
            {
              matchId: "finding-ns",
              templateId: "rdap-whois",
              templatePath: null,
              matcherName: null,
              protocolType: "whois",
              severity: null,
              matchedAt: "example.com",
              host: "example.com",
              ip: null,
              port: null,
              scheme: null,
              url: null,
              path: null,
              extractedResults: [
                "NS1.EXAMPLE.COM",
                "ns1.example.com",
                "NS2.EXAMPLE.COM",
                "ns2.example.com",
                "NS3.EXAMPLE.COM",
              ],
              technologyName: null,
              technologyVersion: null,
              findingKind: "domain_metadata",
              subject: "example.com",
              subjectType: "domain",
              raw: {
                "extractor-name": ["nameservers", "nameservers", "nameservers", "nameservers", "nameservers"],
              },
            },
          ],
        },
      })

      const section = buildDomainIntelligenceSection(result)

      expect(section.metadata).toHaveLength(1)
      expect(section.metadata[0].nameservers).toHaveLength(3)
      expect(section.metadata[0].nameservers.map(ns => ns.toLowerCase()).sort()).toEqual([
        "ns1.example.com",
        "ns2.example.com",
        "ns3.example.com",
      ])
    })

    it("should extract all nameservers from a single nameservers extractor result", () => {
      const result = createMockResult({
        nuclei: {
          ...createMockResult().nuclei,
          findings: [
            {
              matchId: "finding-single-extractor-ns",
              templateId: "rdap-whois",
              templatePath: null,
              matcherName: null,
              protocolType: "whois",
              severity: null,
              matchedAt: "example.com",
              host: "example.com",
              ip: null,
              port: null,
              scheme: null,
              url: null,
              path: null,
              extractedResults: [
                "NS1.EXAMPLE.TEST",
                "NS2.EXAMPLE.TEST",
              ],
              technologyName: null,
              technologyVersion: null,
              findingKind: "domain_metadata",
              subject: "example.com",
              subjectType: "domain",
              raw: {
                "extractor-name": "nameServers",
              },
            },
          ],
        },
      })

      const section = buildDomainIntelligenceSection(result)

      expect(section.metadata).toHaveLength(1)
      expect(section.metadata[0].nameservers).toEqual([
        "NS1.EXAMPLE.TEST",
        "NS2.EXAMPLE.TEST",
      ])
    })

    it("should handle cross-domain redirects with both original and final domain metadata", () => {
      const result = createMockResult({
        nuclei: {
          ...createMockResult().nuclei,
          findings: [
            ...createMockResult().nuclei.findings,
            {
              matchId: "finding-3",
              templateId: "rdap-whois",
              templatePath: null,
              matcherName: null,
              protocolType: "whois",
              severity: null,
              matchedAt: "www.example.com",
              host: "www.example.com",
              ip: null,
              port: null,
              scheme: null,
              url: null,
              path: null,
              extractedResults: ["Another Registrar"],
              technologyName: null,
              technologyVersion: null,
              findingKind: "domain_metadata",
              subject: "www.example.com",
              subjectType: "domain",
              raw: { "extractor-name": ["registrarName"] },
            },
          ],
        },
      })

      const section = buildDomainIntelligenceSection(result)

      expect(section.metadata).toHaveLength(2)
      expect(section.hasOriginalDomain).toBe(true)
      expect(section.hasFinalDomain).toBe(true)
    })
  })

  describe("buildContentSignalsSection", () => {
    it("should build content signals section", () => {
      const result = createMockResult()
      const section = buildContentSignalsSection(result)

      expect(section.bodyPreview).toBe("<!DOCTYPE html><html><head><title>Example</title></head><body>...</body></html>")
      expect(section.contentLength).toBe(1024)
      expect(section.bodyDomains).toEqual(["google.com", "social-d.example.test"])
      expect(section.bodyFqdns).toEqual(["www.google.com", "api.social-d.example.test"])
      expect(section.screenshot.available).toBe(true)
      expect(section.robotsTxt).toBeNull() // No robots.txt in mock
    })
  })

  describe("buildRawEvidenceSection", () => {
    it("should build raw evidence section", () => {
      const result = createMockResult()
      const section = buildRawEvidenceSection(result)

      expect(section.rawHttpx).toEqual({ url: "https://example.com", status_code: 200 })
      expect(section.nuclei.state).toBe("completed")
      expect(section.nuclei.findings).toHaveLength(2)
      expect(section.nuclei.technologies).toHaveLength(1)
    })
  })

  describe("buildScanDetailPageViewModel", () => {
    it("should build complete page view-model", () => {
      const scanDetail: GetScanResponse = {
        scanId: "test-scan-id",
        status: "completed",
        source: "api",
        target: { inputTarget: "example.com", normalizedTarget: "example.com", canonicalTargetId: "canonical-1" },
        currentAttempt: {
          attemptId: "attempt-1",
          attemptNumber: 1,
          status: "completed",
          requestProfile: "baseline",
          fallbackReason: null,
          resultCount: 1,
          forbiddenResultCount: 0,
        },
        attemptHistory: [],
        progress: {
          resultCount: 1,
        },
      }

      const scanRecord = {
        submittedAt: new Date("2024-01-01T00:00:00Z"),
        completedAt: new Date("2024-01-01T00:01:00Z"),
      }

      const primaryResult = createMockResult()

      const viewModel = buildScanDetailPageViewModel({
        scanId: "test-scan-id",
        scanDetail,
        scanRecord,
        primaryResult,
        targetHistory: null,
        technologyDisplay: null,
      })

      expect(viewModel.scanId).toBe("test-scan-id")
      expect(viewModel.scanStatus).toBe("completed")
      expect(viewModel.source).toBe("api")
      expect(viewModel.target).toBe("example.com")
      expect(viewModel.isActive).toBe(false)
      expect(viewModel.heroStatus).toBe("completed")
      expect(viewModel.overview).not.toBeNull()
      expect(viewModel.technology).not.toBeNull()
      expect(viewModel.deliveryRedirects).not.toBeNull()
      expect(viewModel.dnsInfrastructure).not.toBeNull()
      expect(viewModel.tlsFingerprints).not.toBeNull()
      expect(viewModel.domainIntelligence).not.toBeNull()
      expect(viewModel.contentSignals).not.toBeNull()
      expect(viewModel.rawEvidence).not.toBeNull()
    })

    it("should handle warming-up state with no primary result", () => {
      const scanDetail: GetScanResponse = {
        scanId: "test-scan-id",
        status: "running",
        source: "api",
        target: { inputTarget: "example.com", normalizedTarget: "example.com", canonicalTargetId: "canonical-1" },
        currentAttempt: {
          attemptId: "attempt-1",
          attemptNumber: 1,
          status: "running",
          requestProfile: "baseline",
          fallbackReason: null,
          resultCount: 0,
          forbiddenResultCount: 0,
        },
        attemptHistory: [],
        progress: {
          resultCount: 0,
        },
      }

      const scanRecord = {
        submittedAt: new Date("2024-01-01T00:00:00Z"),
        completedAt: null,
      }

      const viewModel = buildScanDetailPageViewModel({
        scanId: "test-scan-id",
        scanDetail,
        scanRecord,
        primaryResult: null,
        targetHistory: null,
        technologyDisplay: null,
      })

      expect(viewModel.isActive).toBe(true)
      expect(viewModel.heroStatus).toBe("running")
      expect(viewModel.overview).toBeNull()
      expect(viewModel.technology).toBeNull()
      expect(viewModel.target).toBe("example.com")
    })

    it("should preserve nuclei provenance information", () => {
      const result = createMockResult({
        nuclei: {
          ...createMockResult().nuclei,
          run: {
            ...createMockResult().nuclei.run!,
            originalDomainTarget: "old-domain.test",
            finalDomainTarget: "new-domain.test",
          },
          findings: [
            {
              matchId: "finding-1",
              templateId: "dns-saas-service-detection",
              templatePath: null,
              matcherName: "Service on Original",
              protocolType: "dns",
              severity: "info",
              matchedAt: "old-domain.test",
              host: "old-domain.test",
              ip: null,
              port: null,
              scheme: null,
              url: null,
              path: null,
              extractedResults: ["Service A"],
              technologyName: null,
              technologyVersion: null,
              findingKind: "dns_service",
              subject: "old-domain.test",
              subjectType: "domain",
              raw: {},
            },
            {
              matchId: "finding-2",
              templateId: "dns-saas-service-detection",
              templatePath: null,
              matcherName: "Service on Final",
              protocolType: "dns",
              severity: "info",
              matchedAt: "new-domain.test",
              host: "new-domain.test",
              ip: null,
              port: null,
              scheme: null,
              url: null,
              path: null,
              extractedResults: ["Service B"],
              technologyName: null,
              technologyVersion: null,
              findingKind: "dns_service",
              subject: "new-domain.test",
              subjectType: "domain",
              raw: {},
            },
          ],
        },
      })

      const dnsSection = buildDnsInfrastructureSection(result)

      expect(dnsSection.dnsServices).toHaveLength(2)
      expect(dnsSection.dnsServices[0].provenance).toBe("original")
      expect(dnsSection.dnsServices[1].provenance).toBe("final")
    })
  })
})
