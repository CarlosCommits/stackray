import type {
  NucleiSchema,
  ScanResultItem,
  GetScanResponse,
} from "@/lib/contracts/scans";
import {
  type StructuredTechnologyDetection,
  type TechnologyBucketId,
} from "@/lib/server/scans/technology-metadata-catalog";
import { resolveHostingDisplay } from "@/lib/server/scans/hosting-display";

// Section view-model types

export interface OverviewSection {
  statusCode: number;
  statusText: string;
  redirectCount: number;
  server: string | null;
  cdnName: string;
  hostIp: string | null;
  asnOrg: string | null;
  finalUrl: string;
  title: string;
  responseTimeMs: number;
  contentType: string | null;
  contentLength: number;
}

export interface TechnologySection {
  buckets: TechnologyBucket[];
  nucleiTechnologies: NucleiTechnologyMatch[];
  cpeEntries: CpeEntry[];
  totalCount: number;
}

export type TechnologyItem = StructuredTechnologyDetection;

export interface TechnologyBucket {
  id: TechnologyBucketId;
  label: string;
  items: TechnologyItem[];
}

const technologyBucketLabels: Record<TechnologyBucketId, string> = {
  platform: "Platform",
  framework: "Framework",
  infrastructure: "Infrastructure / Backend",
  business: "Business Tools",
  security: "Security / Privacy",
  ecosystem: "Ecosystem Add-ons",
  other: "Other",
};

export interface CpeEntry {
  cpe: string;
  vendor: string | null;
  product: string | null;
}

export interface NucleiTechnologyMatch {
  name: string;
  matchedAt: string | null;
}

export interface DeliveryRedirectsSection {
  input: string;
  url: string;
  finalUrl: string;
  path: string;
  method: string;
  statusCode: number;
  location: string | null;
  responseTimeMs: number;
  contentType: string | null;
  contentLength: number;
  redirectChain: {
    statusCodes: number[];
    items: RedirectHop[];
  };
}

export interface RedirectHop {
  url?: string;
  statusCode?: number;
  location?: string | null;
  contentLength?: number;
  responseTimeMs?: number;
}

export interface DnsInfrastructureSection {
  hostIp: string | null;
  a: string[];
  aaaa: string[];
  cname: string[];
  resolvers: string[];
  asn: {
    asNumber: string | null;
    org: string | null;
    country: string | null;
    range: string[] | undefined;
  };
  capabilities: {
    http2: boolean;
    pipeline: boolean;
    websocket: boolean;
    vhost: boolean;
  };
  // Nuclei-derived DNS services
  dnsServices: DnsServiceFinding[];
  txtRecords: TxtRecordFinding[];
  nameservers: string[];
}

export interface DnsServiceFinding {
  serviceName: string;
  matchedAt: string | null;
  subject: string | null;
  subjectType: string | null;
  provenance: DomainProvenance;
}

export interface TxtRecordFinding {
  records: string[];
  subject: string | null;
  provenance: DomainProvenance;
}

export type DomainProvenance = "original" | "final" | "url" | "unknown";

export interface TlsFingerprintsSection {
  sni: string | null;
  jarmHash: string | null;
  certificate: Record<string, unknown> | undefined;
  favicon: {
    mmh3: string | null;
    md5: string | null;
    url: string | null;
    path: string | null;
  };
  hashes: Record<string, string>;
  // Nuclei SSL findings
  sslDnsNames: SslDnsNamesFinding[];
  sslIssuers: SslIssuerFinding[];
}

export interface SslDnsNamesFinding {
  subjectAltNames: string[];
  matchedAt: string | null;
}

export interface SslIssuerFinding {
  issuer: string;
  matchedAt: string | null;
}

export interface DomainIntelligenceSection {
  metadata: DomainMetadata[];
  hasOriginalDomain: boolean;
  hasFinalDomain: boolean;
}

export interface DomainMetadata {
  subject: string;
  registrarName: string | null;
  registrarIanaId: string | null;
  registrarUrl: string | null;
  registrarEmail: string | null;
  registrarPhone: string | null;
  registrationDate: string | null;
  expirationDate: string | null;
  lastChangedDate: string | null;
  nameservers: string[];
  dnssec: string | null;
  status: string[];
  provenance: DomainProvenance;
}

export interface ContentSignalsSection {
  bodyPreview: string;
  contentLength: number;
  bodyDomains: string[];
  bodyFqdns: string[];
  screenshot: {
    available: boolean;
    path: string | null;
    contentType: string | null;
    byteSize: number | null;
    capturedAt: string | null;
  };
  robotsTxt: RobotsTxtFinding | null;
}

export interface RobotsTxtFinding {
  exists: boolean;
  matchedAt: string | null;
  extractedResults: string[];
}

export interface RawEvidenceSection {
  rawHttpx: Record<string, unknown>;
  nuclei: NucleiSchema;
}

export interface HistorySection {
  target: string;
  items: HistoryItem[];
}

export interface HistoryItem {
  scanId: string;
  status: "completed" | "failed" | "cancelled";
  title: string;
  technologies: string[];
  completedAt: string;
}

interface ScanDetailPageViewModel {
  // Scan-level state
  scanId: string;
  scanStatus: GetScanResponse["status"];
  source: string;
  submittedAt: string;
  completedAt: string | null;
  target: string;
  isActive: boolean;
  heroStatus: "completed" | "running" | "failed" | "cancelled";
  currentAttempt: GetScanResponse["currentAttempt"] | null;
  attemptHistory: GetScanResponse["attemptHistory"];

  // Primary result sections (null if no result yet)
  overview: OverviewSection | null;
  technology: TechnologySection | null;
  deliveryRedirects: DeliveryRedirectsSection | null;
  dnsInfrastructure: DnsInfrastructureSection | null;
  tlsFingerprints: TlsFingerprintsSection | null;
  domainIntelligence: DomainIntelligenceSection | null;
  contentSignals: ContentSignalsSection | null;
  rawEvidence: RawEvidenceSection | null;

  // History
  history: HistorySection | null;
}

function addUniqueCaseInsensitive(values: string[], nextValue: string) {
  const normalizedNextValue = nextValue.toLowerCase();

  if (!values.some((existingValue) => existingValue.toLowerCase() === normalizedNextValue)) {
    values.push(nextValue);
  }
}

function looksLikeNameserver(value: string) {
  return /^ns\d*\./i.test(value) || /\.ns\./i.test(value);
}

// Helper functions for nuclei provenance

function determineDomainProvenance(
  subject: string | null,
  subjectType: string | null,
  originalDomainTarget: string | null,
  finalDomainTarget: string | null,
  targetUrl: string | null
): DomainProvenance {
  if (!subject) return "unknown";

  // Check if subject matches URL target
  if (targetUrl && (subject === targetUrl || subject.startsWith(targetUrl))) {
    return "url";
  }

  // Check original domain
  if (originalDomainTarget && subject === originalDomainTarget) {
    return "original";
  }

  // Check final domain
  if (finalDomainTarget && subject === finalDomainTarget) {
    return "final";
  }

  // For domain subject type, try to infer from suffix matching
  if (subjectType === "domain") {
    if (originalDomainTarget && subject.endsWith(originalDomainTarget)) {
      return "original";
    }
    if (finalDomainTarget && subject.endsWith(finalDomainTarget)) {
      return "final";
    }
  }

  return "unknown";
}

// Section builders

export function buildOverviewSection(result: ScanResultItem): OverviewSection {
  const redirectCount = result.redirectChain?.statusCodes?.length
    ? result.redirectChain.statusCodes.length - 1
    : 0;
  const hostedOn = resolveHostedOn(result);

  return {
    statusCode: result.statusCode,
    statusText: getStatusText(result.statusCode),
    redirectCount,
    server: hostedOn.server,
    cdnName: hostedOn.cdnName,
    hostIp: result.dns?.hostIp ?? null,
    asnOrg: result.asn?.org ?? null,
    finalUrl: result.finalUrl,
    title: result.title,
    responseTimeMs: result.responseTimeMs,
    contentType: result.contentType,
    contentLength: result.contentLength,
  };
}

function getStatusText(statusCode: number): string {
  if (statusCode === 200) return "OK";
  if (statusCode === 301) return "Moved Permanently";
  if (statusCode === 302) return "Found";
  if (statusCode === 304) return "Not Modified";
  if (statusCode === 400) return "Bad Request";
  if (statusCode === 401) return "Unauthorized";
  if (statusCode === 403) return "Forbidden";
  if (statusCode === 404) return "Not Found";
  if (statusCode === 500) return "Internal Server Error";
  if (statusCode === 502) return "Bad Gateway";
  if (statusCode === 503) return "Service Unavailable";
  return "Unknown";
}

function buildFallbackTechnologyBuckets(detections: readonly TechnologyItem[]): TechnologyBucket[] {
  const order: TechnologyBucketId[] = [
    "platform",
    "framework",
    "infrastructure",
    "business",
    "security",
    "ecosystem",
    "other",
  ];
  const bucketMap = new Map<TechnologyBucketId, TechnologyItem[]>();

  for (const bucketId of order) {
    bucketMap.set(bucketId, []);
  }

  for (const detection of detections) {
    bucketMap.get(detection.bucket)?.push(detection);
  }

  return order.flatMap((bucketId): TechnologyBucket[] => {
    const items = bucketMap.get(bucketId) ?? [];

    if (items.length === 0) {
      return [];
    }

    return [{
      id: bucketId,
      label: technologyBucketLabels[bucketId],
      items,
    }];
  });
}

function resolveHostedOn(result: ScanResultItem) {
  const hostedOn = resolveHostingDisplay(result);

  return {
    server: hostedOn.server,
    cdnName: hostedOn.cdnName ?? "none",
  }
}

export function buildTechnologySection(
  result: ScanResultItem,
  technologyDisplay: {
    buckets: TechnologyBucket[];
  } | null
): TechnologySection {
  const buckets = technologyDisplay?.buckets ?? buildFallbackTechnologyBuckets(result.technologyDetections);

  const nucleiTechnologies = result.nuclei.technologies.map((match) => ({
    name: match.technologyName ?? match.templateId,
    matchedAt: match.matchedAt,
  }));

  const cpeEntries = result.cpe.map((entry) => ({
    cpe: entry.cpe,
    vendor: entry.vendor,
    product: entry.product,
  }));

  return {
    buckets,
    nucleiTechnologies,
    cpeEntries,
    totalCount: buckets.reduce((count, bucket) => count + bucket.items.length, 0) + cpeEntries.length,
  };
}

export function buildDeliveryRedirectsSection(result: ScanResultItem): DeliveryRedirectsSection {
  return {
    input: result.input,
    url: result.url,
    finalUrl: result.finalUrl,
    path: result.path,
    method: result.method,
    statusCode: result.statusCode,
    location: result.location,
    responseTimeMs: result.responseTimeMs,
    contentType: result.contentType,
    contentLength: result.contentLength,
    redirectChain: result.redirectChain ?? { statusCodes: [], items: [] },
  };
}

export function buildDnsInfrastructureSection(result: ScanResultItem): DnsInfrastructureSection {
  const nucleiRun = result.nuclei.run;
  const originalDomainTarget = nucleiRun?.originalDomainTarget ?? null;
  const finalDomainTarget = nucleiRun?.finalDomainTarget ?? null;
  const targetUrl = nucleiRun?.targetUrl ?? null;

  // Extract DNS service findings from nuclei
  const dnsServices: DnsServiceFinding[] = [];
  const txtRecords: TxtRecordFinding[] = [];
  const nameservers: string[] = [];

  for (const finding of result.nuclei.findings) {
    const provenance = determineDomainProvenance(
      finding.subject,
      finding.subjectType,
      originalDomainTarget,
      finalDomainTarget,
      targetUrl
    );

    if (finding.findingKind === "dns_service") {
      // Extract service name from extracted results or template ID
      const serviceName = finding.extractedResults[0] ??
        finding.matcherName ??
        finding.templateId;

      dnsServices.push({
        serviceName,
        matchedAt: finding.matchedAt,
        subject: finding.subject,
        subjectType: finding.subjectType,
        provenance,
      });
    }

    if (finding.findingKind === "txt_record") {
      txtRecords.push({
        records: finding.extractedResults,
        subject: finding.subject,
        provenance,
      });
    }

      // Collect nameservers from domain_metadata findings
    if (finding.findingKind === "domain_metadata") {
      const raw = finding.raw || {};
      const extractors = Array.isArray(raw["extractor-name"])
        ? (raw["extractor-name"] as string[])
        : typeof raw["extractor-name"] === "string"
          ? [raw["extractor-name"] as string]
          : [];

      extractors.forEach((name, index) => {
        const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (normalizedName.includes("nameserver")) {
          const nameserverValues = extractors.length === 1
            ? finding.extractedResults
            : [finding.extractedResults[index]].filter((value): value is string => Boolean(value));

          for (const nameserverValue of nameserverValues) {
            addUniqueCaseInsensitive(nameservers, nameserverValue);
          }
        }
      });

      // Also check extracted results for nameserver patterns
      for (const extractedResult of finding.extractedResults) {
        if (looksLikeNameserver(extractedResult)) {
          addUniqueCaseInsensitive(nameservers, extractedResult);
        }
      }
    }
  }

  return {
    hostIp: result.dns?.hostIp ?? null,
    a: result.dns?.a ?? [],
    aaaa: result.dns?.aaaa ?? [],
    cname: result.dns?.cname ?? [],
    resolvers: result.dns?.resolvers ?? [],
    asn: {
      asNumber: result.asn?.asNumber ?? null,
      org: result.asn?.org ?? null,
      country: result.asn?.country ?? null,
      range: result.asn?.range,
    },
    capabilities: result.capabilities ?? {
      http2: false,
      pipeline: false,
      websocket: false,
      vhost: false,
    },
    dnsServices,
    txtRecords,
    nameservers,
  };
}

export function buildTlsFingerprintsSection(result: ScanResultItem): TlsFingerprintsSection {
  const sslDnsNames: SslDnsNamesFinding[] = [];
  const sslIssuers: SslIssuerFinding[] = [];

  for (const finding of result.nuclei.findings) {
    if (finding.findingKind === "ssl_dns_names") {
      sslDnsNames.push({
        subjectAltNames: finding.extractedResults,
        matchedAt: finding.matchedAt,
      });
    }

    if (finding.findingKind === "ssl_issuer") {
      sslIssuers.push({
        issuer: finding.extractedResults[0] ?? finding.matcherName ?? "Unknown",
        matchedAt: finding.matchedAt,
      });
    }
  }

  return {
    sni: result.tls?.sni ?? null,
    jarmHash: result.tls?.jarmHash ?? null,
    certificate: result.tls?.certificate,
    favicon: result.favicon ?? {
      mmh3: null,
      md5: null,
      url: null,
      path: null,
    },
    hashes: result.hashes ?? {},
    sslDnsNames,
    sslIssuers,
  };
}

export function buildDomainIntelligenceSection(result: ScanResultItem): DomainIntelligenceSection {
  const nucleiRun = result.nuclei.run;
  const originalDomainTarget = nucleiRun?.originalDomainTarget ?? null;
  const finalDomainTarget = nucleiRun?.finalDomainTarget ?? null;
  const targetUrl = nucleiRun?.targetUrl ?? null;

  const metadataBySubject = new Map<string, DomainMetadata>();

  for (const finding of result.nuclei.findings) {
    if (finding.findingKind !== "domain_metadata") continue;

    const subject = finding.subject ?? finding.matchedAt ?? "unknown";
    const provenance = determineDomainProvenance(
      finding.subject,
      finding.subjectType,
      originalDomainTarget,
      finalDomainTarget,
      targetUrl
    );

    let metadata = metadataBySubject.get(subject);
    if (!metadata) {
      metadata = {
        subject,
        registrarName: null,
        registrarIanaId: null,
        registrarUrl: null,
        registrarEmail: null,
        registrarPhone: null,
        registrationDate: null,
        expirationDate: null,
        lastChangedDate: null,
        nameservers: [],
        dnssec: null,
        status: [],
        provenance,
      };
      metadataBySubject.set(subject, metadata);
    }

    // Parse RDAP metadata from raw nuclei output
    const raw = finding.raw || {};
    const extracted = finding.extractedResults || [];

    const extractors = Array.isArray(raw["extractor-name"])
      ? (raw["extractor-name"] as string[])
      : typeof raw["extractor-name"] === "string"
        ? [raw["extractor-name"] as string]
        : [];

    if (extractors.length > 0) {
      extractors.forEach((name, index) => {
        const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
        const value = extracted[index];
        if (!value) return;

        if (normalizedName === "registrarname") {
          metadata!.registrarName = value;
        } else if (normalizedName === "registrarianaid") {
          metadata!.registrarIanaId = value;
        } else if (normalizedName === "registrarurl") {
          metadata!.registrarUrl = value;
        } else if (normalizedName === "registraremail") {
          metadata!.registrarEmail = value;
        } else if (normalizedName === "registrarphone" || normalizedName === "registrartel") {
          metadata!.registrarPhone = value;
        } else if (normalizedName === "registrationdate" || normalizedName === "createddate") {
          metadata!.registrationDate = value;
        } else if (normalizedName === "expirationdate" || normalizedName === "expiresdate") {
          metadata!.expirationDate = value;
        } else if (normalizedName === "lastchangedate" || normalizedName === "lastupdateddate") {
          metadata!.lastChangedDate = value;
        } else if (normalizedName === "securedns" || normalizedName === "dnssec") {
          metadata!.dnssec = value;
        } else if (normalizedName === "status") {
          if (!metadata!.status.includes(value)) {
            metadata!.status.push(value);
          }
        } else if (normalizedName.includes("nameserver")) {
          const nameserverValues = extractors.length === 1
            ? extracted
            : [value];

          for (const nameserverValue of nameserverValues) {
            addUniqueCaseInsensitive(metadata!.nameservers, nameserverValue);
          }
        }
      });
    }

    // Fallback: infer from extracted results based on value patterns
    for (const result of extracted) {
      // Date pattern (ISO 8601)
      if (/^\d{4}-\d{2}-\d{2}T/.test(result)) {
        if (!metadata.registrationDate) {
          metadata.registrationDate = result;
        } else if (!metadata.expirationDate) {
          metadata.expirationDate = result;
        }
      }
      // Nameserver pattern
      else if (looksLikeNameserver(result)) {
        addUniqueCaseInsensitive(metadata.nameservers, result);
      }
      // DNSSEC pattern
      else if (/^(true|false)$/i.test(result) || /dnssec|signed|unsigned/i.test(result)) {
        metadata.dnssec = result;
      }
      // URL pattern
      else if (/^https?:\/\//i.test(result) && !metadata.registrarUrl) {
        metadata.registrarUrl = result;
      }
      // Email pattern
      else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) && !metadata.registrarEmail) {
        metadata.registrarEmail = result;
      }
      // Phone pattern
      else if (/^tel:/i.test(result) && !metadata.registrarPhone) {
        metadata.registrarPhone = result;
      }
      // Status codes
      else if (/^(client|server)/i.test(result)) {
        if (!metadata.status.includes(result)) {
          metadata.status.push(result);
        }
      }
      // Registrar (contains spaces, looks like a company name)
      else if (/[A-Z][a-z]+.*[A-Z][a-z]+/.test(result) && !result.includes(".") && !metadata.registrarName) {
        metadata.registrarName = result;
      }
    }
  }

  const metadata = Array.from(metadataBySubject.values());

  return {
    metadata,
    hasOriginalDomain: metadata.some((m) => m.provenance === "original"),
    hasFinalDomain: metadata.some((m) => m.provenance === "final"),
  };
}

export function buildContentSignalsSection(result: ScanResultItem): ContentSignalsSection {
  // Find robots.txt finding
  let robotsTxt: RobotsTxtFinding | null = null;

  for (const finding of result.nuclei.findings) {
    if (finding.findingKind === "robots_txt") {
      robotsTxt = {
        exists: true,
        matchedAt: finding.matchedAt,
        extractedResults: finding.extractedResults,
      };
      break;
    }
  }

  return {
    bodyPreview: result.bodyPreview,
    contentLength: result.contentLength,
    bodyDomains: result.bodyDomains,
    bodyFqdns: result.bodyFqdns,
    screenshot: result.screenshot,
    robotsTxt,
  };
}

export function buildRawEvidenceSection(result: ScanResultItem): RawEvidenceSection {
  return {
    rawHttpx: result.rawHttpx,
    nuclei: result.nuclei,
  };
}

interface HistorySectionInput {
  target: string;
  items: Array<{
    scanId: string;
    status: "completed" | "failed" | "cancelled";
    title: string;
    technologies: string[];
    completedAt: string;
  }>;
}

function buildHistorySection(input: HistorySectionInput | null): HistorySection | null {
  if (!input) return null;

  return {
    target: input.target,
    items: input.items,
  };
}

// Main view-model builder

interface BuildScanDetailPageViewModelInput {
  scanId: string;
  scanDetail: GetScanResponse;
  scanRecord: {
    submittedAt: Date;
    completedAt: Date | null;
  };
  primaryResult: ScanResultItem | null;
  targetHistory: HistorySectionInput | null;
  technologyDisplay: {
    buckets: TechnologyBucket[];
  } | null;
}

export function buildScanDetailPageViewModel(
  input: BuildScanDetailPageViewModelInput
): ScanDetailPageViewModel {
  const { scanId, scanDetail, scanRecord, primaryResult, targetHistory, technologyDisplay } = input;

  const primaryTarget = scanDetail.target.normalizedTarget ?? null;
  const target = primaryTarget ?? primaryResult?.target ?? "Pending target";

  const isActive =
    scanDetail.status === "queued" ||
    scanDetail.status === "running" ||
    scanDetail.status === "processing";

  const heroStatus: "completed" | "running" | "failed" | "cancelled" =
    scanDetail.status === "completed" ||
    scanDetail.status === "failed" ||
    scanDetail.status === "cancelled"
      ? scanDetail.status
      : "running";

  return {
    // Scan-level state
    scanId,
    scanStatus: scanDetail.status,
    source: scanDetail.source,
    submittedAt: scanRecord.submittedAt.toISOString(),
    completedAt: scanRecord.completedAt?.toISOString() ?? null,
    target,
    isActive,
    heroStatus,
    currentAttempt: scanDetail.currentAttempt,
    attemptHistory: scanDetail.attemptHistory,

    // Primary result sections
    overview: primaryResult ? buildOverviewSection(primaryResult) : null,
    technology: primaryResult ? buildTechnologySection(primaryResult, technologyDisplay) : null,
    deliveryRedirects: primaryResult ? buildDeliveryRedirectsSection(primaryResult) : null,
    dnsInfrastructure: primaryResult ? buildDnsInfrastructureSection(primaryResult) : null,
    tlsFingerprints: primaryResult ? buildTlsFingerprintsSection(primaryResult) : null,
    domainIntelligence: primaryResult ? buildDomainIntelligenceSection(primaryResult) : null,
    contentSignals: primaryResult ? buildContentSignalsSection(primaryResult) : null,
    rawEvidence: primaryResult ? buildRawEvidenceSection(primaryResult) : null,

    // History
    history: buildHistorySection(targetHistory),
  };
}
