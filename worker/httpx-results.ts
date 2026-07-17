import {
  scanEvents,
  scanResultDetections,
  scanResults,
} from "../drizzle/schema.ts";
import { buildEnrichedTechnologies } from "../lib/server/scans/technology-enrichment.ts";
import { db } from "./db.ts";
import { getHttpxExecutionTarget, type HttpxJson, type HttpxRequestProfile } from "./httpx.ts";
import { emitResultEventForRow } from "./result-events.ts";
import {
  buildDetectionRows,
  buildSearchDocument,
  collectUniqueTechnologyNames,
  extractCpeEntries,
  promoteTechnologiesFromCpe,
  toObject,
} from "./result-detections.ts";
import type { ClaimedScan } from "./scan-claims.ts";

type NoJsonHttpProbePlaceholderInput = {
  scanId: string;
  attemptId: string;
  inputTarget: string;
  normalizedTarget: string;
  requestProfile: HttpxRequestProfile;
  fallbackReason: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
    : [];
}

export function parseResponseTimeMs(payload: HttpxJson): number | null {
  const explicit = asNumber(payload.response_time_ms);

  if (explicit !== null) {
    return explicit;
  }

  const timeString = asString(payload.time);

  if (!timeString) {
    return null;
  }

  const match = timeString.match(/([\d.]+)ms/i);

  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(match[1]!);

  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function isRenderableImageSrc(value: string | null): value is string {
  return typeof value === "string" && (value.startsWith("/") || /^https?:\/\//i.test(value));
}

function isLikelyMmh3Hash(value: string | null): value is string {
  return typeof value === "string" && /^-?\d+$/.test(value);
}

export function extractFaviconFields(payload: HttpxJson) {
  const favicon = asString(payload.favicon);
  const faviconUrl = asString(payload.favicon_url);
  const faviconPath = asString(payload.favicon_path);

  return {
    faviconMmh3: asString(payload.favicon_mmh3) ?? (isLikelyMmh3Hash(favicon) ? favicon : null),
    faviconMd5: asString(payload.favicon_md5),
    faviconUrl: faviconUrl ?? (isRenderableImageSrc(favicon) ? favicon : null),
    faviconPath,
  };
}

export type FaviconFields = ReturnType<typeof extractFaviconFields>;

export async function persistHttpxResult(claimedScan: ClaimedScan, payload: HttpxJson, resultCount: { value: number }) {
  resultCount.value += 1;

  const technologies = collectUniqueTechnologyNames(asStringArray(payload.tech));
  const wordpress = toObject(payload.wordpress);
  const plugins = asStringArray(wordpress.plugins);
  const themes = asStringArray(wordpress.themes);
  const cpeEntries = extractCpeEntries(payload.cpe);
  const responseHeaders = toObject(payload.header);
  const asn = toObject(payload.asn);
  const tls = toObject(payload.tls);
  const csp = toObject(payload.csp);
  const hashes = toObject(payload.hash);
  const favicon = extractFaviconFields(payload);
  const bodyDomains = asStringArray(payload.body_domains);
  const bodyFqdns = asStringArray(payload.body_fqdn);
  const promotedCpeTechnologies = promoteTechnologiesFromCpe(cpeEntries);
  const visibleTechnologies = buildEnrichedTechnologies({
    persistedTechnologies: technologies,
    cpeEntries,
  });
  const chain = Array.isArray(payload.chain)
    ? payload.chain.filter((entry): entry is Record<string, unknown> => isObject(entry))
    : [];

  const [result] = await db
    .insert(scanResults)
    .values({
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      observedAt: new Date(),
      url: asString(payload.url),
      finalUrl: asString(payload.final_url) ?? asString(payload.url),
      input: asString(payload.input),
      host: asString(payload.host),
      scheme: asString(payload.scheme),
      port: asString(payload.port),
      path: asString(payload.path),
      method: asString(payload.method),
      hostIp: asString(payload.host_ip),
      statusCode: asNumber(payload.status_code),
      title: asString(payload.title),
      webServer: asString(payload.webserver),
      location: asString(payload.location),
      contentType: asString(payload.content_type),
      contentLength: asNumber(payload.content_length),
      responseTimeMs: parseResponseTimeMs(payload),
      words: asNumber(payload.words),
      lines: asNumber(payload.lines),
      cdn: asBoolean(payload.cdn) || asString(payload.cdn_name) !== null,
      cdnName: asString(payload.cdn_name),
      cdnType: asString(payload.cdn_type),
      faviconMmh3: favicon.faviconMmh3,
      faviconMd5: favicon.faviconMd5,
      faviconUrl: favicon.faviconUrl,
      faviconPath: favicon.faviconPath,
      sni: asString(tls.sni),
      jarmHash: asString(payload.jarm_hash) ?? asString(payload.jarm),
      bodyPreview: asString(payload.body_preview),
      rawHeaders: asString(payload.raw_header),
      responseHeadersJson: responseHeaders,
      dnsARecords: asStringArray(payload.a),
      dnsAaaaRecords: asStringArray(payload.aaaa),
      dnsCnameRecords: asStringArray(payload.cname),
      dnsResolvers: asStringArray(payload.resolvers),
      asnJson: asn,
      tlsJson: tls,
      cspJson: csp,
      hashesJson: hashes,
      bodyDomains,
      bodyFqdns,
      redirectChainStatusCodes: asNumberArray(payload.chain_status_codes),
      redirectChainJson: chain,
      http2: asBoolean(payload.http2),
      pipeline: asBoolean(payload.pipeline),
      websocket: asBoolean(payload.websocket),
      vhost: asBoolean(payload.vhost),
      storedResponsePath: asString(payload.stored_response_path),
      failed: asBoolean(payload.failed),
      rawJson: payload,
      searchDocument: buildSearchDocument({
        input: asString(payload.input),
        finalUrl: asString(payload.final_url) ?? asString(payload.url),
        title: asString(payload.title),
        server: asString(payload.webserver),
        technologies: visibleTechnologies,
        plugins,
        themes,
        cpes: cpeEntries.map((entry) => entry.cpe),
      }),
    })
    .returning();

  const detectionRows = buildDetectionRows({
    resultId: result.id,
    technologies,
    promotedCpeTechnologies,
    plugins,
    themes,
    cpeEntries,
  });

  if (detectionRows.length > 0) {
    await db.insert(scanResultDetections).values(detectionRows);
  }

  await emitResultEventForRow(result, claimedScan.target);

  await db.insert(scanEvents).values({
    scanId: claimedScan.scan.id,
    attemptId: claimedScan.attempt.id,
    eventType: "scan.progress",
    payload: {
      scanId: claimedScan.scan.id,
      resultCount: resultCount.value,
      at: new Date().toISOString(),
    },
  });

  return true;
}

function getUrlPartsForResult(value: string) {
  try {
    const parsed = new URL(value);

    return {
      host: parsed.hostname || null,
      scheme: parsed.protocol.replace(/:$/, "") || null,
      port: parsed.port || null,
      path: `${parsed.pathname}${parsed.search}` || null,
    };
  } catch {
    return {
      host: null,
      scheme: null,
      port: null,
      path: null,
    };
  }
}

function getHttpProbePlaceholderUrl(normalizedTarget: string) {
  const executionTarget = getHttpxExecutionTarget(normalizedTarget);
  return /^https?:\/\//i.test(executionTarget) ? executionTarget : `https://${executionTarget}`;
}

export function buildNoJsonHttpProbePlaceholderResult(input: NoJsonHttpProbePlaceholderInput): typeof scanResults.$inferInsert {
  const executionTarget = getHttpProbePlaceholderUrl(input.normalizedTarget);
  const urlParts = getUrlPartsForResult(executionTarget);
  const rawJson = {
    input: input.inputTarget,
    url: executionTarget,
    final_url: executionTarget,
    tech: [],
    stackray_result_kind: "http_probe_no_output",
    stackray_http_probe: {
      reason: "no_json_output",
      request_profile: input.requestProfile,
      fallback_reason: input.fallbackReason,
      message: "httpx completed but emitted no JSON result; continuing browser-based recovery.",
    },
  };

  return {
    scanId: input.scanId,
    attemptId: input.attemptId,
    observedAt: new Date(),
    url: executionTarget,
    finalUrl: executionTarget,
    input: input.inputTarget,
    host: urlParts.host,
    scheme: urlParts.scheme,
    port: urlParts.port,
    path: urlParts.path,
    method: null,
    statusCode: null,
    title: null,
    contentType: "text/html",
    failed: false,
    rawJson,
    searchDocument: buildSearchDocument({
      input: input.inputTarget,
      finalUrl: executionTarget,
      title: null,
      server: null,
      technologies: [],
      plugins: [],
      themes: [],
      cpes: [],
    }),
  };
}

export async function createNoJsonHttpProbePlaceholderResult(
  claimedScan: ClaimedScan,
  requestProfile: HttpxRequestProfile,
  fallbackReason: string,
) {
  const [result] = await db
    .insert(scanResults)
    .values(buildNoJsonHttpProbePlaceholderResult({
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      inputTarget: claimedScan.target.inputTarget,
      normalizedTarget: claimedScan.target.normalizedTarget,
      requestProfile,
      fallbackReason,
    }))
    .returning();

  if (result) {
    await emitResultEventForRow(result, claimedScan.target);
  }

  return result ?? null;
}
