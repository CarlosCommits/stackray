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
  CUSTOM_WAPPALYZER_FINGERPRINTS_PATH,
  getHttpxExecutionTarget,
  type HttpxJson,
  runHttpxCli,
} from "./httpx.ts";
import { extractFaviconFields, type FaviconFields } from "./httpx-results.ts";
import {
  resolveHeadlessTechnologyDetectionTimeoutMs,
  extractHeadlessDocumentObservation,
  extractHeadlessNetworkSummary,
  type HeadlessDocumentObservation,
  type HeadlessMetadataPromotion,
  type HeadlessNetworkSummary,
} from "./headless-enrichment.ts";
import { emitResultEventForRow } from "./result-events.ts";
import { collectUniqueTechnologyNames, toObject } from "./result-detections.ts";
import {
  mergeScreenshotTechnologies,
  persistResultRawJsonPatch,
  updateResultSearchDocument,
} from "./result-persistence.ts";

type ScanRow = typeof scans.$inferSelect;
type ScanResultRow = typeof scanResults.$inferSelect;

export type BrowserFallbackProvider = "akamai" | "cloudflare" | "datadome" | "perimeterx" | "forter" | "unknown";

export type BrowserFallbackDecision = {
  shouldRun: boolean;
  confidence: "none" | "suspected" | "confirmed" | "recovery";
  provider?: BrowserFallbackProvider;
  reason: string;
  signals: string[];
};

export type BrowserFallbackDecisionOptions = {
  headlessFailed?: boolean;
  headlessScreenshotMissing?: boolean;
};

export type BrowserFallbackPhaseMeta = {
  decision: BrowserFallbackDecision;
  triggerOptions: BrowserFallbackDecisionOptions;
  outcome?: BrowserFallbackOutcome;
  recovered?: boolean;
};

export type BrowserFallbackOutcome = "recovered" | "confirmed_block" | "no_recovery" | "disabled";

export type BrowserFallbackEnrichmentOptions = {
  signal?: AbortSignal;
  isCancellationRequested: (scanId: string) => Promise<boolean>;
};

type HeadlessEnrichmentEvidence = {
  title: string | null;
  documentObservation: HeadlessDocumentObservation | null;
  networkSummary: HeadlessNetworkSummary | null;
  technologies: string[];
  completedPassCount: number;
  runtimeTechnologyDegraded: boolean;
};

const BLOCKED_HTTP_STATUS_CODES = new Set([403, 429]);
const DEFAULT_BROWSER_FALLBACK_ENABLED = env.STACKRAY_BROWSER_FALLBACK_ENABLED !== "false";
export const DEFAULT_BROWSER_FALLBACK_TIMEOUT_MS = env.STACKRAY_BROWSER_FALLBACK_TIMEOUT_MS ?? 90 * 1000;
export const DEFAULT_BROWSER_FALLBACK_SETTLE_TIMEOUT_MS = env.STACKRAY_BROWSER_FALLBACK_SETTLE_TIMEOUT_MS ?? 40 * 1000;
export const DEFAULT_BROWSER_FALLBACK_IDLE_MS = env.STACKRAY_BROWSER_FALLBACK_IDLE_MS ?? 3 * 1000;
export const DEFAULT_BROWSER_FALLBACK_CHROME_BIN = env.STACKRAY_BROWSER_FALLBACK_CHROME_BIN ?? "/usr/bin/google-chrome";

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

function getHeadlessEnrichmentEvidence(result: ScanResultRow): HeadlessEnrichmentEvidence | null {
  const raw = toObject(result.rawJson);
  const evidence = toObject(raw.headless_enrichment);

  if (Object.keys(evidence).length === 0) {
    return null;
  }

  const observation = toObject(evidence.documentObservation);
  const networkSummary = toObject(evidence.networkSummary);

  return {
    title: asString(evidence.title),
    documentObservation: Object.keys(observation).length > 0
      ? {
        url: asString(observation.url),
        statusCode: asNumber(observation.statusCode),
      }
      : null,
    networkSummary: Object.keys(networkSummary).length > 0
      ? {
        networkRequestCount: asNumber(networkSummary.networkRequestCount) ?? 0,
        scriptRequestCount: asNumber(networkSummary.scriptRequestCount) ?? 0,
        sameOriginScriptRequestCount: asNumber(networkSummary.sameOriginScriptRequestCount) ?? 0,
        pendingSameOriginScriptCount: asNumber(networkSummary.pendingSameOriginScriptCount) ?? 0,
      }
      : null,
    technologies: asStringArray(evidence.technologies),
    completedPassCount: asNumber(evidence.completedPassCount) ?? 0,
    runtimeTechnologyDegraded: asBoolean(evidence.runtimeTechnologyDegraded),
  };
}

export function resolveBrowserFallbackProcessTimeoutMs({
  fallbackTimeoutMs,
  fallbackSettleTimeoutMs,
  fallbackIdleMs,
  observedNetworkRequestCount,
  observedScriptRequestCount,
  observedSameOriginScriptRequestCount,
  observedPendingSameOriginScriptRequestCount,
}: {
  fallbackTimeoutMs: number;
  fallbackSettleTimeoutMs: number;
  fallbackIdleMs: number;
  observedNetworkRequestCount?: number | null;
  observedScriptRequestCount?: number | null;
  observedSameOriginScriptRequestCount?: number | null;
  observedPendingSameOriginScriptRequestCount?: number | null;
}) {
  const realChromeRecoveryTimeoutMs = fallbackSettleTimeoutMs + fallbackTimeoutMs + 10_000;
  const runtimeTechnologyTimeoutMs = resolveHeadlessTechnologyDetectionTimeoutMs({
    headlessIdleMs: fallbackIdleMs,
    screenshotTimeoutMs: fallbackTimeoutMs,
    screenshotProcessTimeoutMs: realChromeRecoveryTimeoutMs,
    observedNetworkRequestCount,
    observedScriptRequestCount,
    observedSameOriginScriptRequestCount,
    observedPendingSameOriginScriptRequestCount,
  });

  return Math.max(
    runtimeTechnologyTimeoutMs,
    realChromeRecoveryTimeoutMs + fallbackIdleMs + 15_000,
  );
}

export function buildHttpxBrowserFallbackArguments({
  captureScreenshot,
  storeDir,
  target,
}: {
  captureScreenshot: boolean;
  storeDir?: string;
  target: string;
}) {
  const args = [
    "-silent",
    "-json",
    "-tdh",
    "-title",
    "-favicon",
    "-cff",
    CUSTOM_WAPPALYZER_FINGERPRINTS_PATH,
    "-st",
    String(Math.ceil(DEFAULT_BROWSER_FALLBACK_TIMEOUT_MS / 1000)),
    "-sid",
    String(Math.ceil(DEFAULT_BROWSER_FALLBACK_IDLE_MS / 1000)),
    "-browser-recovery",
    "real-chrome",
    "-chrome-bin",
    DEFAULT_BROWSER_FALLBACK_CHROME_BIN,
    "-chrome-settle-timeout",
    `${Math.ceil(DEFAULT_BROWSER_FALLBACK_SETTLE_TIMEOUT_MS / 1000)}s`,
    "-u",
    target,
  ];

  if (captureScreenshot) {
    if (!storeDir) {
      throw new Error("storeDir is required when browser fallback screenshot capture is enabled.");
    }

    args.push(
      "-screenshot",
      "-esb",
      "-no-screenshot-full-page",
      "-srd",
      storeDir,
    );
  }

  return args;
}

function pushSignal(signals: string[], signal: string, condition: boolean) {
  if (condition && !signals.includes(signal)) {
    signals.push(signal);
  }
}

function collectFallbackEvidenceText(result: ScanResultRow, headlessEvidence: HeadlessEnrichmentEvidence | null) {
  const raw = toObject(result.rawJson);
  const chunks = [
    result.title,
    result.webServer,
    result.cdnName,
    result.cdnType,
    result.bodyPreview,
    result.rawHeaders,
    headlessEvidence?.title,
    ...asStringArray(raw.tech),
    ...asStringArray(raw.webtech),
    ...asStringArray(raw.technologies),
    ...asStringArray(headlessEvidence?.technologies),
  ];

  const responseHeaders = toObject(result.responseHeadersJson);
  for (const [key, value] of Object.entries(responseHeaders)) {
    chunks.push(key, typeof value === "string" ? value : JSON.stringify(value));
  }

  return chunks.filter((entry): entry is string => typeof entry === "string" && entry.length > 0).join("\n").toLowerCase();
}

function isAccessDeniedTitle(title: string | null) {
  const normalized = title?.trim().toLowerCase() ?? "";
  return normalized === "access denied" || normalized === "forbidden" || normalized.includes("just a moment");
}

function isBlockedDocumentStatus(statusCode: number | null) {
  return statusCode !== null && BLOCKED_HTTP_STATUS_CODES.has(statusCode);
}

function isNoJsonHttpProbePlaceholder(result: ScanResultRow) {
  const raw = toObject(result.rawJson);
  const probe = toObject(raw.stackray_http_probe);

  return raw.stackray_result_kind === "http_probe_no_output" || probe.reason === "no_json_output";
}

function hasRecoveredBrowserDocument(result: ScanResultRow, headlessEvidence: HeadlessEnrichmentEvidence | null) {
  const resultTitle = result.title?.trim() ?? "";
  const headlessTitle = headlessEvidence?.title?.trim() ?? "";
  const headlessStatusCode = headlessEvidence?.documentObservation?.statusCode ?? null;

  return (
    result.statusCode !== null
    && result.statusCode >= 200
    && result.statusCode < 400
    && resultTitle.length > 0
    && !isAccessDeniedTitle(resultTitle)
  ) || (
    headlessStatusCode !== null
    && headlessStatusCode >= 200
    && headlessStatusCode < 400
    && headlessTitle.length > 0
    && !isAccessDeniedTitle(headlessTitle)
  );
}

export function buildBrowserFallbackDecision(
  result: ScanResultRow,
  options: BrowserFallbackDecisionOptions = {},
): BrowserFallbackDecision {
  if (!DEFAULT_BROWSER_FALLBACK_ENABLED) {
    return {
      shouldRun: false,
      confidence: "none",
      reason: "disabled",
      signals: [],
    };
  }

  const headlessEvidence = getHeadlessEnrichmentEvidence(result);
  const evidenceText = collectFallbackEvidenceText(result, headlessEvidence);
  const signals: string[] = [];
  const recoveredBrowserDocument = hasRecoveredBrowserDocument(result, headlessEvidence);
  const unrecoveredNoJsonProbe = isNoJsonHttpProbePlaceholder(result) && !recoveredBrowserDocument;

  if (options.headlessFailed) {
    return {
      shouldRun: true,
      confidence: "recovery",
      reason: "headless_enrichment_failed",
      signals: ["headless_enrichment_failed"],
    };
  }

  if (options.headlessScreenshotMissing) {
    return {
      shouldRun: true,
      confidence: "recovery",
      reason: "headless_screenshot_missing",
      signals: ["headless_screenshot_missing"],
    };
  }

  if (recoveredBrowserDocument) {
    return {
      shouldRun: false,
      confidence: "none",
      reason: "block_not_confirmed",
      signals,
    };
  }

  pushSignal(signals, "http_status_blocked", isBlockedDocumentStatus(result.statusCode));
  pushSignal(signals, "headless_document_status_blocked", isBlockedDocumentStatus(headlessEvidence?.documentObservation?.statusCode ?? null));
  pushSignal(signals, "http_probe_no_json", unrecoveredNoJsonProbe);
  pushSignal(signals, "access_denied_title", isAccessDeniedTitle(result.title) || isAccessDeniedTitle(headlessEvidence?.title ?? null));
  pushSignal(signals, "blocked_body_text", /\b(access denied|request blocked|forbidden|just a moment)\b/i.test(evidenceText));
  pushSignal(signals, "akamai_ghost", evidenceText.includes("akamaighost"));
  pushSignal(signals, "errors_edgesuite", evidenceText.includes("errors.edgesuite.net"));
  pushSignal(signals, "akamai_bot_manager", evidenceText.includes("akamai bot manager") || /\b(_abck|ak_bmsc|bm_s|bm_so|bm_ss|bm_sz|bm_sv)\b/i.test(evidenceText));
  pushSignal(signals, "cloudflare_challenge", evidenceText.includes("cf-ray") || evidenceText.includes("__cf_bm") || evidenceText.includes("cf-chl-"));
  pushSignal(signals, "kasada_challenge", evidenceText.includes("kasada") || evidenceText.includes("x-kpsdk-") || evidenceText.includes("kp_uidz"));
  pushSignal(signals, "datadome", evidenceText.includes("datadome"));
  pushSignal(signals, "perimeterx", evidenceText.includes("perimeterx") || evidenceText.includes("px-captcha") || evidenceText.includes("_px"));
  pushSignal(signals, "forter", evidenceText.includes("fortertoken") || evidenceText.includes("forter"));

  const provider: BrowserFallbackProvider | undefined = signals.some((signal) => signal.startsWith("akamai") || signal === "errors_edgesuite")
    ? "akamai"
    : signals.includes("cloudflare_challenge")
      ? "cloudflare"
    : signals.includes("kasada_challenge")
      ? "unknown"
    : signals.includes("datadome")
      ? "datadome"
    : signals.includes("perimeterx")
      ? "perimeterx"
    : signals.includes("forter")
      ? "forter"
    : undefined;

  const hasBlockedStatus = signals.includes("http_status_blocked") || signals.includes("headless_document_status_blocked");
  const hasBlockedPageText = signals.includes("access_denied_title") || signals.includes("blocked_body_text");
  const hasProviderSignal = provider !== undefined;
  const hasProviderBackedAccessDeniedTitle = signals.includes("access_denied_title") && hasProviderSignal;
  const confidence: BrowserFallbackDecision["confidence"] = (hasBlockedStatus && (hasProviderSignal || hasBlockedPageText))
    || hasProviderBackedAccessDeniedTitle
    ? "confirmed"
    : unrecoveredNoJsonProbe
      ? "confirmed"
    : hasBlockedStatus || hasBlockedPageText || hasProviderSignal
      ? "suspected"
    : "none";

  return {
    shouldRun: confidence === "confirmed",
    confidence,
    provider,
    reason: confidence === "confirmed"
      ? unrecoveredNoJsonProbe
        ? "http_probe_no_json_confirmed"
        : `${provider ?? "unknown"}_block_confirmed`
      : confidence === "suspected"
        ? "block_suspected"
      : "block_not_confirmed",
    signals,
  };
}

export function isRecoveredBrowserFallbackDocument(
  observation: HeadlessDocumentObservation | null,
  title: string | null,
) {
  const statusCode = observation?.statusCode ?? null;
  const normalizedTitle = title?.trim() ?? "";

  return statusCode !== null
    && statusCode >= 200
    && statusCode < 400
    && normalizedTitle.length > 0
    && !isAccessDeniedTitle(normalizedTitle);
}

export function getBrowserFallbackTarget(result: ScanResultRow, target: Pick<ScanRow, "normalizedTarget">) {
  const selectedTarget = result.url ?? target.normalizedTarget ?? result.finalUrl;
  const executionTarget = getHttpxExecutionTarget(selectedTarget);

  try {
    const url = new URL(executionTarget);
    if (url.protocol === "http:") {
      url.protocol = "https:";
      return url.toString();
    }
  } catch {
    return executionTarget;
  }

  return executionTarget;
}

export function buildBrowserFallbackPhaseMeta(
  decision: BrowserFallbackDecision,
  triggerOptions: BrowserFallbackDecisionOptions,
  extraMeta: Partial<BrowserFallbackPhaseMeta> = {},
): BrowserFallbackPhaseMeta {
  return {
    ...extraMeta,
    decision,
    triggerOptions: {
      headlessFailed: triggerOptions.headlessFailed === true,
      headlessScreenshotMissing: triggerOptions.headlessScreenshotMissing === true,
    },
  };
}

export function buildBrowserFallbackDecisionOptionsFromMeta(metaJson: unknown): BrowserFallbackDecisionOptions {
  const meta = toObject(metaJson);
  const triggerOptions = toObject(meta?.triggerOptions);

  return {
    headlessFailed: triggerOptions?.headlessFailed === true,
    headlessScreenshotMissing: triggerOptions?.headlessScreenshotMissing === true,
  };
}

function logWorkerEvent(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      component: "httpx-worker",
      event,
      ...payload,
    }),
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function buildBrowserFallbackCommand(args: string[]) {
  const httpxBin = env.HTTPX_BIN ?? "httpx";

  return {
    command: env.STACKRAY_BROWSER_FALLBACK_XVFB_BIN ?? "xvfb-run",
    args: ["-a", httpxBin, ...args],
  };
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

let browserFallbackTail: Promise<void> = Promise.resolve();

async function withBrowserFallbackSlot<T>(fn: () => Promise<T>): Promise<T> {
  const previous = browserFallbackTail.catch(() => undefined);
  let releaseSlot: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    releaseSlot = resolve;
  });

  browserFallbackTail = previous.then(() => current);
  await previous;

  try {
    return await fn();
  } finally {
    releaseSlot();
  }
}

export async function enrichResultWithBrowserFallback(
  result: ScanResultRow,
  target: Pick<ScanRow, "normalizedTarget">,
  decision: BrowserFallbackDecision,
  options: BrowserFallbackEnrichmentOptions,
) {
  const { signal, isCancellationRequested } = options;

  return withBrowserFallbackSlot(async () => {
    const canStoreScreenshot = screenshotStorageEnabled();
    const targetUrl = getBrowserFallbackTarget(result, target);
    const workingDirectory = await mkdtemp(join(tmpdir(), "stackray-browser-fallback-"));
    const screenshotDirectory = join(workingDirectory, "screenshot");
    await mkdir(screenshotDirectory, { recursive: true });

    let fallbackPayload: HttpxJson | null = null;
    let fallbackTechnologies: string[] = [];
    let fallbackObservation: HeadlessDocumentObservation | null = null;
    let fallbackNetworkSummary: HeadlessNetworkSummary | null = null;
    let fallbackTitle: string | null = null;
    let fallbackFavicon: FaviconFields = {
      faviconMmh3: null,
      faviconMd5: null,
      faviconUrl: null,
      faviconPath: null,
    };
    let screenshotPath: string | null = null;
    let updatedResult: ScanResultRow | null = null;
    const observedHeadlessNetworkSummary = getHeadlessEnrichmentEvidence(result)?.networkSummary ?? null;
    const fallbackProcessTimeoutMs = resolveBrowserFallbackProcessTimeoutMs({
      fallbackTimeoutMs: DEFAULT_BROWSER_FALLBACK_TIMEOUT_MS,
      fallbackSettleTimeoutMs: DEFAULT_BROWSER_FALLBACK_SETTLE_TIMEOUT_MS,
      fallbackIdleMs: DEFAULT_BROWSER_FALLBACK_IDLE_MS,
      observedNetworkRequestCount: observedHeadlessNetworkSummary?.networkRequestCount,
      observedScriptRequestCount: observedHeadlessNetworkSummary?.scriptRequestCount,
      observedSameOriginScriptRequestCount: observedHeadlessNetworkSummary?.sameOriginScriptRequestCount,
      observedPendingSameOriginScriptRequestCount: observedHeadlessNetworkSummary?.pendingSameOriginScriptCount,
    });

    try {
      logWorkerEvent("browser_fallback_started", {
        scanId: result.scanId,
        resultId: result.id,
        target: target.normalizedTarget,
        mode: "real-chrome",
        provider: "real_chrome_xvfb",
        timeoutMs: DEFAULT_BROWSER_FALLBACK_TIMEOUT_MS,
        processTimeoutMs: fallbackProcessTimeoutMs,
        settleTimeoutMs: DEFAULT_BROWSER_FALLBACK_SETTLE_TIMEOUT_MS,
        idleMs: DEFAULT_BROWSER_FALLBACK_IDLE_MS,
        chromeBin: DEFAULT_BROWSER_FALLBACK_CHROME_BIN,
        decision,
        observedHeadlessNetworkSummary,
      });

      const applyFallbackPayload = (payload: HttpxJson) => {
        fallbackPayload = payload;
        fallbackTechnologies = collectUniqueTechnologyNames([
          ...fallbackTechnologies,
          ...asStringArray(payload.tech),
        ]);
        const observation = extractHeadlessDocumentObservation(payload);
        fallbackObservation = observation ?? fallbackObservation;
        fallbackNetworkSummary = mergeHeadlessNetworkSummary(
          fallbackNetworkSummary,
          extractHeadlessNetworkSummary(payload, observation?.url ?? fallbackObservation?.url ?? asString(payload.url)),
        );
        fallbackTitle = (asString(payload.headless_title) ?? asString(payload.title))?.trim() ?? fallbackTitle;
        const payloadFavicon = extractFaviconFields(payload);
        if (
          payloadFavicon.faviconMmh3
          || payloadFavicon.faviconMd5
          || payloadFavicon.faviconUrl
          || payloadFavicon.faviconPath
        ) {
          fallbackFavicon = payloadFavicon;
        }
        screenshotPath = asString(payload.screenshot_path) ?? asString(payload.screenshot_path_rel) ?? screenshotPath;
      };
      const runBrowserFallbackPass = async (args: string[]) => {
        const command = buildBrowserFallbackCommand(args);
        return runHttpxCli({
          command: command.command,
          args: command.args,
          targets: [],
          timeoutMs: fallbackProcessTimeoutMs,
          allowNonJsonStdout: true,
          signal,
          shouldCancel: async () => isCancellationRequested(result.scanId),
          onJsonLine: async (payload) => {
            applyFallbackPayload(payload);
          },
        });
      };

      const startedAt = Date.now();
      const fallbackArgs = buildHttpxBrowserFallbackArguments({
        captureScreenshot: canStoreScreenshot,
        storeDir: canStoreScreenshot ? screenshotDirectory : undefined,
        target: targetUrl,
      });
      const run = await runBrowserFallbackPass(fallbackArgs);
      const elapsedMs = Date.now() - startedAt;

      screenshotPath ??= await findStoredScreenshotPath(screenshotDirectory);
      const observedFallbackPayload: HttpxJson = (fallbackPayload as unknown as HttpxJson | null) ?? {};
      const observedFallbackObservation = fallbackObservation as unknown as HeadlessDocumentObservation | null;
      const recovered = run.status === "completed" && isRecoveredBrowserFallbackDocument(observedFallbackObservation, fallbackTitle);
      const outcome: BrowserFallbackOutcome = recovered
        ? "recovered"
        : run.status === "completed"
          ? "confirmed_block"
          : "no_recovery";

      if (recovered) {
        const metadataPromotion: HeadlessMetadataPromotion = {
          statusCode: observedFallbackObservation?.statusCode ?? undefined,
          finalUrl: observedFallbackObservation?.url ?? undefined,
          title: fallbackTitle ?? undefined,
        };

        if (!result.faviconMmh3 && fallbackFavicon.faviconMmh3) {
          metadataPromotion.faviconMmh3 = fallbackFavicon.faviconMmh3;
        }
        if (!result.faviconMd5 && fallbackFavicon.faviconMd5) {
          metadataPromotion.faviconMd5 = fallbackFavicon.faviconMd5;
        }
        if (!result.faviconUrl && fallbackFavicon.faviconUrl) {
          metadataPromotion.faviconUrl = fallbackFavicon.faviconUrl;
        }
        if (!result.faviconPath && fallbackFavicon.faviconPath) {
          metadataPromotion.faviconPath = fallbackFavicon.faviconPath;
        }

        const [promotedResult] = await db
          .update(scanResults)
          .set(metadataPromotion)
          .where(eq(scanResults.id, result.id))
          .returning();
        updatedResult = promotedResult ?? null;
      }

      if (screenshotPath && canStoreScreenshot) {
        const resolvedScreenshotPath = isAbsolute(screenshotPath) ? screenshotPath : join(workingDirectory, screenshotPath);
        const objectKey = buildScreenshotObjectKey(result.scanId, result.id);

        try {
          const screenshotFile = await stat(resolvedScreenshotPath);
          if (screenshotFile.size > 0) {
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
            updatedResult = uploadedResult ?? updatedResult;
          }
        } catch (error) {
          logWorkerEvent("browser_fallback_screenshot_failed", {
            scanId: result.scanId,
            resultId: result.id,
            target: target.normalizedTarget,
            message: getErrorMessage(error),
          });
        }
      }

      const rawPatch = {
        browser_fallback: {
          attempted: true,
          mode: "real-chrome",
          provider: "real_chrome_xvfb",
          decision,
          outcome,
          result: {
            recovered,
            final_url: observedFallbackObservation?.url ?? asString(observedFallbackPayload.final_url) ?? asString(observedFallbackPayload.url),
            status_code: observedFallbackObservation?.statusCode ?? asNumber(observedFallbackPayload.status_code),
            title: fallbackTitle,
            browser_mode: asString(observedFallbackPayload.browser_mode) ?? "real-chrome",
            technologies: fallbackTechnologies.slice(0, 100),
            network_summary: fallbackNetworkSummary,
            screenshot_captured: Boolean(screenshotPath),
          },
          run: {
            status: run.status,
            exit_code: run.exitCode,
            elapsed_ms: elapsedMs,
            timeout_ms: fallbackProcessTimeoutMs,
            settle_timeout_ms: DEFAULT_BROWSER_FALLBACK_SETTLE_TIMEOUT_MS,
            message: run.stderr || null,
          },
        },
      };
      updatedResult = await persistResultRawJsonPatch(updatedResult ?? result, rawPatch);

      const newTechnologyRows = await mergeScreenshotTechnologies(result.id, fallbackTechnologies);
      if (newTechnologyRows.length > 0 || updatedResult) {
        await updateResultSearchDocument(updatedResult, []);
      }
      await emitResultEventForRow(updatedResult, target);

      logWorkerEvent("browser_fallback_completed", {
        scanId: result.scanId,
        resultId: result.id,
        target: target.normalizedTarget,
        outcome,
        recovered,
        elapsedMs,
        status: run.status,
        exitCode: run.exitCode,
        observedStatusCode: observedFallbackObservation?.statusCode ?? null,
        title: fallbackTitle,
        detectedTechnologyCount: fallbackTechnologies.length,
      });

      return {
        result: updatedResult,
        outcome,
        recovered,
        run,
      };
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });
}

export { getHeadlessEnrichmentEvidence };
