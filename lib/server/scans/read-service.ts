import { and, desc, eq, inArray } from "drizzle-orm";

import type { RecentScan, Stat } from "@/components/dashboard/types";
import type { ActorContext } from "@/lib/session/actor-context";
import {
  scanAttempts,
  scanResultCpes,
  scanResultNucleiMatches,
  scanResultNucleiRuns,
  scanResultTechnologies,
  scanResultWordpressPlugins,
  scanResultWordpressThemes,
  scanResults,
  scanTargets,
  scans,
} from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import {
  getScanResponseSchema,
  getScanResultsResponseSchema,
  listScansResponseSchema,
  type ScanListItem,
} from "@/lib/contracts/scans";
import { targetHistoryResponseSchema } from "@/lib/contracts/search";
import { buildEnrichedTechnologies } from "@/lib/server/scans/technology-enrichment";
import { normalizeRedirectChainItems } from "@/lib/server/scans/redirect-chain";

type AttemptStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
type RequestProfile = "baseline" | "browser_headers" | "tlsi_final_url";

type ScanTargetRecord = typeof scanTargets.$inferSelect;
type ScanRecord = typeof scans.$inferSelect;
type AttemptRecord = typeof scanAttempts.$inferSelect;
type ResultRecord = typeof scanResults.$inferSelect;
type NucleiRunRecord = typeof scanResultNucleiRuns.$inferSelect;
type NucleiMatchRecord = typeof scanResultNucleiMatches.$inferSelect;

export type ResultDecorations = {
  technologies: string[];
  wordpressPlugins: string[];
  wordpressThemes: string[];
  cpe: Array<{
    cpe: string;
    vendor: string | null;
    product: string | null;
  }>;
  nucleiRun: NucleiRunRecord | null;
  nucleiMatches: NucleiMatchRecord[];
  nucleiTechnologyNames: string[];
};

export interface ScanListFilters {
  status?: ScanRecord["status"];
  source?: ScanRecord["source"];
  target?: string | null;
  limit?: number;
}

export interface ScanResultsFilters {
  page?: number;
  pageSize?: number;
  target?: string | null;
  technology?: string | null;
  statusCode?: number | null;
  includeIncomplete?: boolean;
}

export interface CompletedResultSnapshot {
  resultId: string;
  scanId: string;
  canonicalTargetId: string;
  normalizedTarget: string;
  title: string;
  technologies: string[];
  wordpressPlugins: string[];
  wordpressThemes: string[];
  cpe: string[];
  statusCode: number;
  server: string | null;
  cdn: string | null;
  completedAt: string;
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

function parseAttemptMeta(attempt: AttemptRecord | null) {
  const meta = attempt?.metaJson;
  const record = meta && typeof meta === "object" && !Array.isArray(meta) ? meta as Record<string, unknown> : {};
  const requestProfile =
    record.requestProfile === "browser_headers" || record.requestProfile === "tlsi_final_url"
      ? record.requestProfile
      : "baseline";

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
    targetCount: scan.targetCount,
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
    technologies: (decorations?.nucleiMatches ?? [])
      .filter((match) => match.technologyName !== null)
      .map(mapNucleiMatch),
    findings: (decorations?.nucleiMatches ?? [])
      .filter((match) => match.technologyName === null)
      .map(mapNucleiMatch),
  };
}

export function getVisibleTechnologies(result: ResultRecord, decorations: ResultDecorations | undefined) {
  return buildEnrichedTechnologies({
    persistedTechnologies: decorations?.technologies ?? [],
    additionalTechnologies: decorations?.nucleiTechnologyNames ?? [],
    cpeEntries: decorations?.cpe ?? [],
    cspJson: parseJsonObject(result.cspJson),
    bodyDomains: parseJsonArray(result.bodyDomains),
    bodyFqdns: parseJsonArray(result.bodyFqdns),
  });
}

export async function getScanRecord(actor: ActorContext, scanId: string): Promise<ScanRecord | null> {
  const [scan] = await db
    .select()
    .from(scans)
    .where(eq(scans.id, scanId))
    .limit(1);

  return scan ?? null;
}

async function getScanTargetsMap(scanIds: string[]) {
  if (scanIds.length === 0) {
    return {
      byScanId: new Map<string, ScanTargetRecord[]>(),
      byTargetId: new Map<string, ScanTargetRecord>(),
    };
  }

  const rows = await db
    .select()
    .from(scanTargets)
    .where(inArray(scanTargets.scanId, scanIds));

  const byScanId = new Map<string, ScanTargetRecord[]>();
  const byTargetId = new Map<string, ScanTargetRecord>();

  for (const row of rows) {
    const existing = byScanId.get(row.scanId) ?? [];
    existing.push(row);
    byScanId.set(row.scanId, existing);
    byTargetId.set(row.id, row);
  }

  for (const [scanId, targets] of byScanId) {
    targets.sort((left, right) => left.sortOrder - right.sortOrder);
    byScanId.set(scanId, targets);
  }

  return { byScanId, byTargetId };
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

  const [technologies, plugins, themes, cpes, nucleiRuns, nucleiMatches] = await Promise.all([
    db
      .select({ resultId: scanResultTechnologies.resultId, name: scanResultTechnologies.technologyName })
      .from(scanResultTechnologies)
      .where(inArray(scanResultTechnologies.resultId, resultIds)),
    db
      .select({ resultId: scanResultWordpressPlugins.resultId, name: scanResultWordpressPlugins.pluginName })
      .from(scanResultWordpressPlugins)
      .where(inArray(scanResultWordpressPlugins.resultId, resultIds)),
    db
      .select({ resultId: scanResultWordpressThemes.resultId, name: scanResultWordpressThemes.themeName })
      .from(scanResultWordpressThemes)
      .where(inArray(scanResultWordpressThemes.resultId, resultIds)),
    db
      .select({
        resultId: scanResultCpes.resultId,
        cpe: scanResultCpes.cpe,
        vendor: scanResultCpes.vendor,
        product: scanResultCpes.product,
      })
      .from(scanResultCpes)
      .where(inArray(scanResultCpes.resultId, resultIds)),
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

  for (const technology of technologies) {
    getEntry(technology.resultId).technologies.push(technology.name);
  }

  for (const plugin of plugins) {
    getEntry(plugin.resultId).wordpressPlugins.push(plugin.name);
  }

  for (const theme of themes) {
    getEntry(theme.resultId).wordpressThemes.push(theme.name);
  }

  for (const cpe of cpes) {
    getEntry(cpe.resultId).cpe.push({
      cpe: cpe.cpe,
      vendor: cpe.vendor,
      product: cpe.product,
    });
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

export function mapResultItem(result: ResultRecord, target: ScanTargetRecord | undefined, decorations: ResultDecorations | undefined) {
  const technologies = getVisibleTechnologies(result, decorations);
  const screenshotPath = result.screenshotObjectKey
    ? `/api/v1/scans/${result.scanId}/results/${result.id}/screenshot`
    : null;
  const nuclei = buildNucleiBlock(decorations);
  const favicon = normalizeFavicon(result);

  return {
    resultId: result.id,
    target: target?.normalizedTarget ?? result.finalUrl ?? result.url ?? result.input ?? "",
    input: result.input ?? target?.inputTarget ?? "",
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
            : null,
      org:
        typeof parseJsonObject(result.asnJson).org === "string"
          ? (parseJsonObject(result.asnJson).org as string)
          : null,
      country:
        typeof parseJsonObject(result.asnJson).country === "string"
          ? (parseJsonObject(result.asnJson).country as string)
          : null,
      range: Array.isArray(parseJsonObject(result.asnJson).range)
        ? (parseJsonObject(result.asnJson).range as string[])
        : undefined,
    },
    tls: {
      sni: result.sni ?? null,
      jarmHash: result.jarmHash ?? null,
      certificate: parseJsonObject(result.tlsJson),
    },
    technologies,
    wordpress: {
      plugins: decorations?.wordpressPlugins ?? [],
      themes: decorations?.wordpressThemes ?? [],
    },
    cpe: decorations?.cpe ?? [],
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

function matchesTargetFilter(target: ScanTargetRecord | undefined, filter: string | null | undefined) {
  if (!filter) {
    return true;
  }

  const normalizedFilter = normalizeSearchToken(filter);

  return [target?.inputTarget ?? "", target?.normalizedTarget ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(normalizedFilter);
}

function matchesTechnologyFilter(result: ResultRecord, decorations: ResultDecorations | undefined, filter: string | null | undefined) {
  if (!filter) {
    return true;
  }

  const normalizedFilter = normalizeSearchToken(filter);

  return getVisibleTechnologies(result, decorations).some((technology) => normalizeSearchToken(technology).includes(normalizedFilter));
}

export async function listScans(actor: ActorContext, filters: ScanListFilters = {}) {
  const rows = await db
    .select()
    .from(scans)
    .orderBy(desc(scans.submittedAt));

  const { byScanId } = await getScanTargetsMap(rows.map((scan) => scan.id));
  const filtered = rows.filter((scan) => {
    if (filters.status && scan.status !== filters.status) {
      return false;
    }

    if (filters.source && scan.source !== filters.source) {
      return false;
    }

    if (filters.target) {
      const normalizedTarget = normalizeSearchToken(filters.target);
      const matchesTarget = (byScanId.get(scan.id) ?? []).some((target) => {
        return [target.inputTarget, target.normalizedTarget]
          .join(" ")
          .toLowerCase()
          .includes(normalizedTarget);
      });

      if (!matchesTarget) {
        return false;
      }
    }

    return true;
  });

  const limited = filtered.slice(0, filters.limit ?? 20).map(toScanListItem);

  return listScansResponseSchema.parse({
    items: limited,
    nextCursor: null,
  });
}

export async function getScanDetail(actor: ActorContext, scanId: string) {
  const scan = await getScanRecord(actor, scanId);

  if (!scan) {
    return null;
  }

  const [{ byScanId }, latestAttempts, attemptsByScanId] = await Promise.all([
    getScanTargetsMap([scan.id]),
    getLatestAttempts([scan.id]),
    getAttemptsByScanId([scan.id]),
  ]);

  const targets = byScanId.get(scan.id) ?? [];
  const currentAttempt = latestAttempts.get(scan.id) ?? null;
  const attemptHistory = attemptsByScanId.get(scan.id) ?? [];
  const selectedAttemptId = currentAttempt?.id ?? null;

  const results = selectedAttemptId ? await getResultsForAttempts([selectedAttemptId]) : [];
  const resultCount = results.length;
  const processedTargets = new Set(results.map((result) => result.scanTargetId)).size;

  return getScanResponseSchema.parse({
    scanId: scan.id,
    status: scan.status,
    source: scan.source,
    targets: targets.map((target) => ({
      scanTargetId: target.id,
      inputTarget: target.inputTarget,
      normalizedTarget: target.normalizedTarget,
    })),
    currentAttempt: toAttemptSummary(scan, currentAttempt),
    attemptHistory: attemptHistory.map((attempt) => toAttemptSummary(scan, attempt)),
    progress: {
      processedTargets,
      totalTargets: Math.max(scan.targetCount, targets.length, 1),
      resultCount,
    },
  });
}

export async function getScanResults(actor: ActorContext, scanId: string, filters: ScanResultsFilters = {}) {
  const scan = await getScanRecord(actor, scanId);

  if (!scan) {
    return null;
  }

  const [{ byTargetId }, latestAttempts] = await Promise.all([
    getScanTargetsMap([scan.id]),
    getLatestAttempts([scan.id]),
  ]);

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
    const target = byTargetId.get(result.scanTargetId);
    const decorations = decorationsByResultId.get(result.id);

    if (!matchesTargetFilter(target, filters.target)) {
      return false;
    }

    if (!matchesTechnologyFilter(result, decorations, filters.technology)) {
      return false;
    }

    if (typeof filters.statusCode === "number" && result.statusCode !== filters.statusCode) {
      return false;
    }

    return true;
  });

  const ordered = [...filtered].sort((left, right) => {
    const leftSortOrder = byTargetId.get(left.scanTargetId)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightSortOrder = byTargetId.get(right.scanTargetId)?.sortOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftSortOrder !== rightSortOrder) {
      return leftSortOrder - rightSortOrder;
    }

    return right.observedAt.getTime() - left.observedAt.getTime();
  });

  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.max(filters.pageSize ?? 20, 1);
  const start = (page - 1) * pageSize;
  const paged = ordered.slice(start, start + pageSize);

  return getScanResultsResponseSchema.parse({
    items: paged.map((result) => mapResultItem(result, byTargetId.get(result.scanTargetId), decorationsByResultId.get(result.id))),
    page,
    pageSize,
    total: ordered.length,
  });
}

export async function listCompletedResultSnapshots(): Promise<CompletedResultSnapshot[]> {
  const completedScans = await db
    .select()
    .from(scans)
    .where(eq(scans.status, "completed"))
    .orderBy(desc(scans.completedAt));

  const scanIds = completedScans.map((scan) => scan.id);
  const latestAttempts = await getLatestAttempts(scanIds);
  const attemptIds = [...latestAttempts.values()].map((attempt) => attempt.id);
  const [{ byTargetId }, results] = await Promise.all([
    getScanTargetsMap(scanIds),
    getResultsForAttempts(attemptIds),
  ]);
  const decorationsByResultId = await getResultDecorations(results.map((result) => result.id));
  const completedAtByScanId = new Map(completedScans.map((scan) => [scan.id, scan.completedAt?.toISOString() ?? scan.submittedAt.toISOString()]));

  return results
    .map((result) => {
      const target = byTargetId.get(result.scanTargetId);

      if (!target?.canonicalTargetId) {
        return null;
      }

      const decorations = decorationsByResultId.get(result.id);
      const technologies = getVisibleTechnologies(result, decorations);

      return {
        resultId: result.id,
        scanId: result.scanId,
        canonicalTargetId: target.canonicalTargetId,
        normalizedTarget: target.normalizedTarget,
        title: result.title ?? "",
        technologies,
        wordpressPlugins: decorations?.wordpressPlugins ?? [],
        wordpressThemes: decorations?.wordpressThemes ?? [],
        cpe: (decorations?.cpe ?? []).map((entry) => entry.cpe),
        statusCode: result.statusCode ?? 0,
        server: result.webServer ?? null,
        cdn: result.cdnName ?? null,
        completedAt: completedAtByScanId.get(result.scanId) ?? new Date(0).toISOString(),
      } satisfies CompletedResultSnapshot;
    })
    .filter((snapshot): snapshot is CompletedResultSnapshot => snapshot !== null)
    .sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime());
}

export async function getTargetHistoryForScan(actor: ActorContext, scanId: string, limit = 4) {
  const scan = await getScanRecord(actor, scanId);

  if (!scan) {
    return null;
  }

  const { byScanId } = await getScanTargetsMap([scan.id]);
  const primaryTarget = (byScanId.get(scan.id) ?? [])[0];

  if (!primaryTarget) {
    return targetHistoryResponseSchema.parse({
      canonicalTargetId: "",
      normalizedTarget: "",
      items: [],
    });
  }

  const snapshots = await listCompletedResultSnapshots();
  const items = snapshots
    .filter((snapshot) => snapshot.canonicalTargetId === primaryTarget.canonicalTargetId)
    .slice(0, limit)
    .map((snapshot) => ({
      scanId: snapshot.scanId,
      status: "completed" as const,
      title: snapshot.title,
      technologies: snapshot.technologies,
      completedAt: snapshot.completedAt,
    }));

  return targetHistoryResponseSchema.parse({
    canonicalTargetId: primaryTarget.canonicalTargetId ?? "",
    normalizedTarget: primaryTarget.normalizedTarget,
    items,
  });
}

export async function getDashboardRecentScans(actor: ActorContext, limit = 4): Promise<RecentScan[]> {
  const scanList = await listScans(actor, { limit });
  const scanIds = scanList.items.map((item) => item.scanId);
  const [{ byScanId }, snapshots] = await Promise.all([
    getScanTargetsMap(scanIds),
    listCompletedResultSnapshots(),
  ]);

  const snapshotByScanId = new Map(snapshots.map((snapshot) => [snapshot.scanId, snapshot]));

  return scanList.items.map((scan) => {
    const primaryTarget = (byScanId.get(scan.scanId) ?? [])[0];
    const snapshot = snapshotByScanId.get(scan.scanId);

    if (scan.status === "completed" && snapshot) {
      return {
        id: scan.scanId,
        target: primaryTarget?.normalizedTarget ?? "",
        ip: "—",
        status: "complete",
        technologies: snapshot.technologies,
        timestamp: scan.completedAt ?? scan.submittedAt,
        statusCode: snapshot.statusCode,
        server: snapshot.server ?? undefined,
        cdn: snapshot.cdn ?? undefined,
        responseTimeMs: undefined,
        techCount: snapshot.technologies.length,
      } satisfies RecentScan;
    }

    if (scan.status === "failed" || scan.status === "cancelled") {
      return {
        id: scan.scanId,
        target: primaryTarget?.normalizedTarget ?? "",
        ip: "—",
        status: "failed",
        error: scan.status === "failed" ? scan.status : "Cancelled",
        timestamp: scan.completedAt ?? scan.submittedAt,
      } satisfies RecentScan;
    }

    return {
      id: scan.scanId,
      target: primaryTarget?.normalizedTarget ?? "",
      ip: "—",
      status: "analyzing",
      timestamp: scan.submittedAt,
      progress: 0,
    } satisfies RecentScan;
  });
}

export async function getDashboardStats(): Promise<Stat[]> {
  const workspaceScans = await db.select().from(scans);
  const completedSnapshots = await listCompletedResultSnapshots();
  const runningCount = workspaceScans.filter((scan) => scan.status === "queued" || scan.status === "running" || scan.status === "processing").length;
  const changedTargets = new Set(completedSnapshots.map((snapshot) => snapshot.canonicalTargetId)).size;
  const technologyCount = new Set(completedSnapshots.flatMap((snapshot) => snapshot.technologies)).size;

  return [
    {
      label: "Total Scans",
      value: String(workspaceScans.length),
      subvalue: "all",
      indicator: "static",
      meta: "System total",
    },
    {
      label: "Scans In Flight",
      value: String(runningCount),
      subvalue: "active",
      indicator: "pulse",
      meta: `${runningCount} active`,
    },
    {
      label: "Targets Changed",
      value: String(changedTargets),
      subvalue: "tracked",
      indicator: "static",
      meta: "Completed targets",
    },
    {
      label: "High-Confidence Hits",
      value: String(technologyCount),
      subvalue: "verified",
      indicator: "static",
      meta: "Distinct technologies",
    },
  ];
}
