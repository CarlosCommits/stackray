import type { Dirent } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, isAbsolute, join } from "node:path";

import { eq } from "drizzle-orm";

import { scanResults, scans } from "../drizzle/schema.ts";
import { env } from "../lib/env/server.ts";
import { uploadScreenshotObject } from "../lib/server/storage/screenshot-uploads.ts";
import { buildScreenshotObjectKey, screenshotStorageEnabled } from "../lib/server/storage/screenshots.ts";
import { db } from "./db.ts";
import {
  BROWSER_LIKE_HEADERS,
  CUSTOM_WAPPALYZER_FINGERPRINTS_PATH,
  getHttpxExecutionTarget,
  type HttpxJson,
  runHttpxCli,
  type RunHttpxCliResult,
} from "./httpx.ts";
import { extractFaviconFields, type FaviconFields } from "./httpx-results.ts";
import { emitResultEventForRow } from "./result-events.ts";
import { collectUniqueTechnologyNames } from "./result-detections.ts";
import {
  mergeScreenshotTechnologies,
  persistResultRawJsonPatch,
  updateResultSearchDocument,
} from "./result-persistence.ts";

type ScanRow = typeof scans.$inferSelect;
type ScanResultRow = typeof scanResults.$inferSelect;

export type HeadlessDocumentObservation = {
  url: string | null;
  statusCode: number | null;
};

export type HeadlessNetworkSummary = {
  networkRequestCount: number;
  scriptRequestCount: number;
  sameOriginScriptRequestCount: number;
  pendingSameOriginScriptCount: number;
};

export type HeadlessMetadataPromotion = {
  finalUrl?: string;
  statusCode?: number;
  title?: string;
  hostIp?: string;
  dnsARecords?: string[];
  dnsAaaaRecords?: string[];
  dnsResolvers?: string[];
  faviconMmh3?: string;
  faviconMd5?: string;
  faviconUrl?: string;
  faviconPath?: string;
};

type HeadlessEnrichmentEvidence = {
  title: string | null;
  documentObservation: HeadlessDocumentObservation | null;
  networkSummary: HeadlessNetworkSummary | null;
  technologies: string[];
  completedPassCount: number;
  runtimeTechnologyDegraded: boolean;
};

export type HeadlessEnrichmentOptions = {
  signal?: AbortSignal;
  isCancellationRequested: (scanId: string) => Promise<boolean>;
};

const DEFAULT_SCREENSHOT_TIMEOUT_MS = env.STACKRAY_SCREENSHOT_TIMEOUT_MS ?? 30 * 1000;
const DEFAULT_HEADLESS_ENRICHMENT_TIMEOUT_MS =
  env.STACKRAY_HEADLESS_ENRICHMENT_TIMEOUT_MS ?? Math.max(45 * 1000, DEFAULT_SCREENSHOT_TIMEOUT_MS + 30 * 1000);
const DEFAULT_HEADLESS_IDLE_MS = env.STACKRAY_HEADLESS_IDLE_MS ?? 10 * 1000;

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function resolveHeadlessTechnologyDetectionTimeoutMs({
  configuredTimeoutMs,
  headlessIdleMs,
  screenshotTimeoutMs,
  screenshotProcessTimeoutMs,
  observedNetworkRequestCount,
  observedScriptRequestCount,
  observedSameOriginScriptRequestCount,
  observedPendingSameOriginScriptRequestCount,
}: {
  configuredTimeoutMs?: number;
  headlessIdleMs: number;
  screenshotTimeoutMs: number;
  screenshotProcessTimeoutMs: number;
  observedNetworkRequestCount?: number | null;
  observedScriptRequestCount?: number | null;
  observedSameOriginScriptRequestCount?: number | null;
  observedPendingSameOriginScriptRequestCount?: number | null;
}) {
  if (configuredTimeoutMs !== undefined) {
    return configuredTimeoutMs;
  }

  const baseTimeoutMs = Math.max(
    150 * 1000,
    screenshotProcessTimeoutMs,
    screenshotTimeoutMs + headlessIdleMs + 110 * 1000,
  );
  const networkRequestCount = observedNetworkRequestCount ?? 0;
  const scriptRequestCount = observedScriptRequestCount ?? 0;
  const sameOriginScriptRequestCount = observedSameOriginScriptRequestCount ?? 0;
  const pendingSameOriginScriptRequestCount = observedPendingSameOriginScriptRequestCount ?? 0;
  const workloadBufferMs = Math.min(
    180 * 1000,
    (networkRequestCount * 100)
      + (scriptRequestCount * 250)
      + (sameOriginScriptRequestCount * 500)
      + (pendingSameOriginScriptRequestCount * 2_500),
  );

  return baseTimeoutMs + workloadBufferMs;
}

export function buildHttpxHeadlessEnrichmentArguments({
  captureScreenshot,
  storeDir,
  target,
}: {
  captureScreenshot: boolean;
  storeDir?: string;
  target?: string;
}) {
  const args = [
    "-silent",
    "-json",
    captureScreenshot ? "-td" : "-tdh",
    "-title",
    "-favicon",
    "-ip",
    "-cff",
    CUSTOM_WAPPALYZER_FINGERPRINTS_PATH,
    "-st",
    String(Math.ceil(DEFAULT_SCREENSHOT_TIMEOUT_MS / 1000)),
    "-sid",
    String(Math.ceil(DEFAULT_HEADLESS_IDLE_MS / 1000)),
    "-ehb",
    "-ho",
    "--no-sandbox",
  ];

  for (const header of BROWSER_LIKE_HEADERS) {
    args.push("-H", header);
  }

  if (captureScreenshot) {
    if (!storeDir) {
      throw new Error("storeDir is required when screenshot capture is enabled.");
    }

    args.push(
      "-screenshot",
      "-esb",
      "-no-screenshot-full-page",
      "-srd",
      storeDir,
    );
  }

  if (target) {
    args.push("-u", target);
  }

  return args;
}

export function shouldCaptureHomepageScreenshot(result: {
  statusCode: number | null;
  contentType: string | null;
  finalUrl: string | null;
  path: string | null;
}) {
  const contentType = result.contentType?.toLowerCase() ?? "";

  if (!result.finalUrl) {
    return false;
  }

  if (result.statusCode === null) {
    return contentType.includes("text/html") || contentType.includes("application/xhtml+xml") || contentType.length === 0;
  }

  const statusCode = result.statusCode;

  if ((statusCode < 200 || statusCode >= 400) && !new Set([403, 429]).has(statusCode)) {
    return false;
  }

  return contentType.includes("text/html") || contentType.includes("application/xhtml+xml") || contentType.length === 0;
}

export function extractHeadlessDocumentObservation(payload: HttpxJson): HeadlessDocumentObservation | null {
  const linkRequests = Array.isArray(payload.link_request) ? payload.link_request : [];

  for (const entry of linkRequests) {
    const record = toObject(entry);
    const resourceType = asString(record.ResourceType) ?? asString(record.resource_type);

    if (resourceType !== "Document") {
      continue;
    }

    return {
      url: asString(record.URL) ?? asString(record.url),
      statusCode: asNumber(record.StatusCode) ?? asNumber(record.status_code),
    };
  }

  return null;
}

function getUrlOrigin(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

function isSameOriginUrl(value: string | null, origin: string | null) {
  if (!value || !origin) {
    return false;
  }

  return getUrlOrigin(value) === origin;
}

export function extractHeadlessNetworkSummary(payload: HttpxJson, documentUrl: string | null): HeadlessNetworkSummary | null {
  const linkRequests = Array.isArray(payload.link_request) ? payload.link_request : [];

  if (linkRequests.length === 0) {
    return null;
  }

  const documentOrigin = getUrlOrigin(documentUrl);
  const summary: HeadlessNetworkSummary = {
    networkRequestCount: 0,
    scriptRequestCount: 0,
    sameOriginScriptRequestCount: 0,
    pendingSameOriginScriptCount: 0,
  };

  for (const entry of linkRequests) {
    const record = toObject(entry);
    const resourceType = asString(record.ResourceType) ?? asString(record.resource_type);
    const requestUrl = asString(record.URL) ?? asString(record.url);
    const statusCode = asNumber(record.StatusCode) ?? asNumber(record.status_code);

    summary.networkRequestCount += 1;

    if (resourceType?.toLowerCase() !== "script") {
      continue;
    }

    summary.scriptRequestCount += 1;

    if (!isSameOriginUrl(requestUrl, documentOrigin)) {
      continue;
    }

    summary.sameOriginScriptRequestCount += 1;

    if (statusCode === null || statusCode <= 0) {
      summary.pendingSameOriginScriptCount += 1;
    }
  }

  return summary;
}

export function isRuntimeTechnologyDetectionDegraded(metrics: Record<string, unknown> | null) {
  return metrics === null || metrics.partial === true;
}

function shouldPromoteHeadlessDocumentStatus(
  result: { statusCode: number | null },
  observation: HeadlessDocumentObservation | null,
) {
  const statusCode = observation?.statusCode ?? null;

  if (statusCode === null || statusCode < 200 || statusCode >= 400) {
    return false;
  }

  return result.statusCode === null || result.statusCode >= 400;
}

function shouldRecoverHeadlessTitle(
  result: { statusCode: number | null; title: string | null },
  observation: HeadlessDocumentObservation | null,
) {
  if (shouldPromoteHeadlessDocumentStatus(result, observation)) {
    return true;
  }

  return !result.title || result.title === "Vercel Security Checkpoint";
}

function shouldPromoteHeadlessTitle(
  result: { statusCode: number | null; title: string | null },
  observation: HeadlessDocumentObservation | null,
  headlessTitle: string | null,
) {
  if (!headlessTitle) {
    return false;
  }

  return shouldRecoverHeadlessTitle(result, observation);
}

export function buildHeadlessMetadataPromotion(
  result: {
    statusCode: number | null;
    title: string | null;
    faviconMmh3: string | null;
    faviconMd5: string | null;
    faviconUrl: string | null;
    faviconPath: string | null;
  },
  promotedObservation: HeadlessDocumentObservation | null,
  headlessTitle: string | null,
  headlessFavicon: FaviconFields,
) {
  const metadataPromotion: HeadlessMetadataPromotion = {};

  if (shouldPromoteHeadlessDocumentStatus(result, promotedObservation)) {
    const promotedStatusCode = promotedObservation?.statusCode;
    const promotedFinalUrl = promotedObservation?.url ?? null;

    if (promotedStatusCode === null || promotedStatusCode === undefined) {
      throw new Error("Headless document status promotion was requested without a status code.");
    }

    metadataPromotion.statusCode = promotedStatusCode;

    if (promotedFinalUrl) {
      metadataPromotion.finalUrl = promotedFinalUrl;
    }
  }

  if (shouldPromoteHeadlessTitle(result, promotedObservation, headlessTitle)) {
    metadataPromotion.title = headlessTitle ?? undefined;
  }

  if (!result.faviconMmh3 && headlessFavicon.faviconMmh3) {
    metadataPromotion.faviconMmh3 = headlessFavicon.faviconMmh3;
  }

  if (!result.faviconMd5 && headlessFavicon.faviconMd5) {
    metadataPromotion.faviconMd5 = headlessFavicon.faviconMd5;
  }

  if (!result.faviconUrl && headlessFavicon.faviconUrl) {
    metadataPromotion.faviconUrl = headlessFavicon.faviconUrl;
  }

  if (!result.faviconPath && headlessFavicon.faviconPath) {
    metadataPromotion.faviconPath = headlessFavicon.faviconPath;
  }

  return metadataPromotion;
}

const SCREENSHOT_CAPTURE_ATTEMPT_LIMIT = 2;

function logWorkerEvent(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      component: "httpx-worker",
      event,
      ...payload,
    }),
  );
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function collectUniqueStrings(values: readonly string[]) {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    const normalized = value.trim();

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    uniqueValues.push(normalized);
  }

  return uniqueValues;
}

function mergeHeadlessNetworkSummary(
  current: HeadlessNetworkSummary | null,
  next: HeadlessNetworkSummary | null,
): HeadlessNetworkSummary | null {
  if (!next) {
    return current;
  }

  if (!current) {
    return next;
  }

  return {
    networkRequestCount: Math.max(current.networkRequestCount, next.networkRequestCount),
    scriptRequestCount: Math.max(current.scriptRequestCount, next.scriptRequestCount),
    sameOriginScriptRequestCount: Math.max(current.sameOriginScriptRequestCount, next.sameOriginScriptRequestCount),
    pendingSameOriginScriptCount: Math.max(current.pendingSameOriginScriptCount, next.pendingSameOriginScriptCount),
  };
}

function extractRuntimeTechnologyDetectionMetrics(payload: HttpxJson): Record<string, unknown> | null {
  const metrics = toObject(payload.tech_detection_metrics);

  return Object.keys(metrics).length > 0 ? metrics : null;
}

function buildHeadlessEnrichmentEvidence({
  title,
  documentObservation,
  networkSummary,
  technologies,
  completedPassCount,
  runtimeTechnologyDegraded,
}: {
  title: string | null;
  documentObservation: HeadlessDocumentObservation | null;
  networkSummary: HeadlessNetworkSummary | null;
  technologies: readonly string[];
  completedPassCount: number;
  runtimeTechnologyDegraded: boolean;
}): HeadlessEnrichmentEvidence {
  return {
    title,
    documentObservation,
    networkSummary,
    technologies: collectUniqueTechnologyNames(technologies).slice(0, 100),
    completedPassCount,
    runtimeTechnologyDegraded,
  };
}

async function findStoredScreenshotPath(directory: string): Promise<string | null> {
  let entries: Dirent<string>[];

  try {
    entries = await readdir(directory, { encoding: "utf8", withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      const nestedPath = await findStoredScreenshotPath(entryPath);

      if (nestedPath) {
        return nestedPath;
      }

      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = extname(entry.name).toLowerCase();

    if (extension === ".png" || extension === ".jpg" || extension === ".jpeg" || extension === ".webp") {
      return entryPath;
    }
  }

  return null;
}

export async function enrichResultWithHeadless(
  result: ScanResultRow,
  target: Pick<ScanRow, "normalizedTarget">,
  options: HeadlessEnrichmentOptions,
) {
  const { signal, isCancellationRequested } = options;
  const canStoreScreenshot = screenshotStorageEnabled();
  const canCaptureScreenshot = shouldCaptureHomepageScreenshot(result);
  const shouldCaptureScreenshot = canStoreScreenshot && canCaptureScreenshot;

  if (!canStoreScreenshot) {
    logWorkerEvent("screenshot_skipped", {
      scanId: result.scanId,
      resultId: result.id,
      target: target.normalizedTarget,
      reason: "storage_disabled",
    });
  }

  if (canStoreScreenshot && !canCaptureScreenshot) {
    logWorkerEvent("screenshot_skipped", {
      scanId: result.scanId,
      resultId: result.id,
      target: target.normalizedTarget,
      reason: "result_not_eligible",
      statusCode: result.statusCode,
      contentType: result.contentType,
    });
  }

  const workingDirectory = await mkdtemp(join(tmpdir(), "stackray-httpx-headless-"));

  try {
    let screenshotPath: string | null = null;
    const headlessTechnologies: string[] = [];
    let headlessDocumentObservation: HeadlessDocumentObservation | null = null;
    let headlessNetworkSummary: HeadlessNetworkSummary | null = null;
    let runtimeTechnologyMetrics: Record<string, unknown> | null = null;
    let runtimeTechnologyElapsedMs: number | null = null;
    let runtimeTechnologyTimeoutMs = DEFAULT_HEADLESS_TECH_DETECTION_TIMEOUT_MS;
    let runtimeTechnologyDegraded = false;
    let runtimeTechnologyMessage: string | null = null;
    let headlessTitle: string | null = null;
    let headlessHostIp: string | null = null;
    let headlessDnsARecords: string[] = [];
    let headlessDnsAaaaRecords: string[] = [];
    let headlessDnsResolvers: string[] = [];
    let headlessFavicon: FaviconFields = {
      faviconMmh3: null,
      faviconMd5: null,
      faviconUrl: null,
      faviconPath: null,
    };
    let updatedResult: ScanResultRow | null = null;
    let completedHeadlessPassCount = 0;
    const lastHeadlessRun: {
      status: RunHttpxCliResult["status"] | "not_started";
      exitCode: number | null;
      message: string | null;
      timeoutMs: number | null;
    } = {
      status: "not_started",
      exitCode: null,
      message: null,
      timeoutMs: null,
    };

    logWorkerEvent("headless_enrichment_started", {
      scanId: result.scanId,
      resultId: result.id,
      target: target.normalizedTarget,
      captureScreenshot: shouldCaptureScreenshot,
      screenshotTimeoutMs: DEFAULT_HEADLESS_ENRICHMENT_TIMEOUT_MS,
      runtimeTechnologyTimeoutMs: DEFAULT_HEADLESS_TECH_DETECTION_TIMEOUT_MS,
    });

    if (shouldCaptureScreenshot) {
      logWorkerEvent("screenshot_started", {
        scanId: result.scanId,
        resultId: result.id,
        target: target.normalizedTarget,
      });
    }

    const headlessTarget = getHttpxExecutionTarget(target.normalizedTarget);
    let screenshotRun: RunHttpxCliResult | null = null;

    const applyHeadlessPayload = (payload: HttpxJson, attemptTechnologies: string[], phase: "screenshot" | "runtime_technology") => {
      const payloadScreenshotPath = asString(payload.screenshot_path) ?? asString(payload.screenshot_path_rel);
      const documentObservation = extractHeadlessDocumentObservation(payload);
      const payloadTitle = (asString(payload.headless_title) ?? asString(payload.title))?.trim();
      const payloadFavicon = extractFaviconFields(payload);
      const payloadHostIp = asString(payload.host_ip);

      if (payloadScreenshotPath) {
        screenshotPath = payloadScreenshotPath;
      }

      if (documentObservation) {
        headlessDocumentObservation = documentObservation;
      }

      headlessNetworkSummary = mergeHeadlessNetworkSummary(
        headlessNetworkSummary,
        extractHeadlessNetworkSummary(payload, documentObservation?.url ?? headlessDocumentObservation?.url ?? asString(payload.url)),
      );

      if (payloadTitle) {
        headlessTitle = payloadTitle;
      }

      if (payloadHostIp) {
        headlessHostIp ??= payloadHostIp;
      }

      headlessDnsARecords = collectUniqueStrings([...headlessDnsARecords, ...asStringArray(payload.a)]);
      headlessDnsAaaaRecords = collectUniqueStrings([...headlessDnsAaaaRecords, ...asStringArray(payload.aaaa)]);
      headlessDnsResolvers = collectUniqueStrings([...headlessDnsResolvers, ...asStringArray(payload.resolvers)]);

      if (
        payloadFavicon.faviconMmh3
        || payloadFavicon.faviconMd5
        || payloadFavicon.faviconUrl
        || payloadFavicon.faviconPath
      ) {
        headlessFavicon = payloadFavicon;
      }

      attemptTechnologies.push(...asStringArray(payload.tech));

      if (phase === "runtime_technology") {
        runtimeTechnologyMetrics = extractRuntimeTechnologyDetectionMetrics(payload) ?? runtimeTechnologyMetrics;
      }
    };

    const runHeadlessPass = async ({
      args,
      timeoutMs,
      phase,
    }: {
      args: string[];
      timeoutMs: number;
      phase: "screenshot" | "runtime_technology";
    }) => {
      const attemptTechnologies: string[] = [];
      const startedAt = Date.now();
      const run = await runHttpxCli({
        command: env.HTTPX_BIN ?? "httpx",
        args,
        targets: [],
        timeoutMs,
        allowNonJsonStdout: true,
        signal,
        shouldCancel: async () => isCancellationRequested(result.scanId),
        onJsonLine: async (payload) => {
          applyHeadlessPayload(payload, attemptTechnologies, phase);
        },
      });
      const elapsedMs = Date.now() - startedAt;

      lastHeadlessRun.status = run.status;
      lastHeadlessRun.exitCode = run.exitCode;
      lastHeadlessRun.message = run.stderr || null;
      lastHeadlessRun.timeoutMs = timeoutMs;

      if (run.status === "completed") {
        completedHeadlessPassCount += 1;
        headlessTechnologies.push(...attemptTechnologies);
        if (phase === "runtime_technology") {
          runtimeTechnologyElapsedMs = elapsedMs;
          runtimeTechnologyDegraded = isRuntimeTechnologyDetectionDegraded(runtimeTechnologyMetrics);
          runtimeTechnologyMessage = runtimeTechnologyDegraded ? run.stderr || null : null;
          logWorkerEvent("headless_technology_detection_completed", {
            scanId: result.scanId,
            resultId: result.id,
            target: target.normalizedTarget,
            elapsedMs,
            timeoutMs,
            detectedTechnologyCount: collectUniqueTechnologyNames(attemptTechnologies).length,
            runtimeTechnologyMetrics,
            degraded: runtimeTechnologyDegraded,
            message: runtimeTechnologyMessage,
          });
          if (runtimeTechnologyDegraded) {
            logWorkerEvent("headless_technology_detection_degraded", {
              scanId: result.scanId,
              resultId: result.id,
              target: target.normalizedTarget,
              elapsedMs,
              timeoutMs,
              detectedTechnologyCount: collectUniqueTechnologyNames(attemptTechnologies).length,
              runtimeTechnologyMetrics,
              message: runtimeTechnologyMessage,
            });
          }
        }
      } else {
        logWorkerEvent("headless_pass_failed", {
          scanId: result.scanId,
          resultId: result.id,
          target: target.normalizedTarget,
          phase,
          status: run.status,
          exitCode: run.exitCode,
          timeoutMs,
          elapsedMs,
          message: run.stderr || null,
        });
      }

      return run;
    };

    if (shouldCaptureScreenshot) {
      for (let attemptNumber = 1; attemptNumber <= SCREENSHOT_CAPTURE_ATTEMPT_LIMIT; attemptNumber += 1) {
        const attemptDirectory = join(workingDirectory, `attempt-${attemptNumber}`);
        await mkdir(attemptDirectory, { recursive: true });

        screenshotPath = null;

        const headlessArgs = buildHttpxHeadlessEnrichmentArguments({
          captureScreenshot: true,
          storeDir: attemptDirectory,
          target: headlessTarget,
        });
        screenshotRun = await runHeadlessPass({
          args: headlessArgs,
          timeoutMs: DEFAULT_HEADLESS_ENRICHMENT_TIMEOUT_MS,
          phase: "screenshot",
        });

        screenshotPath ??= await findStoredScreenshotPath(join(attemptDirectory, "screenshot"));

        if (screenshotRun.status === "completed" && screenshotPath) {
          break;
        }

        if (screenshotRun.status === "aborted" || screenshotRun.status === "cancelled") {
          break;
        }

        if (attemptNumber < SCREENSHOT_CAPTURE_ATTEMPT_LIMIT) {
          logWorkerEvent("screenshot_retrying", {
            scanId: result.scanId,
            resultId: result.id,
            target: target.normalizedTarget,
            attemptNumber,
            reason: screenshotPath ? screenshotRun.status : "missing_screenshot_path",
            message: screenshotRun.stderr || null,
          });
        }
      }
    }

    if (!screenshotRun || (screenshotRun.status !== "aborted" && screenshotRun.status !== "cancelled")) {
      const observedNetworkSummary = headlessNetworkSummary as HeadlessNetworkSummary | null;
      runtimeTechnologyTimeoutMs = resolveHeadlessTechnologyDetectionTimeoutMs({
        configuredTimeoutMs: env.STACKRAY_HEADLESS_TECH_DETECTION_TIMEOUT_MS,
        headlessIdleMs: DEFAULT_HEADLESS_IDLE_MS,
        screenshotTimeoutMs: DEFAULT_SCREENSHOT_TIMEOUT_MS,
        screenshotProcessTimeoutMs: DEFAULT_HEADLESS_ENRICHMENT_TIMEOUT_MS,
        observedNetworkRequestCount: observedNetworkSummary?.networkRequestCount,
        observedScriptRequestCount: observedNetworkSummary?.scriptRequestCount,
        observedSameOriginScriptRequestCount: observedNetworkSummary?.sameOriginScriptRequestCount,
        observedPendingSameOriginScriptRequestCount: observedNetworkSummary?.pendingSameOriginScriptCount,
      });

      logWorkerEvent("headless_technology_detection_started", {
        scanId: result.scanId,
        resultId: result.id,
        target: target.normalizedTarget,
        timeoutMs: runtimeTechnologyTimeoutMs,
        observedNetworkSummary,
      });

      const technologyArgs = buildHttpxHeadlessEnrichmentArguments({
        captureScreenshot: false,
        target: headlessTarget,
      });

      await runHeadlessPass({
        args: technologyArgs,
        timeoutMs: runtimeTechnologyTimeoutMs,
        phase: "runtime_technology",
      });
    }

    if (completedHeadlessPassCount === 0) {
      logWorkerEvent("headless_enrichment_failed", {
        scanId: result.scanId,
        resultId: result.id,
        target: target.normalizedTarget,
        status: lastHeadlessRun.status,
        exitCode: lastHeadlessRun.exitCode,
        timeoutMs: lastHeadlessRun.status === "timed_out" ? lastHeadlessRun.timeoutMs : null,
        message: lastHeadlessRun.message,
      });
      throw new Error(lastHeadlessRun.message ?? "Headless enrichment failed before any pass completed.");
    }

    const promotedObservation = headlessDocumentObservation as HeadlessDocumentObservation | null;
    const metadataPromotion = buildHeadlessMetadataPromotion(result, promotedObservation, headlessTitle, headlessFavicon);

    if (!result.hostIp && headlessHostIp) {
      metadataPromotion.hostIp = headlessHostIp;
    }

    if ((!result.dnsARecords || result.dnsARecords.length === 0) && headlessDnsARecords.length > 0) {
      metadataPromotion.dnsARecords = headlessDnsARecords;
    }

    if ((!result.dnsAaaaRecords || result.dnsAaaaRecords.length === 0) && headlessDnsAaaaRecords.length > 0) {
      metadataPromotion.dnsAaaaRecords = headlessDnsAaaaRecords;
    }

    if ((!result.dnsResolvers || result.dnsResolvers.length === 0) && headlessDnsResolvers.length > 0) {
      metadataPromotion.dnsResolvers = headlessDnsResolvers;
    }

    if (Object.keys(metadataPromotion).length > 0) {
      const [promotedResult] = await db.update(scanResults).set(metadataPromotion).where(eq(scanResults.id, result.id)).returning();
      updatedResult = promotedResult ?? null;
    }

    if (metadataPromotion.statusCode !== undefined) {
      logWorkerEvent("headless_document_status_promoted", {
        scanId: result.scanId,
        resultId: result.id,
        target: target.normalizedTarget,
        previousStatusCode: result.statusCode,
        statusCode: metadataPromotion.statusCode,
        finalUrl: metadataPromotion.finalUrl ?? null,
      });
    }

    if (metadataPromotion.title !== undefined) {
      logWorkerEvent("headless_title_promoted", {
        scanId: result.scanId,
        resultId: result.id,
        target: target.normalizedTarget,
        previousTitle: result.title,
        title: metadataPromotion.title,
      });
    }

    if (
      metadataPromotion.faviconMmh3 !== undefined
      || metadataPromotion.faviconMd5 !== undefined
      || metadataPromotion.faviconUrl !== undefined
      || metadataPromotion.faviconPath !== undefined
    ) {
      logWorkerEvent("headless_favicon_promoted", {
        scanId: result.scanId,
        resultId: result.id,
        target: target.normalizedTarget,
        faviconMmh3: metadataPromotion.faviconMmh3 ?? null,
        faviconMd5: metadataPromotion.faviconMd5 ?? null,
        faviconUrl: metadataPromotion.faviconUrl ?? null,
        faviconPath: metadataPromotion.faviconPath ?? null,
      });
    }

    if (shouldCaptureScreenshot && !screenshotPath) {
      logWorkerEvent("screenshot_failed", {
        scanId: result.scanId,
        resultId: result.id,
        target: target.normalizedTarget,
        reason: "missing_screenshot_path",
        message: screenshotRun?.stderr || null,
      });
    }

    if (shouldCaptureScreenshot && screenshotPath) {
      const resolvedScreenshotPath = isAbsolute(screenshotPath) ? screenshotPath : join(workingDirectory, screenshotPath);

      const objectKey = buildScreenshotObjectKey(result.scanId, result.id);
      try {
        const screenshotFile = await stat(resolvedScreenshotPath);
        if (screenshotFile.size <= 0) {
          logWorkerEvent("screenshot_failed", {
            scanId: result.scanId,
            resultId: result.id,
            target: target.normalizedTarget,
            reason: "empty_screenshot_file",
            message: "Screenshot file was empty.",
          });
        } else {
          const upload = await uploadScreenshotObject(resolvedScreenshotPath, objectKey);

          const [uploadedResult] = await db
            .update(scanResults)
            .set({
              screenshotObjectKey: objectKey,
              screenshotContentType: upload.contentType,
              screenshotByteSize: upload.byteSize,
              screenshotCapturedAt: new Date(),
            })
            .where(eq(scanResults.id, result.id))
            .returning();
          updatedResult = uploadedResult ?? null;

          logWorkerEvent("screenshot_completed", {
            scanId: result.scanId,
            resultId: result.id,
            target: target.normalizedTarget,
            objectKey,
            byteSize: upload.byteSize,
          });
        }
      } catch (error) {
        logWorkerEvent("screenshot_failed", {
          scanId: result.scanId,
          resultId: result.id,
          target: target.normalizedTarget,
          reason: "upload_failed",
          message: error instanceof Error ? error.message : "Failed to upload screenshot.",
        });
      }
    }

    const headlessEvidence = buildHeadlessEnrichmentEvidence({
      title: headlessTitle,
      documentObservation: headlessDocumentObservation,
      networkSummary: headlessNetworkSummary,
      technologies: headlessTechnologies,
      completedPassCount: completedHeadlessPassCount,
      runtimeTechnologyDegraded,
    });
    updatedResult = await persistResultRawJsonPatch(updatedResult ?? result, {
      headless_enrichment: headlessEvidence,
    });

    const screenshotTechnologyRows = await mergeScreenshotTechnologies(result.id, headlessTechnologies);

    if (screenshotTechnologyRows.length > 0 || updatedResult) {
      await updateResultSearchDocument(updatedResult ?? result, []);
    }

    if (updatedResult) {
      await emitResultEventForRow(updatedResult, target);
    }

    logWorkerEvent("headless_enrichment_completed", {
      scanId: result.scanId,
      resultId: result.id,
      target: target.normalizedTarget,
      captureScreenshot: shouldCaptureScreenshot,
      completedPassCount: completedHeadlessPassCount,
      detectedTechnologyCount: collectUniqueTechnologyNames(headlessTechnologies).length,
      newTechnologyCount: screenshotTechnologyRows.length,
      runtimeTechnologyElapsedMs,
      runtimeTechnologyTimeoutMs,
      runtimeTechnologyMetrics,
      runtimeTechnologyDegraded,
      runtimeTechnologyMessage,
      observedNetworkSummary: headlessNetworkSummary,
    });

    return updatedResult ?? result;
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

export const DEFAULT_HEADLESS_TECH_DETECTION_TIMEOUT_MS = resolveHeadlessTechnologyDetectionTimeoutMs({
  configuredTimeoutMs: env.STACKRAY_HEADLESS_TECH_DETECTION_TIMEOUT_MS,
  headlessIdleMs: DEFAULT_HEADLESS_IDLE_MS,
  screenshotTimeoutMs: DEFAULT_SCREENSHOT_TIMEOUT_MS,
  screenshotProcessTimeoutMs: DEFAULT_HEADLESS_ENRICHMENT_TIMEOUT_MS,
});

export {
  DEFAULT_HEADLESS_ENRICHMENT_TIMEOUT_MS,
  DEFAULT_HEADLESS_IDLE_MS,
  DEFAULT_SCREENSHOT_TIMEOUT_MS,
};
