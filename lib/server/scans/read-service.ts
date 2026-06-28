import { and, asc, desc, eq, ilike, inArray, lt, ne, or, sql, type SQL } from "drizzle-orm";

import type { RecentScan, RecentScansPage, Stat } from "@/components/dashboard/types";
import type { ActorContext } from "@/lib/session/actor-context";
import {
  scanAttempts,
  ipEnrichments,
  scanPhaseRuns,
  scanResultDetections,
  scanResultNucleiMatches,
  scanResultNucleiRuns,
  scanResults,
  scanSubdomainDiscoveryRuns,
  scanSubdomains,
  scans,
} from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import {
  getScanResponseSchema,
  getScanResultsResponseSchema,
  getScanSubdomainsResponseSchema,
  getScanTechnologiesResponseSchema,
  getResultTechnologiesResponseSchema,
  scanReportResponseSchema,
  listScansResponseSchema,
  scanResultItemSchema,
  scanPhaseRunSchema,
  scanSubdomainSummarySchema,
  type ScanListItem,
} from "@/lib/contracts/scans";
import {
  getTargetTechnologiesResponseSchema,
  targetHistoryResponseSchema,
} from "@/lib/contracts/targets";
import { getVisibleScansFilter } from "@/lib/server/scans/access";
import {
  buildEnrichedTechnologies,
  buildEnrichedTechnologyDetections,
  type TechnologyEvidenceItem,
} from "@/lib/server/scans/technology-enrichment";
import { normalizeRedirectChainItems } from "@/lib/server/scans/redirect-chain";
import { resolveHostingDisplay } from "@/lib/server/scans/hosting-display";
import {
  buildStructuredTechnologyDetection,
  normalizeTechnologyKey,
} from "@/lib/server/scans/technology-metadata-catalog";
import { extractCpeVersion } from "@/lib/server/scans/cpe";
import { selectAuthoritativeScanResult } from "@/lib/server/scans/result-selection";

type AttemptStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
type RequestProfile = "baseline" | "browser_headers";
type DetectionKind = "technology" | "wordpress_plugin" | "wordpress_theme" | "cpe";
type DetectionSource = "wappalyzer" | "wordpress" | "cpe" | "derived" | "nuclei";
type TechnologyInventoryItem = {
  scanId: string;
  resultId: string;
  canonicalTargetId: string | null;
  url: string;
  kind: DetectionKind;
  sources: DetectionSource[];
  displayName: string;
  normalizedName: string;
  version: string | null;
  description: string | null;
  website: string | null;
  iconUrl: string | null;
  categories: string[];
  primaryCategory: string | null;
  bucket: "platform" | "framework" | "infrastructure" | "business" | "security" | "ecosystem" | "other";
  inferred: boolean;
  vendor: string | null;
  product: string | null;
  cpe: string | null;
};

const detectionSourcePrecedence: Record<DetectionSource, number> = {
  wappalyzer: 0,
  wordpress: 1,
  cpe: 2,
  derived: 3,
  nuclei: 4,
};

function sortDetectionSources(sources: Iterable<DetectionSource>) {
  return [...sources].toSorted((left, right) => detectionSourcePrecedence[left] - detectionSourcePrecedence[right]);
}

type ScanRecord = typeof scans.$inferSelect;
type AttemptRecord = typeof scanAttempts.$inferSelect;
type ResultRecord = typeof scanResults.$inferSelect;
type IpEnrichmentRecord = typeof ipEnrichments.$inferSelect;
type NucleiRunRecord = typeof scanResultNucleiRuns.$inferSelect;
type NucleiMatchRecord = typeof scanResultNucleiMatches.$inferSelect;
type ScanPhaseRunRecord = typeof scanPhaseRuns.$inferSelect;
type SubdomainDiscoveryRunRecord = typeof scanSubdomainDiscoveryRuns.$inferSelect;
type SubdomainRecord = typeof scanSubdomains.$inferSelect;

const DEFAULT_SCAN_LIST_LIMIT = 20;
const MAX_SCAN_LIST_LIMIT = 100;
const DEFAULT_REPORT_SUBDOMAIN_LIMIT = 50;

type InternalReverseIpMatch = {
  scanId: string;
  resultId: string;
  target: string;
  finalUrl: string;
  title: string;
  observedAt: string;
};

export type ResultDecorations = {
  technologies: TechnologyEvidenceItem[];
  wordpressPlugins: string[];
  wordpressThemes: string[];
  cpe: Array<{
    cpe: string;
    vendor: string | null;
    product: string | null;
    version?: string | null;
  }>;
  nucleiRun: NucleiRunRecord | null;
  nucleiMatches: NucleiMatchRecord[];
  nucleiTechnologyNames: string[];
};

export function selectAuthoritativeResultRecord(
  results: readonly ResultRecord[],
  scan: Pick<ScanRecord, "normalizedTarget">,
) {
  return selectAuthoritativeScanResult(results, scan.normalizedTarget);
}

export interface ScanListFilters {
  status?: ScanRecord["status"];
  source?: ScanRecord["source"];
  target?: string | null;
  limit?: number;
}

interface ScanResultsFilters {
  page?: number;
  pageSize?: number;
  target?: string | null;
  technology?: string | null;
  source?: string | null;
  bucket?: string | null;
  statusCode?: number | null;
  includeIncomplete?: boolean;
  scope?: "authoritative" | "all-results" | "result";
  resultId?: string | null;
}

interface ScanSubdomainsFilters {
  page?: number;
  pageSize?: number;
  host?: string | null;
  source?: string | null;
}

const DEFAULT_SUBDOMAIN_PAGE_SIZE = 50;
const MAX_SUBDOMAIN_PAGE_SIZE = 250;

export interface CompletedResultSnapshot {
  resultId: string;
  scanId: string;
  canonicalTargetId: string;
  normalizedTarget: string;
  searchDocument: string;
  title: string;
  technologies: string[];
  wordpressPlugins: string[];
  wordpressThemes: string[];
  cpe: string[];
  statusCode: number;
  server: string | null;
  cdn: string | null;
  completedAt: string;
  faviconUrl: string | null;
  screenshotUrl: string | null;
}

type DashboardSparklineScan = Pick<ScanRecord, "status" | "submittedAt">;
type DashboardSparklineSnapshot = Pick<CompletedResultSnapshot, "canonicalTargetId" | "completedAt" | "technologies">;

const dashboardSparklineDayCount = 7;
const runningScanStatuses = new Set<ScanRecord["status"]>(["queued", "running", "processing"]);

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildDashboardSparklineBucketEnds(now: Date) {
  const todayStart = startOfUtcDay(now);
  const firstBucketStart = addUtcDays(todayStart, -(dashboardSparklineDayCount - 1));

  return Array.from({ length: dashboardSparklineDayCount }, (_, index) => addUtcDays(firstBucketStart, index + 1));
}

function buildActiveScanSparkline(runningCount: number) {
  if (runningCount <= 0) {
    return Array.from({ length: dashboardSparklineDayCount }, () => 0);
  }

  return [0, 0, 0, 0, 0, Math.max(1, Math.ceil(runningCount / 2)), runningCount];
}

export function buildDashboardSparklineSeries(
  workspaceScans: DashboardSparklineScan[],
  completedSnapshots: DashboardSparklineSnapshot[],
  now = new Date(),
) {
  const bucketEnds = buildDashboardSparklineBucketEnds(now);
  const runningCount = workspaceScans.filter((scan) => runningScanStatuses.has(scan.status)).length;

  return {
    activeScans: buildActiveScanSparkline(runningCount),
    sitesAnalyzed: bucketEnds.map((bucketEnd) => {
      const targetIds = new Set<string>();

      for (const snapshot of completedSnapshots) {
        if (new Date(snapshot.completedAt) < bucketEnd) {
          targetIds.add(snapshot.canonicalTargetId);
        }
      }

      return targetIds.size;
    }),
    techDiscoveries: bucketEnds.map((bucketEnd) => {
      const technologies = new Set<string>();

      for (const snapshot of completedSnapshots) {
        if (new Date(snapshot.completedAt) < bucketEnd) {
          for (const technology of snapshot.technologies) {
            technologies.add(technology);
          }
        }
      }

      return technologies.size;
    }),
    totalScans: bucketEnds.map((bucketEnd) => workspaceScans.filter((scan) => scan.submittedAt < bucketEnd).length),
  };
}

function getActiveScanPhaseLabel(phaseRuns: readonly ScanPhaseRunRecord[]) {
  const activePhases = phaseRuns.filter((phaseRun) => phaseRun.status === "running" || phaseRun.status === "queued");
  const runningPhase = activePhases.find((phaseRun) => phaseRun.status === "running") ?? activePhases[0] ?? null;

  switch (runningPhase?.phase) {
    case "http_probe":
      return {
        phase: "httpx" as const,
        phaseLabel: "HTTP probe",
        phaseDescription: "Resolving the authoritative HTTP response",
      };
    case "headless":
      return {
        phase: "enrichment" as const,
        phaseLabel: "Headless browser",
        phaseDescription: "Capturing screenshot and runtime technologies",
      };
    case "browser_fallback":
      return {
        phase: "enrichment" as const,
        phaseLabel: "Browser recovery",
        phaseDescription: "Trying real Chrome recovery for a confirmed block",
      };
    case "subfinder":
      return {
        phase: "enrichment" as const,
        phaseLabel: "Subfinder",
        phaseDescription: "Discovering related subdomains",
      };
    case "nuclei_dns":
      return {
        phase: "enrichment" as const,
        phaseLabel: "Nuclei DNS",
        phaseDescription: "Running DNS, RDAP, and TXT templates",
      };
    case "nuclei_http":
      return {
        phase: "enrichment" as const,
        phaseLabel: "Nuclei HTTP",
        phaseDescription: "Running HTTP technology templates",
      };
    case "ip_intel":
      return {
        phase: "enrichment" as const,
        phaseLabel: "IP intelligence",
        phaseDescription: "Enriching provider, RDAP, BGP, PTR, and reverse-IP data",
      };
    case "finalize":
      return {
        phase: "enrichment" as const,
        phaseLabel: "Finalizing",
        phaseDescription: "Waiting for scan phases to finish",
      };
    default:
      return null;
  }
}

function getPhaseProgress(status: ScanRecord["status"], phaseRuns: readonly ScanPhaseRunRecord[]) {
  if (status === "pending" || status === "queued") {
    return 5;
  }

  if (status === "completed") {
    return 100;
  }

  if (status === "failed" || status === "cancelled") {
    return 0;
  }

  const trackedPhases = phaseRuns.filter((phaseRun) => phaseRun.phase !== "finalize");
  const terminalCount = trackedPhases.filter((phaseRun) => ["completed", "failed", "skipped", "cancelled"].includes(phaseRun.status)).length;

  if (trackedPhases.length === 0) {
    return status === "running" ? 25 : 65;
  }

  return Math.min(95, Math.max(20, Math.round((terminalCount / trackedPhases.length) * 80) + 15));
}

function getDashboardScanPhase(status: ScanRecord["status"], phaseRuns: readonly ScanPhaseRunRecord[] = []): Pick<RecentScan, "phase" | "phaseLabel" | "phaseDescription" | "progress"> {
  const activePhase = getActiveScanPhaseLabel(phaseRuns);

  switch (status) {
    case "pending":
    case "queued":
      return {
        phase: "queued",
        phaseLabel: "Queued",
        phaseDescription: "Waiting for worker capacity",
        progress: 5,
      };
    case "running":
      return {
        phase: activePhase?.phase ?? "httpx",
        phaseLabel: activePhase?.phaseLabel ?? "HTTP probe",
        phaseDescription: activePhase?.phaseDescription ?? "Collecting HTTP response signals",
        progress: getPhaseProgress(status, phaseRuns),
      };
    case "processing":
      return {
        phase: activePhase?.phase ?? "enrichment",
        phaseLabel: activePhase?.phaseLabel ?? "Parallel enrichment",
        phaseDescription: activePhase?.phaseDescription ?? "Running browser, Subfinder, Nuclei, and IP intelligence",
        progress: getPhaseProgress(status, phaseRuns),
      };
    case "completed":
      return {
        phase: "complete",
        phaseLabel: "Completed",
        progress: 100,
      };
    case "failed":
    case "cancelled":
      return {
        phase: "failed",
        phaseLabel: status === "cancelled" ? "Cancelled" : "Failed",
        progress: 0,
      };
  }
}

export function mapDashboardRecentScan(scan: ScanListItem, snapshot: CompletedResultSnapshot | undefined, phaseRuns: readonly ScanPhaseRunRecord[] = []): RecentScan {
  const phase = getDashboardScanPhase(scan.status, phaseRuns);

  if (scan.status === "completed") {
    return {
      id: scan.scanId,
      target: scan.target,
      ip: "—",
      status: "complete",
      phase: phase.phase,
      phaseLabel: phase.phaseLabel,
      phaseDescription: phase.phaseDescription,
      technologies: snapshot?.technologies ?? [],
      timestamp: scan.completedAt ?? scan.submittedAt,
      progress: phase.progress,
      statusCode: snapshot?.statusCode,
      server: snapshot?.server ?? undefined,
      cdn: snapshot?.cdn ?? undefined,
      responseTimeMs: undefined,
      techCount: snapshot?.technologies.length ?? 0,
      faviconUrl: snapshot?.faviconUrl ?? undefined,
    } satisfies RecentScan;
  }

  if (scan.status === "failed" || scan.status === "cancelled") {
    return {
      id: scan.scanId,
      target: scan.target,
      ip: "—",
      status: "failed",
      phase: phase.phase,
      phaseLabel: phase.phaseLabel,
      phaseDescription: phase.phaseDescription,
      error: scan.status === "failed" ? scan.status : "Cancelled",
      timestamp: scan.completedAt ?? scan.submittedAt,
      progress: phase.progress,
    } satisfies RecentScan;
  }

  return {
    id: scan.scanId,
    target: scan.target,
    ip: "—",
    status: "analyzing",
    phase: phase.phase,
    phaseLabel: phase.phaseLabel,
    phaseDescription: phase.phaseDescription,
    timestamp: scan.submittedAt,
    progress: phase.progress,
  } satisfies RecentScan;
}

export function mapCompletedResultSnapshot(
  scan: ScanRecord,
  authoritativeResult: ResultRecord,
  decorations: ResultDecorations | undefined,
  completedAt: string,
  ipIntelligence: IpEnrichmentRecord | null = null,
): CompletedResultSnapshot | null {
  if (!scan.canonicalTargetId) {
    return null;
  }

  const resultItem = mapResultItem(authoritativeResult, scan, decorations, ipIntelligence);
  const hostedOn = resolveHostingDisplay(resultItem);

  return {
    resultId: authoritativeResult.id,
    scanId: authoritativeResult.scanId,
    canonicalTargetId: scan.canonicalTargetId,
    normalizedTarget: scan.normalizedTarget,
    searchDocument: authoritativeResult.searchDocument ?? "",
    title: resultItem.title,
    technologies: resultItem.technologies,
    wordpressPlugins: resultItem.wordpress.plugins,
    wordpressThemes: resultItem.wordpress.themes,
    cpe: resultItem.cpe.map((entry) => entry.cpe),
    statusCode: resultItem.statusCode,
    server: hostedOn.server,
    cdn: hostedOn.cdnName,
    completedAt,
    faviconUrl: resultItem.favicon.proxyUrl ?? resultItem.favicon.url,
    screenshotUrl: resultItem.screenshot.path,
  } satisfies CompletedResultSnapshot;
}

function normalizeAttemptStatus(status: ScanRecord["status"]): AttemptStatus {
  switch (status) {
    case "pending":
    case "queued":
      return "queued";
    case "running":
    case "processing":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
  }
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function normalizeSearchToken(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeScanListLimit(limit: number | undefined) {
  if (!Number.isInteger(limit) || !limit || limit <= 0) {
    return DEFAULT_SCAN_LIST_LIMIT;
  }

  return Math.min(limit, MAX_SCAN_LIST_LIMIT);
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function parseAttemptMeta(attempt: AttemptRecord | null) {
  const meta = attempt?.metaJson;
  const record = meta && typeof meta === "object" && !Array.isArray(meta) ? meta as Record<string, unknown> : {};
  const requestProfile = record.requestProfile === "browser_headers" ? record.requestProfile : "baseline";

  return {
    requestProfile: requestProfile as RequestProfile,
    fallbackReason: typeof record.fallbackReason === "string" ? record.fallbackReason : null,
    resultCount: typeof record.resultCount === "number" ? record.resultCount : 0,
    forbiddenResultCount: typeof record.forbiddenResultCount === "number" ? record.forbiddenResultCount : 0,
  };
}

function getResultCdn(result: ResultRecord) {
  return {
    enabled: Boolean(result.cdn || result.cdnName || result.cdnType),
    name: result.cdnName ?? null,
    type: result.cdnType ?? null,
  };
}

function toAttemptSummary(scan: ScanRecord, attempt: AttemptRecord | null) {
  const meta = parseAttemptMeta(attempt);

  return {
    attemptId: attempt?.id ?? scan.id,
    attemptNumber: attempt?.attemptNumber ?? 1,
    status: attempt?.status ?? normalizeAttemptStatus(scan.status),
    requestProfile: meta.requestProfile,
    fallbackReason: meta.fallbackReason,
    resultCount: meta.resultCount,
    forbiddenResultCount: meta.forbiddenResultCount,
  };
}

function toScanListItem(scan: ScanRecord): ScanListItem {
  return {
    scanId: scan.id,
    status: scan.status,
    source: scan.source,
    target: scan.normalizedTarget,
    faviconUrl: null,
    submittedAt: scan.submittedAt.toISOString(),
    completedAt: toIsoString(scan.completedAt),
  };
}

function parseJsonObject(value: ResultRecord["rawJson"] | ResultRecord["responseHeadersJson"] | ResultRecord["asnJson"] | ResultRecord["tlsJson"] | ResultRecord["cspJson"] | ResultRecord["hashesJson"]) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function parseJsonArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? [...value] : [];
}

function parseJsonStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseReverseIpBlock(value: Record<string, unknown>) {
  return {
    provider: typeof value.provider === "string" ? value.provider : null,
    enabled: value.enabled !== false,
    sourceUrl: typeof value.sourceUrl === "string" ? value.sourceUrl : null,
    fallbackFrom: typeof value.fallbackFrom === "string" ? value.fallbackFrom : null,
    domains: parseJsonStringArray(value.domains),
    error: typeof value.error === "string" ? value.error : null,
  };
}

function mapIpIntelligence(
  enrichment: IpEnrichmentRecord | null | undefined,
  internalMatches: readonly InternalReverseIpMatch[] = [],
) {
  if (!enrichment) {
    return null;
  }

  return {
    ip: enrichment.ip,
    providerName: enrichment.providerName ?? null,
    providerSource: enrichment.providerSource ?? null,
    refreshedAt: toIsoString(enrichment.refreshedAt),
    rdap: parseJsonObject(enrichment.rdapJson),
    bgp: parseJsonObject(enrichment.bgpJson),
    ptr: parseJsonArray(enrichment.ptrJson),
    reverseIp: parseReverseIpBlock(parseJsonObject(enrichment.reverseIpJson)),
    internalMatches: [...internalMatches],
    errors: parseJsonObject(enrichment.errorJson),
  };
}

async function getIpEnrichmentsForResults(results: readonly ResultRecord[]) {
  const ips = [...new Set(results.flatMap((result) => result.hostIp ? [result.hostIp] : []))];

  if (ips.length === 0) {
    return new Map<string, IpEnrichmentRecord>();
  }

  const rows = await db.select().from(ipEnrichments).where(inArray(ipEnrichments.ip, ips));

  return new Map(rows.map((row) => [row.ip, row]));
}

async function getInternalReverseIpMatches(actor: ActorContext, ip: string | null | undefined, excludedResultId: string | null = null) {
  if (!ip) {
    return [] as InternalReverseIpMatch[];
  }

  const filters = [
    eq(scanResults.hostIp, ip),
    getVisibleScansFilter(actor),
  ];

  if (excludedResultId) {
    filters.push(ne(scanResults.id, excludedResultId));
  }

  const rows = await db
    .select({
      scanId: scans.id,
      resultId: scanResults.id,
      target: scans.normalizedTarget,
      finalUrl: scanResults.finalUrl,
      url: scanResults.url,
      title: scanResults.title,
      observedAt: scanResults.observedAt,
    })
    .from(scanResults)
    .innerJoin(scans, eq(scanResults.scanId, scans.id))
    .where(and(...filters))
    .orderBy(desc(scanResults.observedAt))
    .limit(50);

  return rows.map((row) => ({
    scanId: row.scanId,
    resultId: row.resultId,
    target: row.target,
    finalUrl: row.finalUrl ?? row.url ?? "",
    title: row.title ?? "",
    observedAt: row.observedAt.toISOString(),
  }));
}

function buildEmptySubdomainSummary() {
  return scanSubdomainSummarySchema.parse({
    state: "not_run",
    runId: null,
    targetDomain: null,
    resultCount: 0,
    engineVersion: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
  });
}

function mapSubdomainSummary(run: SubdomainDiscoveryRunRecord | null) {
  if (!run) {
    return buildEmptySubdomainSummary();
  }

  return scanSubdomainSummarySchema.parse({
    state: run.status,
    runId: run.id,
    targetDomain: run.targetDomain ?? null,
    resultCount: run.resultCount,
    engineVersion: run.engineVersion ?? null,
    errorMessage: run.errorMessage ?? null,
    startedAt: toIsoString(run.startedAt),
    completedAt: toIsoString(run.completedAt),
  });
}

function mapSubdomainItem(row: SubdomainRecord) {
  return {
    subdomainId: row.id,
    scanId: row.scanId,
    host: row.host,
    rootDomain: row.rootDomain,
    ip: row.ip ?? null,
    source: row.source ?? null,
    wildcardCertificate: row.wildcardCertificate,
    observedAt: row.observedAt.toISOString(),
    rawSubfinder: parseJsonObject(row.rawJson),
  };
}

function mapScanPhaseRun(row: ScanPhaseRunRecord) {
  return scanPhaseRunSchema.parse({
    phaseId: row.id,
    scanId: row.scanId,
    attemptId: row.attemptId,
    resultId: row.resultId ?? null,
    phase: row.phase,
    status: row.status,
    errorCode: row.errorCode ?? null,
    errorMessage: row.errorMessage ?? null,
    meta: row.metaJson,
    queuedAt: row.queuedAt.toISOString(),
    startedAt: toIsoString(row.startedAt),
    completedAt: toIsoString(row.completedAt),
    updatedAt: row.updatedAt.toISOString(),
  });
}

async function getPhaseRunsForAttempts(attemptIds: string[]) {
  if (attemptIds.length === 0) {
    return new Map<string, ScanPhaseRunRecord[]>();
  }

  const rows = await db
    .select()
    .from(scanPhaseRuns)
    .where(inArray(scanPhaseRuns.attemptId, attemptIds))
    .orderBy(asc(scanPhaseRuns.queuedAt), asc(scanPhaseRuns.phase));
  const byAttemptId = new Map<string, ScanPhaseRunRecord[]>();

  for (const row of rows) {
    const existing = byAttemptId.get(row.attemptId) ?? [];
    existing.push(row);
    byAttemptId.set(row.attemptId, existing);
  }

  return byAttemptId;
}

async function getPhaseRunsByScanId(scanIds: string[]) {
  if (scanIds.length === 0) {
    return new Map<string, ScanPhaseRunRecord[]>();
  }

  const rows = await db
    .select()
    .from(scanPhaseRuns)
    .where(inArray(scanPhaseRuns.scanId, scanIds))
    .orderBy(asc(scanPhaseRuns.queuedAt), asc(scanPhaseRuns.phase));
  const byScanId = new Map<string, ScanPhaseRunRecord[]>();

  for (const row of rows) {
    const existing = byScanId.get(row.scanId) ?? [];
    existing.push(row);
    byScanId.set(row.scanId, existing);
  }

  return byScanId;
}

function isRenderableImageSrc(value: string | null | undefined): value is string {
  return typeof value === "string" && (value.startsWith("/") || /^https?:\/\//i.test(value));
}

function isLikelyMmh3Hash(value: string | null | undefined): value is string {
  return typeof value === "string" && /^-?\d+$/.test(value);
}

function normalizeFavicon(result: ResultRecord) {
  const raw = parseJsonObject(result.rawJson);
  const rawFavicon = typeof raw.favicon === "string" ? raw.favicon : null;
  const rawFaviconUrl = typeof raw.favicon_url === "string" ? raw.favicon_url : null;
  const rawFaviconPath = typeof raw.favicon_path === "string" ? raw.favicon_path : null;
  const rawFaviconMmh3 = typeof raw.favicon_mmh3 === "string" ? raw.favicon_mmh3 : null;
  const rawFaviconMd5 = typeof raw.favicon_md5 === "string" ? raw.favicon_md5 : null;

  const url = [
    result.faviconUrl,
    result.faviconPath,
    rawFaviconUrl,
    rawFaviconPath,
    rawFavicon,
  ].find(isRenderableImageSrc) ?? null;

  const path = [result.faviconPath, rawFaviconPath].find(
    (value): value is string => typeof value === "string" && value.length > 0,
  ) ?? null;

  const mmh3 = result.faviconMmh3
    ?? rawFaviconMmh3
    ?? [result.faviconUrl, rawFavicon].find(isLikelyMmh3Hash)
    ?? null;

  return {
    mmh3,
    md5: result.faviconMd5 ?? rawFaviconMd5 ?? null,
    url,
    path,
    proxyUrl: url ? `/api/v1/scans/${result.scanId}/results/${result.id}/favicon` : null,
  };
}

function mapNucleiMatch(match: NucleiMatchRecord) {
  return {
    matchId: match.id,
    templateId: match.templateId,
    templatePath: match.templatePath ?? null,
    matcherName: match.matcherName ?? null,
    protocolType: match.protocolType ?? null,
    severity: match.severity ?? null,
    matchedAt: match.matchedAt ?? null,
    host: match.host ?? null,
    ip: match.ip ?? null,
    port: match.port ?? null,
    scheme: match.scheme ?? null,
    url: match.url ?? null,
    path: match.path ?? null,
    extractedResults: parseJsonStringArray(match.extractedResultsJson),
    technologyName: match.technologyName ?? null,
    technologyVersion: match.technologyVersion ?? null,
    findingKind: match.findingKind,
    subject: match.subject ?? match.url ?? match.host ?? null,
    subjectType: match.subjectType ?? null,
    raw: parseJsonObject(match.rawJson),
  };
}

function buildNucleiBlock(decorations: ResultDecorations | undefined) {
  const runStatus = decorations?.nucleiRun?.status ?? null;
  const technologies = [];
  const findings = [];

  for (const match of decorations?.nucleiMatches ?? []) {
    if (match.technologyName !== null) {
      technologies.push(mapNucleiMatch(match));
    } else {
      findings.push(mapNucleiMatch(match));
    }
  }

  return {
    state: runStatus ?? "not_run",
    run: decorations?.nucleiRun
        ? {
          status: decorations.nucleiRun.status,
          targetUrl: decorations.nucleiRun.targetUrl ?? null,
          targetHost: decorations.nucleiRun.targetHost ?? null,
          originalDomainTarget: decorations.nucleiRun.originalDomainTarget ?? null,
          finalDomainTarget: decorations.nucleiRun.finalDomainTarget ?? null,
          domainTarget: decorations.nucleiRun.domainTarget ?? null,
          headers: parseJsonStringArray(decorations.nucleiRun.headersJson),
          templateIds: parseJsonStringArray(decorations.nucleiRun.templateIdsJson),
          engineVersion: decorations.nucleiRun.engineVersion ?? null,
          templatesVersion: decorations.nucleiRun.templatesVersion ?? null,
          errorMessage: decorations.nucleiRun.errorMessage ?? null,
          startedAt: toIsoString(decorations.nucleiRun.startedAt),
          completedAt: toIsoString(decorations.nucleiRun.completedAt),
        }
      : null,
    technologies,
    findings,
  };
}

function getVisibleTechnologies(decorations: ResultDecorations | undefined) {
  return buildEnrichedTechnologies({
    persistedTechnologies: (decorations?.technologies ?? []).map((technology) => technology.name),
    cpeEntries: decorations?.cpe ?? [],
  });
}

function getStructuredTechnologyDetections(decorations: ResultDecorations | undefined) {
  return buildEnrichedTechnologyDetections({
    persistedTechnologies: decorations?.technologies ?? [],
    cpeEntries: decorations?.cpe ?? [],
  });
}

function formatWordPressPluginDisplayName(pluginSlug: string) {
  return pluginSlug
    .split(/[-_\s]+/)
    .flatMap((part) => {
      if (!part) {
        return [];
      }

      const normalized = part.toLowerCase();

      if (normalized === "seo") {
        return ["SEO"];
      }

      if (normalized === "woocommerce") {
        return ["WooCommerce"];
      }

      if (normalized === "wordpress") {
        return ["WordPress"];
      }

      return [normalized.charAt(0).toUpperCase() + normalized.slice(1)];
    })
    .join(" ");
}

export function mapTechnologyInventoryItems(result: ResultRecord, scan: ScanRecord, decorations: ResultDecorations | undefined) {
  const url = result.finalUrl ?? result.url ?? "";
  const baseItem = {
    scanId: result.scanId,
    resultId: result.id,
    canonicalTargetId: scan.canonicalTargetId ?? null,
    url,
  };
  const items: TechnologyInventoryItem[] = [];
  const seen = new Set<string>();
  const mergedTechnologyItems = new Map<string, TechnologyInventoryItem & { sourceSet: Set<DetectionSource> }>();

  const appendTechnologyLikeItem = (input: {
    kind: DetectionKind;
    source: DetectionSource;
    name: string;
    version?: string | null;
    inferred: boolean;
    bucketOverride?: "platform" | "framework" | "infrastructure" | "business" | "security" | "ecosystem" | "other";
    vendor?: string | null;
    product?: string | null;
    cpe?: string | null;
  }) => {
    const detection = buildStructuredTechnologyDetection({
      name: input.name,
      version: input.version ?? null,
      sources: [input.source],
      inferred: input.inferred,
      bucketOverride: input.bucketOverride,
    });
    const normalizedName = normalizeTechnologyKey(detection.name);
    const baseItemData: TechnologyInventoryItem = {
      ...baseItem,
      kind: input.kind,
      sources: [input.source],
      displayName: detection.name,
      normalizedName,
      version: detection.version,
      description: detection.description,
      website: detection.website,
      iconUrl: detection.iconUrl,
      categories: detection.categories,
      primaryCategory: detection.primaryCategory,
      bucket: detection.bucket,
      inferred: input.inferred,
      vendor: input.vendor ?? null,
      product: input.product ?? null,
      cpe: input.cpe ?? null,
    };

    if (input.kind === "technology") {
      const key = [input.kind, normalizedName, detection.version ?? ""].join("::");
      const existing = mergedTechnologyItems.get(key);

      if (!existing) {
        mergedTechnologyItems.set(key, {
          ...baseItemData,
          sourceSet: new Set([input.source]),
        });
        return;
      }

      existing.sourceSet.add(input.source);
      existing.sources = sortDetectionSources(existing.sourceSet);
      existing.inferred = !existing.sources.some((source) => source === "wappalyzer" || source === "wordpress");

      if (!existing.version && detection.version) {
        existing.version = detection.version;
      }

      return;
    }

    const key = [input.kind, normalizedName, detection.version ?? "", input.cpe ?? ""].join("::");

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    items.push(baseItemData);
  };

  for (const technology of decorations?.technologies ?? []) {
    appendTechnologyLikeItem({
      kind: "technology",
      source: technology.source,
      name: technology.name,
      version: technology.version,
      inferred: technology.source !== "wappalyzer" && technology.source !== "wordpress",
    });
  }

  for (const pluginSlug of decorations?.wordpressPlugins ?? []) {
    appendTechnologyLikeItem({
      kind: "wordpress_plugin",
      source: "wordpress",
      name: formatWordPressPluginDisplayName(pluginSlug),
      inferred: false,
      bucketOverride: "ecosystem",
    });
  }

  for (const themeName of decorations?.wordpressThemes ?? []) {
    appendTechnologyLikeItem({
      kind: "wordpress_theme",
      source: "wordpress",
      name: themeName,
      inferred: false,
      bucketOverride: "ecosystem",
    });
  }

  for (const cpeEntry of decorations?.cpe ?? []) {
    appendTechnologyLikeItem({
      kind: "cpe",
      source: "cpe",
      name: cpeEntry.product ?? cpeEntry.vendor ?? cpeEntry.cpe,
      version: cpeEntry.version ?? extractCpeVersion(cpeEntry.cpe),
      inferred: true,
      vendor: cpeEntry.vendor,
      product: cpeEntry.product,
      cpe: cpeEntry.cpe,
      });
  }

  return [...mergedTechnologyItems.values()]
    .map((technologyItem) => {
      const { sourceSet, ...item } = technologyItem;
      void sourceSet;
      return item;
    })
    .concat(items);
}

export async function getScanRecord(actor: ActorContext, scanId: string): Promise<ScanRecord | null> {
  const visibleScansFilter = getVisibleScansFilter(actor);
  const [scan] = await db
    .select()
    .from(scans)
    .where(and(eq(scans.id, scanId), visibleScansFilter))
    .limit(1);

  return scan ?? null;
}

async function getLatestAttempts(scanIds: string[]) {
  if (scanIds.length === 0) {
    return new Map<string, AttemptRecord>();
  }

  const rows = await db
    .select()
    .from(scanAttempts)
    .where(inArray(scanAttempts.scanId, scanIds))
    .orderBy(desc(scanAttempts.attemptNumber));

  const latestByScanId = new Map<string, AttemptRecord>();

  for (const row of rows) {
    if (!latestByScanId.has(row.scanId)) {
      latestByScanId.set(row.scanId, row);
    }
  }

  return latestByScanId;
}

async function getAttemptsByScanId(scanIds: string[]) {
  if (scanIds.length === 0) {
    return new Map<string, AttemptRecord[]>();
  }

  const rows = await db
    .select()
    .from(scanAttempts)
    .where(inArray(scanAttempts.scanId, scanIds))
    .orderBy(scanAttempts.attemptNumber);

  const byScanId = new Map<string, AttemptRecord[]>();

  for (const row of rows) {
    const existing = byScanId.get(row.scanId) ?? [];
    existing.push(row);
    byScanId.set(row.scanId, existing);
  }

  return byScanId;
}

async function getSubdomainDiscoveryRunForAttempt(attemptId: string | null) {
  if (!attemptId) {
    return null;
  }

  const [run] = await db
    .select()
    .from(scanSubdomainDiscoveryRuns)
    .where(eq(scanSubdomainDiscoveryRuns.attemptId, attemptId))
    .limit(1);

  return run ?? null;
}

async function getResultsForAttempts(attemptIds: string[]) {
  if (attemptIds.length === 0) {
    return [] as ResultRecord[];
  }

  return db
    .select()
    .from(scanResults)
    .where(inArray(scanResults.attemptId, attemptIds));
}

async function getResultDecorations(resultIds: string[]) {
  const emptyMap = new Map<string, ResultDecorations>();

  if (resultIds.length === 0) {
    return emptyMap;
  }

  const [detections, nucleiRuns, nucleiMatches] = await Promise.all([
    db
      .select()
      .from(scanResultDetections)
      .where(inArray(scanResultDetections.resultId, resultIds))
      .orderBy(scanResultDetections.createdAt),
    db
      .select()
      .from(scanResultNucleiRuns)
      .where(inArray(scanResultNucleiRuns.resultId, resultIds)),
    db
      .select()
      .from(scanResultNucleiMatches)
      .where(inArray(scanResultNucleiMatches.resultId, resultIds))
      .orderBy(scanResultNucleiMatches.createdAt),
  ]);

  const getEntry = (resultId: string): ResultDecorations => {
    const existing = emptyMap.get(resultId);

    if (existing) {
      return existing;
    }

    const next: ResultDecorations = {
      technologies: [],
      wordpressPlugins: [],
      wordpressThemes: [],
      cpe: [],
      nucleiRun: null,
      nucleiMatches: [],
      nucleiTechnologyNames: [],
    };
    emptyMap.set(resultId, next);
    return next;
  };

  for (const detection of detections) {
    const entry = getEntry(detection.resultId);

    switch (detection.kind) {
      case "technology":
        entry.technologies.push({
          name: detection.name,
          version: detection.version,
          source: detection.source,
        });
        break;
      case "wordpress_plugin":
        entry.wordpressPlugins.push(detection.slug ?? detection.name);
        break;
      case "wordpress_theme":
        entry.wordpressThemes.push(detection.slug ?? detection.name);
        break;
      case "cpe":
        if (!detection.cpe) {
          break;
        }

        entry.cpe.push({
          cpe: detection.cpe,
          vendor: detection.vendor,
          product: detection.product,
          version: detection.version ?? extractCpeVersion(detection.cpe),
        });
        break;
    }
  }

  for (const nucleiRun of nucleiRuns) {
    getEntry(nucleiRun.resultId).nucleiRun = nucleiRun;
  }

  for (const nucleiMatch of nucleiMatches) {
    const entry = getEntry(nucleiMatch.resultId);
    entry.nucleiMatches.push(nucleiMatch);

    if (nucleiMatch.technologyName) {
      entry.nucleiTechnologyNames.push(nucleiMatch.technologyName);
    }
  }

  return emptyMap;
}

export function mapResultItem(
  result: ResultRecord,
  scan: ScanRecord,
  decorations: ResultDecorations | undefined,
  ipIntelligence: IpEnrichmentRecord | null = null,
  internalReverseIpMatches: readonly InternalReverseIpMatch[] = [],
) {
  const technologies = getVisibleTechnologies(decorations);
  const technologyDetections = getStructuredTechnologyDetections(decorations);
  const cpeEntries = (decorations?.cpe ?? []).map((entry) => ({
    ...entry,
    version: entry.version ?? extractCpeVersion(entry.cpe),
  }));
  const screenshotPath = result.screenshotObjectKey
    ? `/api/v1/scans/${result.scanId}/results/${result.id}/screenshot`
    : null;
  const nuclei = buildNucleiBlock(decorations);
  const favicon = normalizeFavicon(result);

  return {
    resultId: result.id,
    target: scan.normalizedTarget,
    input: result.input ?? scan.inputTarget,
    url: result.url ?? "",
    finalUrl: result.finalUrl ?? result.url ?? "",
    path: result.path ?? "",
    method: result.method ?? "GET",
    title: result.title ?? "",
    statusCode: result.statusCode ?? 0,
    server: result.webServer ?? null,
    location: result.location ?? null,
    contentType: result.contentType ?? null,
    contentLength: result.contentLength ?? 0,
    responseTimeMs: result.responseTimeMs ?? 0,
    cdn: getResultCdn(result),
    dns: {
      hostIp: result.hostIp ?? null,
      a: parseJsonArray(result.dnsARecords),
      aaaa: parseJsonArray(result.dnsAaaaRecords),
      cname: parseJsonArray(result.dnsCnameRecords),
      resolvers: parseJsonArray(result.dnsResolvers),
    },
    asn: {
      asNumber:
        typeof parseJsonObject(result.asnJson).asNumber === "string"
          ? (parseJsonObject(result.asnJson).asNumber as string)
          : typeof parseJsonObject(result.asnJson).as_number === "string"
            ? (parseJsonObject(result.asnJson).as_number as string)
            : typeof parseJsonObject(result.asnJson).as_number === "number"
              ? `AS${parseJsonObject(result.asnJson).as_number}`
            : null,
      org:
        typeof parseJsonObject(result.asnJson).org === "string"
          ? (parseJsonObject(result.asnJson).org as string)
          : typeof parseJsonObject(result.asnJson).as_name === "string"
            ? (parseJsonObject(result.asnJson).as_name as string)
          : null,
      country:
        typeof parseJsonObject(result.asnJson).country === "string"
          ? (parseJsonObject(result.asnJson).country as string)
          : typeof parseJsonObject(result.asnJson).as_country === "string"
            ? (parseJsonObject(result.asnJson).as_country as string)
          : null,
      range: Array.isArray(parseJsonObject(result.asnJson).range)
        ? (parseJsonObject(result.asnJson).range as string[])
        : Array.isArray(parseJsonObject(result.asnJson).as_range)
          ? (parseJsonObject(result.asnJson).as_range as string[])
        : undefined,
    },
    ipIntelligence: mapIpIntelligence(ipIntelligence, internalReverseIpMatches),
    tls: {
      sni: result.sni ?? null,
      jarmHash: result.jarmHash ?? null,
      certificate: parseJsonObject(result.tlsJson),
    },
    technologies,
    technologyDetections,
    wordpress: {
      plugins: decorations?.wordpressPlugins ?? [],
      themes: decorations?.wordpressThemes ?? [],
    },
    cpe: cpeEntries,
    favicon,
    screenshot: {
      available: Boolean(result.screenshotObjectKey),
      path: screenshotPath,
      contentType: result.screenshotContentType ?? null,
      byteSize: result.screenshotByteSize ?? null,
      capturedAt: toIsoString(result.screenshotCapturedAt),
    },
    hashes: Object.fromEntries(
      Object.entries(parseJsonObject(result.hashesJson)).filter((entry): entry is [string, string] => {
        return typeof entry[1] === "string";
      }),
    ),
    capabilities: {
      http2: Boolean(result.http2),
      pipeline: Boolean(result.pipeline),
      websocket: Boolean(result.websocket),
      vhost: Boolean(result.vhost),
    },
    redirectChain: {
      statusCodes: parseJsonArray(result.redirectChainStatusCodes),
      items: normalizeRedirectChainItems(
        parseJsonArray(result.redirectChainJson),
        parseJsonArray(result.redirectChainStatusCodes),
      ),
    },
    bodyPreview: result.bodyPreview ?? "",
    bodyDomains: parseJsonArray(result.bodyDomains),
    bodyFqdns: parseJsonArray(result.bodyFqdns),
    rawHttpx: parseJsonObject(result.rawJson),
    nuclei,
  };
}

function matchesTargetFilter(scan: Pick<ScanRecord, "inputTarget" | "normalizedTarget">, filter: string | null | undefined) {
  if (!filter) {
    return true;
  }

  const normalizedFilter = normalizeSearchToken(filter);

  return [scan.inputTarget ?? "", scan.normalizedTarget ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(normalizedFilter);
}

function matchesTechnologyFilter(decorations: ResultDecorations | undefined, filter: string | null | undefined) {
  if (!filter) {
    return true;
  }

  const normalizedFilter = normalizeSearchToken(filter);

  return getVisibleTechnologies(decorations).some((technology) => normalizeSearchToken(technology).includes(normalizedFilter));
}

export async function listScans(actor: ActorContext, filters: ScanListFilters = {}) {
  const visibleScansFilter = getVisibleScansFilter(actor);
  const conditions: SQL[] = [];

  if (visibleScansFilter) {
    conditions.push(visibleScansFilter);
  }

  if (filters.status) {
    conditions.push(eq(scans.status, filters.status));
  }

  if (filters.source) {
    conditions.push(eq(scans.source, filters.source));
  }

  if (filters.target) {
    const normalizedTarget = normalizeSearchToken(filters.target);

    if (normalizedTarget) {
      const targetPattern = `%${escapeLikePattern(normalizedTarget)}%`;
      const targetFilter = or(
        ilike(scans.inputTarget, targetPattern),
        ilike(scans.normalizedTarget, targetPattern),
      );

      if (targetFilter) {
        conditions.push(targetFilter);
      }
    }
  }

  const limit = normalizeScanListLimit(filters.limit);
  const whereFilter = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(scans)
    .where(whereFilter)
    .orderBy(desc(scans.submittedAt))
    .limit(limit);

  const limited = rows.map(toScanListItem);
  const snapshots = await listCompletedResultSnapshots(actor, limited.map((scan) => scan.scanId));
  const snapshotByScanId = new Map(snapshots.map((snapshot) => [snapshot.scanId, snapshot]));

  return listScansResponseSchema.parse({
    items: limited.map((scan) => ({
      ...scan,
      faviconUrl: snapshotByScanId.get(scan.scanId)?.faviconUrl ?? null,
    })),
    nextCursor: null,
  });
}

export async function getScanDetail(actor: ActorContext, scanId: string) {
  const scan = await getScanRecord(actor, scanId);

  if (!scan) {
    return null;
  }

  const [latestAttempts, attemptsByScanId] = await Promise.all([
    getLatestAttempts([scan.id]),
    getAttemptsByScanId([scan.id]),
  ]);
  const currentAttempt = latestAttempts.get(scan.id) ?? null;
  const attemptHistory = attemptsByScanId.get(scan.id) ?? [];
  const selectedAttemptId = currentAttempt?.id ?? null;

  const [results, subdomainDiscoveryRun, phaseRunsByAttempt] = await Promise.all([
    selectedAttemptId ? getResultsForAttempts([selectedAttemptId]) : [],
    getSubdomainDiscoveryRunForAttempt(selectedAttemptId),
    selectedAttemptId ? getPhaseRunsForAttempts([selectedAttemptId]) : new Map<string, ScanPhaseRunRecord[]>(),
  ]);
  const resultCount = results.length;
  const phaseRuns = selectedAttemptId ? phaseRunsByAttempt.get(selectedAttemptId) ?? [] : [];

  return getScanResponseSchema.parse({
    scanId: scan.id,
    status: scan.status,
    source: scan.source,
    target: {
      inputTarget: scan.inputTarget,
      normalizedTarget: scan.normalizedTarget,
      canonicalTargetId: scan.canonicalTargetId ?? null,
    },
    currentAttempt: toAttemptSummary(scan, currentAttempt),
    attemptHistory: attemptHistory.map((attempt) => toAttemptSummary(scan, attempt)),
    phases: phaseRuns.map(mapScanPhaseRun),
    progress: {
      resultCount,
      subdomainCount: subdomainDiscoveryRun?.resultCount,
    },
    subdomains: mapSubdomainSummary(subdomainDiscoveryRun),
  });
}

export async function getScanSubdomains(actor: ActorContext, scanId: string, filters: ScanSubdomainsFilters = {}) {
  const scan = await getScanRecord(actor, scanId);

  if (!scan) {
    return null;
  }

  const latestAttempts = await getLatestAttempts([scan.id]);
  const latestAttempt = latestAttempts.get(scan.id) ?? null;
  const run = await getSubdomainDiscoveryRunForAttempt(latestAttempt?.id ?? null);
  const summary = mapSubdomainSummary(run);
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? DEFAULT_SUBDOMAIN_PAGE_SIZE, 1), MAX_SUBDOMAIN_PAGE_SIZE);

  if (!run) {
    return getScanSubdomainsResponseSchema.parse({
      summary,
      items: [],
      page,
      pageSize,
      total: 0,
    });
  }

  const normalizedHostFilter = normalizeSearchToken(filters.host ?? "");
  const normalizedSourceFilter = normalizeSearchToken(filters.source ?? "");
  const conditions = [eq(scanSubdomains.runId, run.id)];

  if (normalizedHostFilter) {
    conditions.push(ilike(scanSubdomains.host, `%${normalizedHostFilter}%`));
  }

  if (normalizedSourceFilter) {
    conditions.push(ilike(scanSubdomains.sourceKey, `%${normalizedSourceFilter}%`));
  }

  const whereClause = and(...conditions);
  const start = (page - 1) * pageSize;
  const [totalRow, rows] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(scanSubdomains)
      .where(whereClause),
    db
      .select()
      .from(scanSubdomains)
      .where(whereClause)
      .orderBy(asc(scanSubdomains.host), asc(scanSubdomains.ipKey), asc(scanSubdomains.sourceKey))
      .limit(pageSize)
      .offset(start),
  ]);

  return getScanSubdomainsResponseSchema.parse({
    summary,
    items: rows.map(mapSubdomainItem),
    page,
    pageSize,
    total: totalRow[0]?.value ?? 0,
  });
}

export async function getAuthoritativeScanResult(actor: ActorContext, scanId: string) {
  const scan = await getScanRecord(actor, scanId);

  if (!scan) {
    return null;
  }

  const latestAttempts = await getLatestAttempts([scan.id]);
  const latestAttempt = latestAttempts.get(scan.id) ?? null;

  if (!latestAttempt) {
    return null;
  }

  const results = await getResultsForAttempts([latestAttempt.id]);
  const authoritativeResult = selectAuthoritativeResultRecord(results, scan);

  if (!authoritativeResult) {
    return null;
  }

  const [decorationsByResultId, ipEnrichmentsByIp, internalReverseIpMatches] = await Promise.all([
    getResultDecorations([authoritativeResult.id]),
    getIpEnrichmentsForResults([authoritativeResult]),
    getInternalReverseIpMatches(actor, authoritativeResult.hostIp, authoritativeResult.id),
  ]);

  return scanResultItemSchema.parse(
    mapResultItem(
      authoritativeResult,
      scan,
      decorationsByResultId.get(authoritativeResult.id),
      authoritativeResult.hostIp ? ipEnrichmentsByIp.get(authoritativeResult.hostIp) ?? null : null,
      internalReverseIpMatches,
    ),
  );
}

function filterTechnologyInventoryItems(items: TechnologyInventoryItem[], filters: ScanResultsFilters) {
  const technologyFilter = normalizeSearchToken(filters.technology ?? "");
  const sourceFilter = normalizeSearchToken(filters.source ?? "");
  const bucketFilter = normalizeSearchToken(filters.bucket ?? "");

  return items.filter((item) => {
    if (technologyFilter) {
      const matchesTechnology =
        item.normalizedName.includes(technologyFilter)
        || normalizeSearchToken(item.displayName).includes(technologyFilter)
        || item.categories.some((category) => normalizeSearchToken(category).includes(technologyFilter))
        || (item.cpe ? normalizeSearchToken(item.cpe).includes(technologyFilter) : false);

      if (!matchesTechnology) {
        return false;
      }
    }

    if (sourceFilter && !item.sources.some((source) => normalizeSearchToken(source).includes(sourceFilter))) {
      return false;
    }

    if (bucketFilter && normalizeSearchToken(item.bucket) !== bucketFilter) {
      return false;
    }

    return true;
  });
}

async function getAuthoritativeScanTechnologyItems(actor: ActorContext, scanId: string, filters: ScanResultsFilters = {}) {
  const scan = await getScanRecord(actor, scanId);

  if (!scan) {
    return null;
  }

  const latestAttempts = await getLatestAttempts([scan.id]);
  const latestAttempt = latestAttempts.get(scan.id) ?? null;

  if (!latestAttempt) {
    return [];
  }

  const results = await getResultsForAttempts([latestAttempt.id]);
  const authoritativeResult = selectAuthoritativeResultRecord(results, scan);

  if (!authoritativeResult) {
    return [];
  }

  const decorationsByResultId = await getResultDecorations([authoritativeResult.id]);

  return filterTechnologyInventoryItems(
    mapTechnologyInventoryItems(authoritativeResult, scan, decorationsByResultId.get(authoritativeResult.id)),
    filters,
  );
}

export async function getScanResults(actor: ActorContext, scanId: string, filters: ScanResultsFilters = {}) {
  const scan = await getScanRecord(actor, scanId);

  if (!scan) {
    return null;
  }

  const latestAttempts = await getLatestAttempts([scan.id]);

  const latestAttempt = latestAttempts.get(scan.id) ?? null;

  const results = await db
    .select()
    .from(scanResults)
    .where(
      and(
        eq(scanResults.scanId, scan.id),
        filters.includeIncomplete || !latestAttempt ? undefined : eq(scanResults.attemptId, latestAttempt.id),
      ),
    );

  const [decorationsByResultId, ipEnrichmentsByIp] = await Promise.all([
    getResultDecorations(results.map((result) => result.id)),
    getIpEnrichmentsForResults(results),
  ]);

  const filtered = results.filter((result) => {
    const decorations = decorationsByResultId.get(result.id);

    if (!matchesTargetFilter(scan, filters.target)) {
      return false;
    }

    if (!matchesTechnologyFilter(decorations, filters.technology)) {
      return false;
    }

    if (typeof filters.statusCode === "number" && result.statusCode !== filters.statusCode) {
      return false;
    }

    return true;
  });

  const ordered = filtered.toSorted((left, right) => right.observedAt.getTime() - left.observedAt.getTime());

  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.max(filters.pageSize ?? 20, 1);
  const start = (page - 1) * pageSize;
  const paged = ordered.slice(start, start + pageSize);

  return getScanResultsResponseSchema.parse({
    items: paged.map((result) => mapResultItem(
      result,
      scan,
      decorationsByResultId.get(result.id),
      result.hostIp ? ipEnrichmentsByIp.get(result.hostIp) ?? null : null,
    )),
    page,
    pageSize,
    total: ordered.length,
  });
}

export async function getScanTechnologies(actor: ActorContext, scanId: string, filters: ScanResultsFilters = {}) {
  if ((filters.scope ?? "all-results") === "authoritative") {
    const items = await getAuthoritativeScanTechnologyItems(actor, scanId, filters);

    if (!items) {
      return null;
    }

    return getScanTechnologiesResponseSchema.parse({
      items,
      page: 1,
      pageSize: Math.max(items.length, 1),
      total: items.length,
    });
  }

  if (filters.scope === "result") {
    if (!filters.resultId) {
      return getScanTechnologiesResponseSchema.parse({
        items: [],
        page: 1,
        pageSize: 1,
        total: 0,
      });
    }

    const response = await getResultTechnologies(actor, scanId, filters.resultId);

    if (!response) {
      return null;
    }

    const items = filterTechnologyInventoryItems(response.items, filters);

    return getScanTechnologiesResponseSchema.parse({
      items,
      page: 1,
      pageSize: Math.max(items.length, 1),
      total: items.length,
    });
  }

  const scan = await getScanRecord(actor, scanId);

  if (!scan) {
    return null;
  }

  const latestAttempts = await getLatestAttempts([scan.id]);

  const latestAttempt = latestAttempts.get(scan.id) ?? null;

  const results = await db
    .select()
    .from(scanResults)
    .where(
      and(
        eq(scanResults.scanId, scan.id),
        filters.includeIncomplete || !latestAttempt ? undefined : eq(scanResults.attemptId, latestAttempt.id),
      ),
    );

  const decorationsByResultId = await getResultDecorations(results.map((result) => result.id));
  const filtered = results.filter((result) => {
    if (!matchesTargetFilter(scan, filters.target)) {
      return false;
    }

    if (typeof filters.statusCode === "number" && result.statusCode !== filters.statusCode) {
      return false;
    }

    return true;
  });

  const ordered = filtered.toSorted((left, right) => right.observedAt.getTime() - left.observedAt.getTime());

  const flattened = ordered.flatMap((result) => {
    return mapTechnologyInventoryItems(result, scan, decorationsByResultId.get(result.id));
  });
  const filteredItems = filterTechnologyInventoryItems(flattened, filters);

  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.max(filters.pageSize ?? 20, 1);
  const start = (page - 1) * pageSize;
  const paged = filteredItems.slice(start, start + pageSize);

  return getScanTechnologiesResponseSchema.parse({
    items: paged,
    page,
    pageSize,
    total: filteredItems.length,
  });
}

export async function getResultTechnologies(actor: ActorContext, scanId: string, resultId: string) {
  const scan = await getScanRecord(actor, scanId);

  if (!scan) {
    return null;
  }

  const [result] = await db
    .select()
    .from(scanResults)
    .where(and(eq(scanResults.scanId, scan.id), eq(scanResults.id, resultId)))
    .limit(1);

  if (!result) {
    return null;
  }

  const decorationsByResultId = await getResultDecorations([result.id]);

  const items = mapTechnologyInventoryItems(result, scan, decorationsByResultId.get(result.id));

  return getResultTechnologiesResponseSchema.parse({
    items,
    total: items.length,
  });
}

export async function getScanReport(actor: ActorContext, scanId: string) {
  const [scanRecord, scanDetail, authoritativeResult, authoritativeTechnologies, subdomains] = await Promise.all([
    getScanRecord(actor, scanId),
    getScanDetail(actor, scanId),
    getAuthoritativeScanResult(actor, scanId),
    getAuthoritativeScanTechnologyItems(actor, scanId),
    getScanSubdomains(actor, scanId, { page: 1, pageSize: DEFAULT_REPORT_SUBDOMAIN_LIMIT }),
  ]);

  if (!scanRecord || !scanDetail) {
    return null;
  }

  const subdomainItems = subdomains?.items ?? [];
  const subdomainTotal = subdomains?.total ?? scanDetail.subdomains.resultCount;
  const subdomainsTruncated = subdomainItems.length < subdomainTotal;
  const baseScanPath = `/api/v1/scans/${scanId}`;

  return scanReportResponseSchema.parse({
    scan: {
      ...scanDetail,
      submittedAt: scanRecord.submittedAt.toISOString(),
      completedAt: scanRecord.completedAt?.toISOString() ?? null,
    },
    authoritativeResult: authoritativeResult
      ? {
          resultId: authoritativeResult.resultId,
          url: authoritativeResult.url,
          finalUrl: authoritativeResult.finalUrl,
          title: authoritativeResult.title,
          statusCode: authoritativeResult.statusCode,
          server: authoritativeResult.server,
          cdn: authoritativeResult.cdn,
          screenshotUrl: authoritativeResult.screenshot.path,
          faviconUrl: authoritativeResult.favicon.proxyUrl ?? authoritativeResult.favicon.path ?? authoritativeResult.favicon.url,
        }
      : null,
    technologies: {
      scope: "authoritative",
      items: authoritativeTechnologies ?? [],
      total: authoritativeTechnologies?.length ?? 0,
    },
    infrastructure: {
      dns: authoritativeResult?.dns ?? null,
      asn: authoritativeResult?.asn ?? null,
      tls: authoritativeResult?.tls ?? null,
      capabilities: authoritativeResult?.capabilities ?? null,
      ipIntelligence: authoritativeResult?.ipIntelligence ?? null,
    },
    subdomains: {
      summary: subdomains?.summary ?? scanDetail.subdomains,
      sample: subdomainItems,
      total: subdomainTotal,
      truncated: subdomainsTruncated,
      next: subdomainsTruncated
        ? `${baseScanPath}/subdomains?page=2&pageSize=${DEFAULT_REPORT_SUBDOMAIN_LIMIT}`
        : null,
    },
    links: {
      scan: baseScanPath,
      results: `${baseScanPath}/results`,
      technologies: `${baseScanPath}/technologies?scope=authoritative`,
      subdomains: `${baseScanPath}/subdomains`,
      events: `${baseScanPath}/events`,
    },
  });
}

export async function getTargetTechnologies(actor: ActorContext, canonicalTargetId: string, selectedScanId?: string) {
  const visibleScansFilter = getVisibleScansFilter(actor);
  const matchingScans = await db
    .select()
    .from(scans)
    .where(and(visibleScansFilter, eq(scans.canonicalTargetId, canonicalTargetId)));

  if (matchingScans.length === 0) {
    return getTargetTechnologiesResponseSchema.parse({
      canonicalTargetId,
      normalizedTarget: "",
      latestScanId: null,
      scanId: null,
      lastScannedAt: null,
      items: [],
    });
  }

  const completedScans = matchingScans
    .filter((scan) => scan.status === "completed" && (!selectedScanId || scan.id === selectedScanId))
    .sort((left, right) => (right.completedAt?.getTime() ?? right.submittedAt.getTime()) - (left.completedAt?.getTime() ?? left.submittedAt.getTime()));

  const latestCompletedScans = matchingScans
    .filter((scan) => scan.status === "completed")
    .sort((left, right) => (right.completedAt?.getTime() ?? right.submittedAt.getTime()) - (left.completedAt?.getTime() ?? left.submittedAt.getTime()));

  const chosenScan = completedScans[0] ?? null;
  const latestScan = latestCompletedScans[0] ?? null;

  if (!chosenScan || !latestScan) {
    return getTargetTechnologiesResponseSchema.parse({
      canonicalTargetId,
      normalizedTarget: matchingScans[0]?.normalizedTarget ?? "",
      latestScanId: null,
      scanId: null,
      lastScannedAt: null,
      items: [],
    });
  }

  const latestAttempts = await getLatestAttempts([chosenScan.id]);
  const latestAttempt = latestAttempts.get(chosenScan.id) ?? null;

  if (!latestAttempt) {
    return getTargetTechnologiesResponseSchema.parse({
      canonicalTargetId,
      normalizedTarget: chosenScan.normalizedTarget,
      latestScanId: latestScan.id,
      scanId: chosenScan.id,
      lastScannedAt: chosenScan.completedAt?.toISOString() ?? chosenScan.submittedAt.toISOString(),
      items: [],
    });
  }

  const results = await db
    .select()
    .from(scanResults)
    .where(and(eq(scanResults.scanId, chosenScan.id), eq(scanResults.attemptId, latestAttempt.id)));

  const authoritativeResult = selectAuthoritativeResultRecord(results, chosenScan);
  const authoritativeResults = authoritativeResult ? [authoritativeResult] : [];
  const decorationsByResultId = await getResultDecorations(authoritativeResults.map((result) => result.id));

  return getTargetTechnologiesResponseSchema.parse({
    canonicalTargetId,
    normalizedTarget: chosenScan.normalizedTarget,
    latestScanId: latestScan.id,
    scanId: chosenScan.id,
    lastScannedAt: chosenScan.completedAt?.toISOString() ?? chosenScan.submittedAt.toISOString(),
    items: authoritativeResults.flatMap((result) => {
      return mapTechnologyInventoryItems(result, chosenScan, decorationsByResultId.get(result.id));
    }),
  });
}

export async function listCompletedResultSnapshots(actor: ActorContext, filteredScanIds?: string[]): Promise<CompletedResultSnapshot[]> {
  if (filteredScanIds && filteredScanIds.length === 0) {
    return [];
  }

  const visibleScansFilter = getVisibleScansFilter(actor);

  const completedScans = await db
    .select()
    .from(scans)
    .where(
      and(
        eq(scans.status, "completed"),
        visibleScansFilter,
        filteredScanIds ? inArray(scans.id, filteredScanIds) : undefined,
      ),
    )
    .orderBy(desc(scans.completedAt));

  const completedScanIds = completedScans.map((scan) => scan.id);
  const latestAttempts = await getLatestAttempts(completedScanIds);
  const attemptIds = [...latestAttempts.values()].map((attempt) => attempt.id);
  const results = await getResultsForAttempts(attemptIds);
  const [decorationsByResultId, ipEnrichmentsByIp] = await Promise.all([
    getResultDecorations(results.map((result) => result.id)),
    getIpEnrichmentsForResults(results),
  ]);
  const completedAtByScanId = new Map(completedScans.map((scan) => [scan.id, scan.completedAt?.toISOString() ?? scan.submittedAt.toISOString()]));
  const resultsByScanId = new Map<string, ResultRecord[]>();

  for (const result of results) {
    const existing = resultsByScanId.get(result.scanId) ?? [];
    existing.push(result);
    resultsByScanId.set(result.scanId, existing);
  }

  const snapshots: CompletedResultSnapshot[] = [];

  for (const scan of completedScans) {
    const authoritativeResult = selectAuthoritativeResultRecord(resultsByScanId.get(scan.id) ?? [], scan);

    if (!authoritativeResult) {
      continue;
    }

    const decorations = decorationsByResultId.get(authoritativeResult.id);
    const completedAt = completedAtByScanId.get(authoritativeResult.scanId) ?? new Date(0).toISOString();
    const snapshot = mapCompletedResultSnapshot(
      scan,
      authoritativeResult,
      decorations,
      completedAt,
      authoritativeResult.hostIp ? ipEnrichmentsByIp.get(authoritativeResult.hostIp) ?? null : null,
    );

    if (snapshot) {
      snapshots.push(snapshot);
    }
  }

  return snapshots.toSorted((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime());
}

export async function getTargetHistoryForScan(actor: ActorContext, scanId: string, limit = 4) {
  const scan = await getScanRecord(actor, scanId);

  if (!scan) {
    return null;
  }

  if (!scan.canonicalTargetId) {
    return targetHistoryResponseSchema.parse({
      canonicalTargetId: "",
      normalizedTarget: "",
      items: [],
      totalCount: 0,
      hasMore: false,
    });
  }

  const snapshots = await listCompletedResultSnapshots(actor);
  const matchingSnapshots = snapshots
    .filter((snapshot) => snapshot.canonicalTargetId === scan.canonicalTargetId);
  const items = matchingSnapshots
    .slice(0, limit)
    .map((snapshot) => ({
      scanId: snapshot.scanId,
      status: "completed" as const,
      title: snapshot.title,
      technologies: snapshot.technologies,
      submittedAt: snapshot.completedAt,
      completedAt: snapshot.completedAt,
    }));

  return targetHistoryResponseSchema.parse({
    canonicalTargetId: scan.canonicalTargetId,
    normalizedTarget: scan.normalizedTarget,
    items,
    totalCount: matchingSnapshots.length,
    hasMore: items.length < matchingSnapshots.length,
  });
}

export async function getTargetHistoryByCanonicalId(
  actor: ActorContext,
  canonicalTargetId: string,
  limit: number | "all" = 10,
  excludeScanId?: string,
) {
  const visibleScansFilter = getVisibleScansFilter(actor);

  const scanRows = await db
    .select()
    .from(scans)
    .where(and(eq(scans.canonicalTargetId, canonicalTargetId), visibleScansFilter));

  if (scanRows.length === 0) {
    return targetHistoryResponseSchema.parse({
      canonicalTargetId,
      normalizedTarget: "",
      items: [],
      totalCount: 0,
      hasMore: false,
    });
  }

  const orderedScans = scanRows.toSorted((left, right) => right.submittedAt.getTime() - left.submittedAt.getTime());
  const snapshots = await listCompletedResultSnapshots(actor, orderedScans.map((scan) => scan.id));

  if (orderedScans.length === 0) {
    return targetHistoryResponseSchema.parse({
      canonicalTargetId,
      normalizedTarget: "",
      items: [],
      totalCount: 0,
      hasMore: false,
    });
  }

  const snapshotByScanId = new Map<string, CompletedResultSnapshot>();

  for (const snapshot of snapshots) {
    if (snapshot.canonicalTargetId === canonicalTargetId) {
      snapshotByScanId.set(snapshot.scanId, snapshot);
    }
  }

  const allItems = orderedScans.flatMap((scan) => {
    if (scan.id === excludeScanId) {
      return [];
    }

    const snapshot = snapshotByScanId.get(scan.id);

    return [{
      scanId: scan.id,
      status: scan.status,
      title: snapshot?.title ?? "",
      technologies: snapshot?.technologies ?? [],
      submittedAt: scan.submittedAt.toISOString(),
      completedAt: scan.completedAt?.toISOString() ?? null,
    }];
  });
  const items = limit === "all" ? allItems : allItems.slice(0, limit);

  return targetHistoryResponseSchema.parse({
    canonicalTargetId,
    normalizedTarget: orderedScans[0]?.normalizedTarget ?? "",
    items,
    totalCount: allItems.length,
    hasMore: items.length < allItems.length,
  });
}

function normalizeDashboardRecentScansLimit(limit: number) {
  return Number.isInteger(limit) && limit > 0 ? limit : 16;
}

export interface DashboardRecentScansCursor {
  submittedAt: Date;
  id: string;
}

export function encodeDashboardRecentScansCursor(scan: Pick<ScanRecord, "submittedAt" | "id">) {
  return Buffer
    .from(JSON.stringify({ submittedAt: scan.submittedAt.toISOString(), id: scan.id }), "utf8")
    .toString("base64url");
}

export function decodeDashboardRecentScansCursor(cursor: string | null | undefined): DashboardRecentScansCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      submittedAt?: unknown;
      id?: unknown;
    };
    const submittedAt = typeof parsed.submittedAt === "string" ? new Date(parsed.submittedAt) : null;

    if (!submittedAt || Number.isNaN(submittedAt.getTime()) || typeof parsed.id !== "string" || parsed.id.length === 0) {
      return null;
    }

    return { submittedAt, id: parsed.id };
  } catch {
    return null;
  }
}

function getDashboardRecentScansSubmittedAtCursorExpression() {
  return sql<Date>`date_trunc('milliseconds', ${scans.submittedAt})`;
}

export function isDashboardRecentScanAfterCursor(
  scan: Pick<ScanRecord, "submittedAt" | "id">,
  cursor: DashboardRecentScansCursor,
) {
  if (scan.submittedAt.getTime() < cursor.submittedAt.getTime()) {
    return true;
  }

  if (scan.submittedAt.getTime() > cursor.submittedAt.getTime()) {
    return false;
  }

  return scan.id < cursor.id;
}

function getDashboardRecentScansCursorFilter(
  cursor: DashboardRecentScansCursor | null,
  submittedAtCursorExpression: ReturnType<typeof getDashboardRecentScansSubmittedAtCursorExpression>,
) {
  if (!cursor) {
    return undefined;
  }

  return or(
    lt(submittedAtCursorExpression, cursor.submittedAt),
    and(eq(submittedAtCursorExpression, cursor.submittedAt), lt(scans.id, cursor.id)),
  );
}

export async function getDashboardRecentScansPage(
  actor: ActorContext,
  options: { limit: number; cursor?: string | null },
): Promise<RecentScansPage> {
  const limit = normalizeDashboardRecentScansLimit(options.limit);
  const cursor = decodeDashboardRecentScansCursor(options.cursor);
  const visibleScansFilter = getVisibleScansFilter(actor);
  const submittedAtCursorExpression = getDashboardRecentScansSubmittedAtCursorExpression();
  const cursorFilter = getDashboardRecentScansCursorFilter(cursor, submittedAtCursorExpression);
  const rows = await db
    .select()
    .from(scans)
    .where(cursorFilter ? and(visibleScansFilter, cursorFilter) : visibleScansFilter)
    .orderBy(desc(submittedAtCursorExpression), desc(scans.id))
    .limit(limit + 1);

  const pageRows = rows.slice(0, limit);
  const scanListItems = pageRows.map(toScanListItem);
  const scanIds = scanListItems.map((item) => item.scanId);
  const [snapshots, phaseRunsByScanId] = await Promise.all([
    listCompletedResultSnapshots(actor, scanIds),
    getPhaseRunsByScanId(scanIds),
  ]);
  const snapshotByScanId = new Map(snapshots.map((snapshot) => [snapshot.scanId, snapshot]));

  return {
    items: scanListItems.map((scan) => mapDashboardRecentScan(
      scan,
      snapshotByScanId.get(scan.scanId),
      phaseRunsByScanId.get(scan.scanId) ?? [],
    )),
    nextCursor: rows.length > limit && pageRows.length > 0
      ? encodeDashboardRecentScansCursor(pageRows[pageRows.length - 1]!)
      : null,
  };
}

export async function getDashboardRecentScans(actor: ActorContext, limit = 4): Promise<RecentScan[]> {
  const page = await getDashboardRecentScansPage(actor, { limit });
  return page.items;
}

export async function getDashboardStats(actor: ActorContext): Promise<Stat[]> {
  const visibleScansFilter = getVisibleScansFilter(actor);
  const [workspaceScans, completedSnapshots] = await Promise.all([
    db.select().from(scans).where(visibleScansFilter),
    listCompletedResultSnapshots(actor),
  ]);
  const runningCount = workspaceScans.filter((scan) => runningScanStatuses.has(scan.status)).length;
  const analyzedSiteCount = new Set(completedSnapshots.map((snapshot) => snapshot.canonicalTargetId)).size;
  const technologyCount = new Set(completedSnapshots.flatMap((snapshot) => snapshot.technologies)).size;
  const sparklineSeries = buildDashboardSparklineSeries(workspaceScans, completedSnapshots);

  return [
    {
      label: "Total scans",
      value: String(workspaceScans.length),
      icon: "runs",
      href: "/runs",
      subvalue: "all",
      indicator: "static",
      meta: "System total",
      sparkline: sparklineSeries.totalScans,
    },
    {
      label: "Sites analyzed",
      value: String(analyzedSiteCount),
      icon: "targets",
      href: "/targets",
      subvalue: "sites",
      indicator: "static",
      meta: "Unique completed sites",
      sparkline: sparklineSeries.sitesAnalyzed,
    },
    {
      label: "Active scans",
      value: String(runningCount),
      icon: "active",
      subvalue: "active",
      indicator: "pulse",
      meta: runningCount > 0 ? `${runningCount} active now` : "Idle right now",
      inFlight: runningCount,
      sparkline: sparklineSeries.activeScans,
    },
    {
      label: "Tech discoveries",
      value: String(technologyCount),
      icon: "technologies",
      subvalue: "unique",
      indicator: "static",
      meta: "Unique technologies",
      sparkline: sparklineSeries.techDiscoveries,
    },
  ];
}
