import { spawn } from "node:child_process";
import type { Dirent } from "node:fs";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, isAbsolute, join } from "node:path";
import { createInterface } from "node:readline";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDomain } from "tldts";

import {
  scanAttempts,
  scanEvents,
  scanResultDetections,
  scanResultNucleiMatches,
  scanResultNucleiRuns,
  scanResults,
  scans,
} from "../drizzle/schema.ts";
import { db } from "./db.ts";
import { env } from "../lib/env/server.ts";
import { buildScreenshotObjectKey, screenshotStorageEnabled, uploadScreenshotObject } from "../lib/server/storage/screenshots.ts";
import { buildEnrichedTechnologies, promoteTechnologiesFromCpe } from "../lib/server/scans/technology-enrichment.ts";
import { canonicalizeTechnologyLabel } from "../lib/server/scans/technology-metadata-catalog.ts";
import { getExecutionTarget } from "../lib/server/scans/normalize-targets.ts";
import {
  rankAuthoritativeScanResults,
  type RankedAuthoritativeScanResult,
} from "../lib/server/scans/result-selection.ts";
import {
  buildNucleiArguments,
  NUCLEI_DOMAIN_TEMPLATE_IDS,
  NUCLEI_RDAP_TEMPLATE_IDS,
  NUCLEI_TEMPLATE_ALLOWLIST,
  NUCLEI_TXT_SERVICE_TEMPLATE_IDS,
  NUCLEI_URL_TEMPLATE_IDS,
  type NucleiExecutionSubjectType,
  parseNucleiJsonLine,
  runNucleiCli,
  withNucleiMatchExecutionContext,
} from "./nuclei.ts";

type ScanRow = typeof scans.$inferSelect;
type AttemptRow = typeof scanAttempts.$inferSelect;
type ScanResultRow = typeof scanResults.$inferSelect;
type DetectionInsert = typeof scanResultDetections.$inferInsert;
type NucleiRunStatus = typeof scanResultNucleiRuns.$inferInsert.status;
type HttpxRequestProfile = "baseline" | "browser_headers" | "tlsi_final_url";

type ClaimedScan = {
  scan: ScanRow;
  attempt: AttemptRow;
  target: Pick<ScanRow, "inputTarget" | "normalizedTarget" | "canonicalTargetId">;
};

function getWorkerId() {
  return `graphile-worker:${process.pid}`;
}

type HttpxJson = Record<string, unknown>;

type HttpxProcess = {
  stdin: Pick<NodeJS.WritableStream, "write" | "end">;
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  kill(signal?: NodeJS.Signals | number): boolean;
  on(event: "error", listener: (error: Error) => void): HttpxProcess;
  on(event: "close", listener: (code: number | null) => void): HttpxProcess;
  killed?: boolean;
};

type HttpxSpawn = (
  command: string,
  args: readonly string[],
  options: { stdio: ["pipe", "pipe", "pipe"] },
) => HttpxProcess;

type RunHttpxCliResult = {
  status: "completed" | "failed" | "cancelled" | "timed_out" | "aborted";
  exitCode: number;
  stderr: string;
};

type RunHttpxCliOptions = {
  command: string;
  args: readonly string[];
  targets: readonly string[];
  timeoutMs: number;
  onJsonLine: (payload: HttpxJson) => Promise<void> | void;
  allowNonJsonStdout?: boolean;
  shouldCancel?: () => boolean | Promise<boolean>;
  cancellationPollIntervalMs?: number;
  signal?: AbortSignal;
  spawnProcess?: HttpxSpawn;
};

type HttpxBehaviorOptions = {
  browserLikeHeaders: boolean;
  tlsImpersonate: boolean;
  followRedirects: boolean | null;
};

type AttemptMeta = {
  requestProfile: HttpxRequestProfile;
  fallbackReason: string | null;
  resultCount: number;
  forbiddenResultCount: number;
};

type NucleiTargetSelection = {
  targetUrl: string | null;
  targetHost: string | null;
  originalDomainTarget: string | null;
  finalDomainTarget: string | null;
  domainTarget: string | null;
};

type NucleiExecutionPhase = {
  subject: string;
  subjectType: NucleiExecutionSubjectType;
  templateIds: readonly string[];
  templatePaths?: readonly string[];
  includeTags?: readonly string[];
  disableRedirects?: boolean;
};

type AttemptResultSelectionRow = Pick<
  ScanResultRow,
  "id" | "input" | "url" | "finalUrl" | "statusCode" | "observedAt"
>;

type AttemptResultSummary = {
  resultCount: number;
  forbiddenResultCount: number;
  candidateResults: RankedAuthoritativeScanResult<AttemptResultSelectionRow>[];
  authoritativeResult: RankedAuthoritativeScanResult<AttemptResultSelectionRow> | null;
  authoritativeResultId: string | null;
  authoritativeResultStatusCode: number | null;
  authoritativeRetryUrl: string | null;
};

type AttemptFallbackDecision = {
  shouldFallback: boolean;
  nextProfile: HttpxRequestProfile | null;
  retryUrl: string | null;
  reason: "authoritative_result_blocked" | "authoritative_result_not_blocked" | "authoritative_result_missing" | "fallback_exhausted";
};

const DEFAULT_SCAN_TIMEOUT_MS = env.STACKRAY_HTTPX_TIMEOUT_MS ?? 15 * 60 * 1000;
const DEFAULT_NUCLEI_TIMEOUT_MS = env.STACKRAY_NUCLEI_TIMEOUT_MS ?? 2 * 60 * 1000;
const DEFAULT_SCREENSHOT_TIMEOUT_MS = env.STACKRAY_SCREENSHOT_TIMEOUT_MS ?? 30 * 1000;
const DEFAULT_HEADLESS_ENRICHMENT_TIMEOUT_MS =
  env.STACKRAY_HEADLESS_ENRICHMENT_TIMEOUT_MS ?? Math.max(45 * 1000, DEFAULT_SCREENSHOT_TIMEOUT_MS + 30 * 1000);
const DEFAULT_HEADLESS_IDLE_MS = env.STACKRAY_HEADLESS_IDLE_MS ?? 10 * 1000;
const SCREENSHOT_CAPTURE_ATTEMPT_LIMIT = 2;
const DEFAULT_CANCELLATION_POLL_INTERVAL_MS = 500;
const PROCESS_KILL_GRACE_PERIOD_MS = 1_000;
const CUSTOM_WAPPALYZER_FINGERPRINTS_PATH = join(process.cwd(), "lib", "server", "scans", "custom-wappalyzer-fingerprints.json");
const DEFAULT_HTTPX_BEHAVIOR_OPTIONS: HttpxBehaviorOptions = {
  browserLikeHeaders: false,
  tlsImpersonate: false,
  followRedirects: null,
};
const BROWSER_LIKE_HEADERS = [
  "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language: en-US,en;q=0.9",
  "Sec-Fetch-Dest: document",
  "Sec-Fetch-Mode: navigate",
  "Sec-Fetch-Site: none",
  "Sec-Fetch-User: ?1",
  'Sec-Ch-Ua: "Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  "Sec-Ch-Ua-Mobile: ?0",
  'Sec-Ch-Ua-Platform: "Windows"',
];

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

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

function parseResponseTimeMs(payload: HttpxJson): number | null {
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

function toObject(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function buildSearchDocument(payload: {
  input: string | null;
  finalUrl: string | null;
  title: string | null;
  server: string | null;
  technologies: string[];
  plugins: string[];
  themes: string[];
  cpes: string[];
}) {
  return [
    payload.input,
    payload.finalUrl,
    payload.title,
    payload.server,
    ...payload.technologies,
    ...payload.plugins,
    ...payload.themes,
    ...payload.cpes,
  ]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ");
}

function extractCpeEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{ cpe: string; vendor: string | null; product: string | null }>;
  }

  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      return [{ cpe: entry, vendor: null, product: null }];
    }

    if (isObject(entry) && typeof entry.cpe === "string") {
      return [
        {
          cpe: entry.cpe,
          vendor: typeof entry.vendor === "string" ? entry.vendor : null,
          product: typeof entry.product === "string" ? entry.product : null,
        },
      ];
    }

    return [];
  });
}

function buildDetectionRows(input: {
  resultId: string;
  technologies: readonly string[];
  promotedCpeTechnologies: readonly string[];
  plugins: readonly string[];
  themes: readonly string[];
  cpeEntries: ReadonlyArray<{ cpe: string; vendor: string | null; product: string | null }>;
}) {
  const detectionRows: DetectionInsert[] = [];
  const seen = new Set<string>();

  const appendDetection = (row: DetectionInsert) => {
    const key = [
      row.kind,
      row.source,
      row.slug?.trim().toLowerCase() ?? "",
      row.name.trim().toLowerCase(),
      row.version?.trim().toLowerCase() ?? "",
      row.cpe?.trim().toLowerCase() ?? "",
    ].join("::");

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    detectionRows.push(row);
  };

  for (const technologyName of input.technologies) {
    const canonicalTechnology = canonicalizeTechnologyLabel(technologyName);

    appendDetection({
      resultId: input.resultId,
      kind: "technology",
      name: canonicalTechnology.name,
      version: canonicalTechnology.version,
      source: "wappalyzer",
      slug: null,
      vendor: null,
      product: null,
      cpe: null,
    });
  }

  for (const technologyName of input.promotedCpeTechnologies) {
    const canonicalTechnology = canonicalizeTechnologyLabel(technologyName);

    appendDetection({
      resultId: input.resultId,
      kind: "technology",
      name: canonicalTechnology.name,
      version: canonicalTechnology.version,
      source: "cpe",
      slug: null,
      vendor: null,
      product: null,
      cpe: null,
    });
  }

  for (const pluginName of input.plugins) {
    appendDetection({
      resultId: input.resultId,
      kind: "wordpress_plugin",
      name: pluginName,
      version: null,
      source: "wordpress",
      slug: pluginName,
      vendor: null,
      product: null,
      cpe: null,
    });
  }

  for (const themeName of input.themes) {
    appendDetection({
      resultId: input.resultId,
      kind: "wordpress_theme",
      name: themeName,
      version: null,
      source: "wordpress",
      slug: themeName,
      vendor: null,
      product: null,
      cpe: null,
    });
  }

  for (const entry of input.cpeEntries) {
    appendDetection({
      resultId: input.resultId,
      kind: "cpe",
      name: entry.product ?? entry.vendor ?? entry.cpe,
      version: null,
      source: "cpe",
      slug: null,
      vendor: entry.vendor,
      product: entry.product,
      cpe: entry.cpe,
    });
  }

  return detectionRows;
}

export function buildScreenshotTechnologyDetectionRows(input: {
  resultId: string;
  technologies: readonly string[];
  existingDetections: readonly Pick<DetectionInsert, "kind" | "source" | "name" | "version" | "slug" | "cpe">[];
}) {
  const detectionRows: DetectionInsert[] = [];
  const detectionKey = (row: Pick<DetectionInsert, "kind" | "source" | "name" | "version">) =>
    [
      row.kind,
      row.source,
      row.name.trim().toLowerCase(),
      row.version?.trim().toLowerCase() ?? "",
    ].join("::");
  const seen = new Set(
    input.existingDetections.map((row) => detectionKey(row)),
  );

  for (const technologyName of input.technologies) {
    const canonicalTechnology = canonicalizeTechnologyLabel(technologyName);
    const canonicalName = canonicalTechnology.name.trim();

    if (!canonicalName) {
      continue;
    }

    const row: DetectionInsert = {
      resultId: input.resultId,
      kind: "technology",
      name: canonicalName,
      version: canonicalTechnology.version,
      source: "wappalyzer",
      slug: null,
      vendor: null,
      product: null,
      cpe: null,
    };
    const key = detectionKey(row);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    detectionRows.push(row);
  }

  return detectionRows;
}

function getNucleiTargetUrl(result: Pick<ScanResultRow, "finalUrl" | "url">) {
  const candidate = result.finalUrl ?? result.url;

  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function getNucleiTargetHost(targetUrl: string | null) {
  if (!targetUrl) {
    return null;
  }

  try {
    const parsed = new URL(targetUrl);
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

function getRegistrableDomain(target: string | null) {
  if (!target) {
    return null;
  }

  const domain = getDomain(getExecutionTarget(target));
  return domain ? domain.toLowerCase() : null;
}

export function selectNucleiTargets(
  scanTarget: Pick<ScanRow, "normalizedTarget">,
  result: Pick<ScanResultRow, "finalUrl" | "url">,
): NucleiTargetSelection {
  const targetUrl = getNucleiTargetUrl(result);
  const targetHost = getNucleiTargetHost(targetUrl);
  const originalDomainTarget = getRegistrableDomain(scanTarget.normalizedTarget);
  const finalDomainTarget = getRegistrableDomain(targetHost);
  const domainTarget = originalDomainTarget ?? finalDomainTarget;

  return {
    targetUrl,
    targetHost,
    originalDomainTarget,
    finalDomainTarget,
    domainTarget,
  };
}

function getHttpxExecutionTarget(target: string) {
  return getExecutionTarget(target);
}

export function buildNucleiExecutionPhases(targets: NucleiTargetSelection): NucleiExecutionPhase[] {
  const phases: NucleiExecutionPhase[] = [];
  const seenDomainTargets = new Set<string>();

  for (const domainTarget of [targets.originalDomainTarget, targets.finalDomainTarget]) {
    if (!domainTarget || seenDomainTargets.has(domainTarget)) {
      continue;
    }

    seenDomainTargets.add(domainTarget);
    phases.push({
      subject: domainTarget,
      subjectType: "domain",
      templateIds: NUCLEI_DOMAIN_TEMPLATE_IDS,
    });
    phases.push({
      subject: domainTarget,
      subjectType: "domain",
      templateIds: NUCLEI_RDAP_TEMPLATE_IDS,
      disableRedirects: false,
    });
    phases.push({
      subject: domainTarget,
      subjectType: "domain",
      templateIds: NUCLEI_TXT_SERVICE_TEMPLATE_IDS,
      includeTags: ["txt-service"],
    });
  }

  if (targets.targetUrl) {
    phases.push({
      subject: targets.targetUrl,
      subjectType: "url",
      templateIds: NUCLEI_URL_TEMPLATE_IDS,
    });
  }

  return phases;
}

function collectUniqueTechnologyNames(technologyNames: readonly (string | null)[]) {
  const visibleTechnologyNames: string[] = [];
  const seen = new Set<string>();

  for (const technologyName of technologyNames) {
    if (!technologyName) {
      continue;
    }

    const normalizedTechnologyName = canonicalizeTechnologyLabel(technologyName).name.trim().toLowerCase();

    if (!normalizedTechnologyName || seen.has(normalizedTechnologyName)) {
      continue;
    }

    seen.add(normalizedTechnologyName);
    visibleTechnologyNames.push(canonicalizeTechnologyLabel(technologyName).name);
  }

  return visibleTechnologyNames;
}

function buildStoredResultVisibleTechnologies(
  result: ScanResultRow,
  nucleiTechnologyNames: readonly string[],
  persistedTechnologyNames?: readonly string[],
) {
  const rawPayload = toObject(result.rawJson);
  const cpeEntries = extractCpeEntries(rawPayload.cpe);

  return buildEnrichedTechnologies({
    persistedTechnologies: persistedTechnologyNames ?? asStringArray(rawPayload.tech),
    additionalTechnologies: nucleiTechnologyNames,
    cpeEntries,
    cspJson: toObject(result.cspJson),
    bodyDomains: Array.isArray(result.bodyDomains) ? result.bodyDomains : [],
    bodyFqdns: Array.isArray(result.bodyFqdns) ? result.bodyFqdns : [],
  });
}

export function buildStoredResultSearchDocument(
  result: ScanResultRow,
  nucleiTechnologyNames: readonly string[],
  persistedTechnologyNames?: readonly string[],
) {
  const rawPayload = toObject(result.rawJson);
  const wordpress = toObject(rawPayload.wordpress);
  const cpeEntries = extractCpeEntries(rawPayload.cpe);

  return buildSearchDocument({
    input: result.input,
    finalUrl: result.finalUrl ?? result.url,
    title: result.title,
    server: result.webServer,
    technologies: buildStoredResultVisibleTechnologies(result, nucleiTechnologyNames, persistedTechnologyNames),
    plugins: asStringArray(wordpress.plugins),
    themes: asStringArray(wordpress.themes),
    cpes: cpeEntries.map((entry) => entry.cpe),
  });
}

export function buildHttpxArguments(
  scan: ScanRow,
  behaviorOptions: HttpxBehaviorOptions = DEFAULT_HTTPX_BEHAVIOR_OPTIONS,
): string[] {
  const args = [
    "-silent",
    "-json",
    "-stream",
    "-td",
    "-cff",
    CUSTOM_WAPPALYZER_FINGERPRINTS_PATH,
    "-title",
    "-sc",
    "-cl",
    "-ct",
    "-rt",
    "-location",
    "-server",
    "-wp",
    "-cpe",
    "-favicon",
    "-jarm",
    "-cdn",
    "-ip",
    "-cname",
    "-asn",
    "-tls-grab",
    "-csp-probe",
    "-hash",
    "md5,mmh3,sha256",
    "-extract-fqdn",
    "-include-chain",
  ];
  const options = toObject(scan.optionsJson);

  if (behaviorOptions.followRedirects !== false && options.followRedirects !== false) {
    args.push("-fr");
  }

  if (options.includeRawResponse === true) {
    args.push("-sr");
  }

  if (behaviorOptions.browserLikeHeaders) {
    for (const header of BROWSER_LIKE_HEADERS) {
      args.push("-H", header);
    }
  }

  if (behaviorOptions.tlsImpersonate) {
    args.push("-tlsi");
  }

  return args;
}

export function getHttpxBehaviorOptionsForProfile(profile: HttpxRequestProfile): HttpxBehaviorOptions {
  switch (profile) {
    case "baseline":
      return { browserLikeHeaders: false, tlsImpersonate: false, followRedirects: null };
    case "browser_headers":
      return { browserLikeHeaders: true, tlsImpersonate: false, followRedirects: null };
    case "tlsi_final_url":
      return { browserLikeHeaders: false, tlsImpersonate: true, followRedirects: false };
  }
}

export function getNextHttpxRequestProfile(profile: HttpxRequestProfile): HttpxRequestProfile | null {
  switch (profile) {
    case "baseline":
      return "browser_headers";
    case "browser_headers":
      return "tlsi_final_url";
    case "tlsi_final_url":
      return null;
  }
}

function buildAttemptMeta(
  profile: HttpxRequestProfile,
  fallbackReason: string | null,
  resultCount = 0,
  forbiddenResultCount = 0,
): AttemptMeta {
  return {
    requestProfile: profile,
    fallbackReason,
    resultCount,
    forbiddenResultCount,
  };
}

function getRequestProfileLabel(profile: HttpxRequestProfile) {
  switch (profile) {
    case "baseline":
      return "Baseline";
    case "browser_headers":
      return "Browser headers";
    case "tlsi_final_url":
      return "TLS impersonation";
  }
}

function getFallbackReason(profile: HttpxRequestProfile) {
  switch (profile) {
    case "baseline":
      return null;
    case "browser_headers":
      return "403_after_baseline";
    case "tlsi_final_url":
      return "403_after_browser_headers";
  }
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
    "-tdh",
    "-cff",
    CUSTOM_WAPPALYZER_FINGERPRINTS_PATH,
    "-fr",
    "-ehb",
    "-st",
    String(Math.ceil(DEFAULT_SCREENSHOT_TIMEOUT_MS / 1000)),
    "-sid",
    String(Math.ceil(DEFAULT_HEADLESS_IDLE_MS / 1000)),
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

function shouldCaptureHomepageScreenshot(result: { statusCode: number | null; contentType: string | null; finalUrl: string | null; path: string | null }) {
  const statusCode = result.statusCode ?? 0;
  const contentType = result.contentType?.toLowerCase() ?? "";

  if (!result.finalUrl) {
    return false;
  }

  if (statusCode < 200 || statusCode >= 400) {
    return false;
  }

  return contentType.includes("text/html") || contentType.includes("application/xhtml+xml") || contentType.length === 0;
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

async function enrichResultWithHeadless(
  result: typeof scanResults.$inferSelect,
  target: Pick<ScanRow, "normalizedTarget">,
  signal?: AbortSignal,
) {
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
    let updatedResult: typeof scanResults.$inferSelect | null = null;

    logWorkerEvent("headless_enrichment_started", {
      scanId: result.scanId,
      resultId: result.id,
      target: target.normalizedTarget,
      captureScreenshot: shouldCaptureScreenshot,
      timeoutMs: DEFAULT_HEADLESS_ENRICHMENT_TIMEOUT_MS,
    });

    if (shouldCaptureScreenshot) {
      logWorkerEvent("screenshot_started", {
        scanId: result.scanId,
        resultId: result.id,
        target: target.normalizedTarget,
      });
    }

    const headlessTarget = getHttpxExecutionTarget(target.normalizedTarget);
    let headlessRun: RunHttpxCliResult | null = null;
    const attemptLimit = shouldCaptureScreenshot ? SCREENSHOT_CAPTURE_ATTEMPT_LIMIT : 1;

    for (let attemptNumber = 1; attemptNumber <= attemptLimit; attemptNumber += 1) {
      const attemptDirectory = join(workingDirectory, `attempt-${attemptNumber}`);
      await mkdir(attemptDirectory, { recursive: true });

      screenshotPath = null;
      const attemptTechnologies: string[] = [];

      const headlessArgs = buildHttpxHeadlessEnrichmentArguments({
        captureScreenshot: shouldCaptureScreenshot,
        storeDir: shouldCaptureScreenshot ? attemptDirectory : undefined,
        target: headlessTarget,
      });
      headlessRun = await runHttpxCli({
        command: env.HTTPX_BIN ?? "httpx",
        args: headlessArgs,
        targets: [],
        timeoutMs: DEFAULT_HEADLESS_ENRICHMENT_TIMEOUT_MS,
        allowNonJsonStdout: true,
        signal,
        onJsonLine: async (payload) => {
          const payloadScreenshotPath = asString(payload.screenshot_path) ?? asString(payload.screenshot_path_rel);

          if (payloadScreenshotPath) {
            screenshotPath = payloadScreenshotPath;
          }

          attemptTechnologies.push(...asStringArray(payload.tech));
        },
      });

      if (headlessRun.status === "completed") {
        headlessTechnologies.push(...attemptTechnologies);
      }

      if (shouldCaptureScreenshot) {
        screenshotPath ??= await findStoredScreenshotPath(join(attemptDirectory, "screenshot"));
      }

      if (headlessRun.status === "completed" && (!shouldCaptureScreenshot || screenshotPath)) {
        break;
      }

      if (shouldCaptureScreenshot && attemptNumber < attemptLimit) {
        logWorkerEvent("screenshot_retrying", {
          scanId: result.scanId,
          resultId: result.id,
          target: target.normalizedTarget,
          attemptNumber,
          reason: screenshotPath ? headlessRun.status : "missing_screenshot_path",
          message: headlessRun.stderr || null,
        });
      }
    }

    if (headlessRun?.status !== "completed") {
      logWorkerEvent("headless_enrichment_failed", {
        scanId: result.scanId,
        resultId: result.id,
        target: target.normalizedTarget,
        status: headlessRun?.status ?? "not_started",
        exitCode: headlessRun?.exitCode ?? null,
        timeoutMs: DEFAULT_HEADLESS_ENRICHMENT_TIMEOUT_MS,
        message: headlessRun?.stderr || null,
      });
      return result;
    }

    if (shouldCaptureScreenshot && !screenshotPath) {
      logWorkerEvent("screenshot_failed", {
        scanId: result.scanId,
        resultId: result.id,
        target: target.normalizedTarget,
        reason: "missing_screenshot_path",
        message: headlessRun.stderr || null,
      });
    }

    if (shouldCaptureScreenshot && screenshotPath) {
      const resolvedScreenshotPath = isAbsolute(screenshotPath) ? screenshotPath : join(workingDirectory, screenshotPath);

      const objectKey = buildScreenshotObjectKey(result.scanId, result.id);
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

    const screenshotTechnologyRows = await mergeScreenshotTechnologies(result.id, headlessTechnologies);

    if (screenshotTechnologyRows.length > 0) {
      await updateResultSearchDocument(updatedResult ?? result, []);
    }

    logWorkerEvent("headless_enrichment_completed", {
      scanId: result.scanId,
      resultId: result.id,
      target: target.normalizedTarget,
      captureScreenshot: shouldCaptureScreenshot,
      detectedTechnologyCount: headlessTechnologies.length,
      newTechnologyCount: screenshotTechnologyRows.length,
    });

    return updatedResult ?? result;
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

export async function runHttpxCli({
  command,
  args,
  targets,
  timeoutMs,
  onJsonLine,
  allowNonJsonStdout = false,
  shouldCancel,
  cancellationPollIntervalMs = DEFAULT_CANCELLATION_POLL_INTERVAL_MS,
  signal,
  spawnProcess = spawn,
}: RunHttpxCliOptions): Promise<RunHttpxCliResult> {
  const httpx = spawnProcess(command, args, {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stdout = createInterface({ input: httpx.stdout });
  const stderrChunks: string[] = [];
  const nonJsonStdoutChunks: string[] = [];

  let terminationReason: RunHttpxCliResult["status"] | null = null;
  let cancellationCheckInFlight = false;

  const closePromise = new Promise<number>((resolve, reject) => {
    httpx.on("error", reject);
    httpx.on("close", (code) => {
      resolve(code ?? 0);
    });
  });

  const terminateProcess = (reason: Exclude<RunHttpxCliResult["status"], "completed" | "failed">) => {
    if (terminationReason) {
      return;
    }

    terminationReason = reason;

    if (!httpx.killed) {
      httpx.kill("SIGTERM");
      setTimeout(() => {
        if (!httpx.killed) {
          httpx.kill("SIGKILL");
        }
      }, PROCESS_KILL_GRACE_PERIOD_MS).unref();
    }
  };

  const abortListener = () => {
    terminateProcess("aborted");
  };

  if (signal?.aborted) {
    terminateProcess("aborted");
  } else {
    signal?.addEventListener("abort", abortListener, { once: true });
  }

  const timeoutTimer = setTimeout(() => {
    terminateProcess("timed_out");
  }, timeoutMs);
  timeoutTimer.unref();

  const cancellationTimer = shouldCancel
    ? setInterval(async () => {
        if (terminationReason || cancellationCheckInFlight) {
          return;
        }

        cancellationCheckInFlight = true;

        try {
          if (await shouldCancel()) {
            terminateProcess("cancelled");
          }
        } finally {
          cancellationCheckInFlight = false;
        }
      }, cancellationPollIntervalMs)
    : null;

  cancellationTimer?.unref();

  httpx.stderr.on("data", (chunk) => {
    stderrChunks.push(chunk.toString());
  });

  for (const target of targets) {
    httpx.stdin.write(`${target}\n`);
  }
  httpx.stdin.end();

  try {
    for await (const line of stdout) {
      if (terminationReason) {
        continue;
      }

      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      try {
        const payload = JSON.parse(trimmed) as HttpxJson;
        await onJsonLine(payload);
      } catch (error) {
        if (!allowNonJsonStdout || !(error instanceof SyntaxError)) {
          throw error;
        }

        nonJsonStdoutChunks.push(trimmed);
      }
    }

    const exitCode = await closePromise;
    const stderr = stderrChunks.join(" ").trim();
    const stdoutNoise = nonJsonStdoutChunks.join(" ").trim();

    if (terminationReason) {
      return {
        status: terminationReason,
        exitCode,
        stderr,
      };
    }

    if (exitCode !== 0) {
      return {
        status: "failed",
        exitCode,
        stderr: stderr || stdoutNoise || `httpx exited with code ${exitCode}`,
      };
    }

    return {
      status: "completed",
      exitCode,
      stderr,
    };
  } finally {
    clearTimeout(timeoutTimer);
    if (cancellationTimer) {
      clearInterval(cancellationTimer);
    }
    stdout.close();
    signal?.removeEventListener("abort", abortListener);
  }
}

async function emitEvent(scanId: string, attemptId: string | null, eventType: typeof scanEvents.$inferInsert.eventType, payload: Record<string, unknown>) {
  await db.insert(scanEvents).values({
    scanId,
    attemptId,
    eventType,
    payload,
  });
}

async function isCancellationRequested(scanId: string) {
  const [scan] = await db
    .select({ cancellationRequestedAt: scans.cancellationRequestedAt })
    .from(scans)
    .where(eq(scans.id, scanId))
    .limit(1);

  return scan?.cancellationRequestedAt !== null;
}

const SCAN_QUEUE_RELATIONS = ["scans", "scan_attempts", "scan_events"];

function isMissingScanQueueRelationMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("relation") &&
    normalizedMessage.includes("does not exist") &&
    SCAN_QUEUE_RELATIONS.some((relationName) => normalizedMessage.includes(relationName))
  );
}

export function isMissingScanQueueSchemaError(error: unknown) {
  let currentError: unknown = error;

  while (currentError instanceof Error) {
    const postgresError = currentError as Error & { cause?: unknown; code?: string };

    if (
      (postgresError.code === undefined || postgresError.code === "42P01") &&
      isMissingScanQueueRelationMessage(currentError.message)
    ) {
      return true;
    }

    currentError = postgresError.cause;
  }

  return false;
}

async function claimNextQueuedScan(): Promise<ClaimedScan | null> {
  try {
    const [queuedScan] = await db
      .select()
      .from(scans)
      .where(eq(scans.status, "queued"))
      .orderBy(desc(scans.submittedAt))
      .limit(1);

    if (!queuedScan) {
      return null;
    }

    return db.transaction(async (tx) => {
      const [claimedScan] = await tx
        .update(scans)
        .set({
          status: "running",
          startedAt: queuedScan.startedAt ?? new Date(),
        })
        .where(and(eq(scans.id, queuedScan.id), eq(scans.status, "queued")))
        .returning();

      if (!claimedScan) {
        return null;
      }

      const [attemptCount] = await tx
        .select({ value: sql<number>`count(*)::int` })
        .from(scanAttempts)
        .where(eq(scanAttempts.scanId, claimedScan.id));

      const [attempt] = await tx
        .insert(scanAttempts)
        .values({
          scanId: claimedScan.id,
          attemptNumber: (attemptCount?.value ?? 0) + 1,
          workerId: getWorkerId(),
          status: "running",
          startedAt: new Date(),
          metaJson: buildAttemptMeta("baseline", null),
        })
        .returning();

      await tx.insert(scanEvents).values({
        scanId: claimedScan.id,
        attemptId: attempt.id,
        eventType: "scan.status",
        payload: {
          scanId: claimedScan.id,
          status: "running",
          attemptId: attempt.id,
          requestProfile: "baseline",
          at: new Date().toISOString(),
        },
      });

      logWorkerEvent("scan_attempt_started", {
        scanId: claimedScan.id,
        attemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
        requestProfile: "baseline",
        target: claimedScan.normalizedTarget,
      });

      return {
        scan: claimedScan,
        attempt,
        target: {
          inputTarget: claimedScan.inputTarget,
          normalizedTarget: claimedScan.normalizedTarget,
          canonicalTargetId: claimedScan.canonicalTargetId,
        },
      } satisfies ClaimedScan;
    });
  } catch (error) {
    if (!isMissingScanQueueSchemaError(error)) {
      throw error;
    }

    return null;
  }
}

async function createFallbackAttempt(
  claimedScan: ClaimedScan,
  profile: HttpxRequestProfile,
  fallbackReason: string,
): Promise<ClaimedScan> {
  return db.transaction(async (tx) => {
    const [attemptCount] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(scanAttempts)
      .where(eq(scanAttempts.scanId, claimedScan.scan.id));

    const [attempt] = await tx
      .insert(scanAttempts)
        .values({
          scanId: claimedScan.scan.id,
          attemptNumber: (attemptCount?.value ?? 0) + 1,
          workerId: getWorkerId(),
          status: "running",
          startedAt: new Date(),
          metaJson: buildAttemptMeta(profile, fallbackReason),
      })
      .returning();

    await tx.insert(scanEvents).values({
      scanId: claimedScan.scan.id,
      attemptId: attempt.id,
      eventType: "scan.status",
      payload: {
        scanId: claimedScan.scan.id,
        status: "running",
        attemptId: attempt.id,
        requestProfile: profile,
        fallbackReason,
        at: new Date().toISOString(),
      },
    });

    logWorkerEvent("scan_fallback_started", {
      scanId: claimedScan.scan.id,
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      requestProfile: profile,
      fallbackReason,
    });

    return {
      scan: claimedScan.scan,
      attempt,
      target: claimedScan.target,
    } satisfies ClaimedScan;
  });
}

async function summarizeAttemptResults(claimedScan: ClaimedScan): Promise<AttemptResultSummary> {
  const rows = await db
    .select({
      id: scanResults.id,
      input: scanResults.input,
      statusCode: scanResults.statusCode,
      finalUrl: scanResults.finalUrl,
      url: scanResults.url,
      observedAt: scanResults.observedAt,
    })
    .from(scanResults)
    .where(eq(scanResults.attemptId, claimedScan.attempt.id));

  const candidateResults = rankAuthoritativeScanResults(rows, claimedScan.target.normalizedTarget);
  const authoritativeResult = candidateResults[0] ?? null;

  return {
    resultCount: rows.length,
    forbiddenResultCount: rows.filter((row) => (row.statusCode ?? 0) === 403).length,
    candidateResults,
    authoritativeResult,
    authoritativeResultId: authoritativeResult?.resultId ?? null,
    authoritativeResultStatusCode: authoritativeResult?.statusCode ?? null,
    authoritativeRetryUrl: authoritativeResult?.finalUrl ?? authoritativeResult?.url ?? null,
  };
}

function buildAttemptSelectionTracePayload(
  claimedScan: ClaimedScan,
  requestProfile: HttpxRequestProfile,
  attemptSummary: AttemptResultSummary,
) {
  return {
    scanId: claimedScan.scan.id,
    attemptId: claimedScan.attempt.id,
    attemptNumber: claimedScan.attempt.attemptNumber,
    requestProfile,
    candidateResults: attemptSummary.candidateResults.map((candidate) => ({
      resultId: candidate.resultId,
      statusCode: candidate.statusCode,
      input: candidate.input,
      url: candidate.url,
      finalUrl: candidate.finalUrl,
      matchedOn: candidate.matchedOn,
      matchesPrimaryTarget: candidate.matchesPrimaryTarget,
    })),
    selectedResultId: attemptSummary.authoritativeResultId,
    selectedResultStatus: attemptSummary.authoritativeResultStatusCode,
    selectedResultUrl: attemptSummary.authoritativeResult?.url ?? null,
    selectedResultFinalUrl: attemptSummary.authoritativeResult?.finalUrl ?? null,
    selectedMatchSource: attemptSummary.authoritativeResult?.matchedOn ?? null,
    forbiddenResultCount: attemptSummary.forbiddenResultCount,
    resultCount: attemptSummary.resultCount,
  };
}

export function buildAttemptFallbackDecision(
  requestProfile: HttpxRequestProfile,
  summary: Pick<AttemptResultSummary, "authoritativeResultStatusCode" | "authoritativeRetryUrl">,
): AttemptFallbackDecision {
  const nextProfile = getNextHttpxRequestProfile(requestProfile);

  if (summary.authoritativeResultStatusCode === null) {
    if (nextProfile) {
      return {
        shouldFallback: true,
        nextProfile,
        retryUrl: null,
        reason: "authoritative_result_missing",
      };
    }

    return {
      shouldFallback: false,
      nextProfile: null,
      retryUrl: null,
      reason: "fallback_exhausted",
    };
  }

  if (summary.authoritativeResultStatusCode !== 403) {
    return {
      shouldFallback: false,
      nextProfile: null,
      retryUrl: null,
      reason: "authoritative_result_not_blocked",
    };
  }

  if (!nextProfile) {
    return {
      shouldFallback: false,
      nextProfile: null,
      retryUrl: summary.authoritativeRetryUrl,
      reason: "fallback_exhausted",
    };
  }

  return {
    shouldFallback: true,
    nextProfile,
    retryUrl: summary.authoritativeRetryUrl,
    reason: "authoritative_result_blocked",
  };
}

export function buildRetryTargets(
  target: Pick<ScanRow, "normalizedTarget">,
  requestProfile: HttpxRequestProfile,
  authoritativeRetryUrl: string | null,
) {
  if (requestProfile !== "tlsi_final_url") {
    return [getHttpxExecutionTarget(target.normalizedTarget)];
  }

  return [authoritativeRetryUrl ?? getHttpxExecutionTarget(target.normalizedTarget)];
}

async function upsertNucleiRunState({
  resultId,
  status,
  targetUrl,
  targetHost,
  originalDomainTarget,
  finalDomainTarget,
  domainTarget,
  errorMessage,
  startedAt,
  completedAt,
}: {
  resultId: string;
  status: NucleiRunStatus;
  targetUrl: string | null;
  targetHost: string | null;
  originalDomainTarget: string | null;
  finalDomainTarget: string | null;
  domainTarget: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}) {
  const [run] = await db
    .insert(scanResultNucleiRuns)
    .values({
      resultId,
      status,
      targetUrl,
      targetHost,
      originalDomainTarget,
      finalDomainTarget,
      domainTarget,
      headersJson: [...BROWSER_LIKE_HEADERS],
      templateIdsJson: [...NUCLEI_TEMPLATE_ALLOWLIST],
      engineVersion: null,
      templatesVersion: null,
      errorMessage,
      startedAt,
      completedAt,
    })
    .onConflictDoUpdate({
      target: scanResultNucleiRuns.resultId,
      set: {
        status,
        targetUrl,
        targetHost,
        originalDomainTarget,
        finalDomainTarget,
        domainTarget,
        headersJson: [...BROWSER_LIKE_HEADERS],
        templateIdsJson: [...NUCLEI_TEMPLATE_ALLOWLIST],
        engineVersion: null,
        templatesVersion: null,
        errorMessage,
        startedAt,
        completedAt,
      },
    })
    .returning();

  return run;
}

async function updateResultSearchDocument(result: ScanResultRow, nucleiTechnologyNames: readonly string[]) {
  const persistedTechnologyNames = await getPersistedTechnologyNames(result.id);

  await db
    .update(scanResults)
    .set({
      searchDocument: buildStoredResultSearchDocument(result, nucleiTechnologyNames, persistedTechnologyNames ?? undefined),
    })
    .where(eq(scanResults.id, result.id));
}

async function getPersistedTechnologyNames(resultId: string) {
  const rows = await db
    .select({
      name: scanResultDetections.name,
    })
    .from(scanResultDetections)
    .where(and(eq(scanResultDetections.resultId, resultId), eq(scanResultDetections.kind, "technology")));

  if (rows.length === 0) {
    return null;
  }

  return collectUniqueTechnologyNames(rows.map((row) => row.name));
}

async function mergeScreenshotTechnologies(resultId: string, technologies: readonly string[]) {
  if (technologies.length === 0) {
    return [];
  }

  const existingDetections = await db
    .select({
      kind: scanResultDetections.kind,
      source: scanResultDetections.source,
      name: scanResultDetections.name,
      version: scanResultDetections.version,
      slug: scanResultDetections.slug,
      cpe: scanResultDetections.cpe,
    })
    .from(scanResultDetections)
    .where(
      and(
        eq(scanResultDetections.resultId, resultId),
        eq(scanResultDetections.kind, "technology"),
        eq(scanResultDetections.source, "wappalyzer"),
      ),
    );

  const detectionRows = buildScreenshotTechnologyDetectionRows({
    resultId,
    technologies,
    existingDetections,
  });

  if (detectionRows.length > 0) {
    await db.insert(scanResultDetections).values(detectionRows);
  }

  return detectionRows;
}

function getNucleiFailureMessage(result: { status: "completed" | "failed" | "timed_out"; exitCode: number; stderr: string }) {
  if (result.status === "timed_out") {
    return "nuclei enrichment timed out.";
  }

  return result.stderr || `nuclei exited with code ${result.exitCode}.`;
}

function buildNucleiLogPayload(
  targetUrl: string | null,
  targetHost: string | null,
  originalDomainTarget: string | null,
  finalDomainTarget: string | null,
  domainTarget: string | null,
) {
  return {
    targetUrl,
    targetHost,
    originalDomainTarget,
    finalDomainTarget,
    domainTarget,
    command: env.NUCLEI_BIN ?? "nuclei",
    timeoutMs: DEFAULT_NUCLEI_TIMEOUT_MS,
    headerCount: BROWSER_LIKE_HEADERS.length,
    templateCount: NUCLEI_TEMPLATE_ALLOWLIST.length,
    templateIds: [...NUCLEI_TEMPLATE_ALLOWLIST],
    templatesDir: env.NUCLEI_TEMPLATES_DIR ?? null,
    templateSelectionMode: env.NUCLEI_TEMPLATES_DIR ? "paths" : "ids",
  };
}

async function enrichResultWithNuclei(
  scanId: string,
  scanTarget: Pick<ScanRow, "normalizedTarget">,
  result: ScanResultRow,
) {
  const nucleiTargets = selectNucleiTargets(scanTarget, result);
  const executionPhases = buildNucleiExecutionPhases(nucleiTargets);
  const completedAt = new Date();
  const nucleiLogPayload = buildNucleiLogPayload(
    nucleiTargets.targetUrl,
    nucleiTargets.targetHost,
    nucleiTargets.originalDomainTarget,
    nucleiTargets.finalDomainTarget,
    nucleiTargets.domainTarget,
  );

  if (executionPhases.length === 0) {
    await upsertNucleiRunState({
      resultId: result.id,
      status: "skipped",
      targetUrl: nucleiTargets.targetUrl,
      targetHost: nucleiTargets.targetHost,
      originalDomainTarget: nucleiTargets.originalDomainTarget,
      finalDomainTarget: nucleiTargets.finalDomainTarget,
      domainTarget: nucleiTargets.domainTarget,
      errorMessage: "Nuclei requires an http or https URL or a registrable domain target.",
      startedAt: completedAt,
      completedAt,
    });
    await updateResultSearchDocument(result, []);

    logWorkerEvent("nuclei_enrichment_skipped", {
      scanId,
      resultId: result.id,
      reason: "missing_nuclei_targets",
      ...nucleiLogPayload,
    });
    return;
  }

  const startedAt = new Date();
  const run = await upsertNucleiRunState({
    resultId: result.id,
    status: "running",
    targetUrl: nucleiTargets.targetUrl,
    targetHost: nucleiTargets.targetHost,
    originalDomainTarget: nucleiTargets.originalDomainTarget,
    finalDomainTarget: nucleiTargets.finalDomainTarget,
    domainTarget: nucleiTargets.domainTarget,
    errorMessage: null,
    startedAt,
    completedAt: null,
  });

  await db.delete(scanResultNucleiMatches).where(eq(scanResultNucleiMatches.runId, run.id));

  logWorkerEvent("nuclei_enrichment_started", {
    scanId,
    resultId: result.id,
    executionPhaseCount: executionPhases.length,
    ...nucleiLogPayload,
  });

  try {
    const matches: Array<Exclude<ReturnType<typeof parseNucleiJsonLine>, null>> = [];

    for (const phase of executionPhases) {
      const nucleiResult = await runNucleiCli({
        command: env.NUCLEI_BIN ?? "nuclei",
        args: buildNucleiArguments({
          target: phase.subject,
          templateIds: phase.templateIds,
          templatePaths: phase.templatePaths,
          includeTags: phase.includeTags,
          disableRedirects: phase.disableRedirects,
          headers: BROWSER_LIKE_HEADERS,
          templatesDir: env.NUCLEI_TEMPLATES_DIR ?? null,
        }),
        timeoutMs: DEFAULT_NUCLEI_TIMEOUT_MS,
        onJsonLine: async (payload) => {
          const parsedMatch = parseNucleiJsonLine(payload);

          if (!parsedMatch) {
            return;
          }

          matches.push(
            withNucleiMatchExecutionContext(parsedMatch, {
              subject: phase.subject,
              subjectType: phase.subjectType,
            }),
          );
        },
      });

      if (nucleiResult.status !== "completed") {
        const errorMessage = getNucleiFailureMessage(nucleiResult);

        await upsertNucleiRunState({
          resultId: result.id,
          status: "failed",
          targetUrl: nucleiTargets.targetUrl,
          targetHost: nucleiTargets.targetHost,
          originalDomainTarget: nucleiTargets.originalDomainTarget,
          finalDomainTarget: nucleiTargets.finalDomainTarget,
          domainTarget: nucleiTargets.domainTarget,
          errorMessage,
          startedAt,
          completedAt: new Date(),
        });
        await updateResultSearchDocument(result, []);

        logWorkerEvent("nuclei_enrichment_failed", {
          scanId,
          resultId: result.id,
          status: nucleiResult.status,
          exitCode: nucleiResult.exitCode,
          message: errorMessage,
          failedSubject: phase.subject,
          failedSubjectType: phase.subjectType,
          ...nucleiLogPayload,
        });
        return;
      }
    }

    if (matches.length > 0) {
      await db.insert(scanResultNucleiMatches).values(
        matches.map((match) => ({
          runId: run.id,
          resultId: result.id,
          templateId: match.templateId,
          templatePath: match.templatePath,
          matcherName: match.matcherName,
          protocolType: match.protocolType,
          severity: match.severity,
          matchedAt: match.matchedAt,
          host: match.host,
          ip: match.ip,
          port: match.port,
          scheme: match.scheme,
          url: match.url,
          path: match.path,
          extractedResultsJson: match.extractedResults,
          technologyName: match.technologyName,
          technologyVersion: match.technologyVersion,
          findingKind: match.findingKind,
          subject: match.subject,
          subjectType: match.subjectType,
          rawJson: match.rawJson,
        })),
      );
    }

    const nucleiTechnologyNames = collectUniqueTechnologyNames(matches.map((match) => match.technologyName));

    await upsertNucleiRunState({
      resultId: result.id,
      status: "completed",
      targetUrl: nucleiTargets.targetUrl,
      targetHost: nucleiTargets.targetHost,
      originalDomainTarget: nucleiTargets.originalDomainTarget,
      finalDomainTarget: nucleiTargets.finalDomainTarget,
      domainTarget: nucleiTargets.domainTarget,
      errorMessage: null,
      startedAt,
      completedAt: new Date(),
    });
    await updateResultSearchDocument(result, nucleiTechnologyNames);

    logWorkerEvent("nuclei_enrichment_completed", {
      scanId,
      resultId: result.id,
      matchCount: matches.length,
      technologyCount: nucleiTechnologyNames.length,
      findingCount: matches.length - nucleiTechnologyNames.length,
      executionPhaseCount: executionPhases.length,
      durationMs: Date.now() - startedAt.getTime(),
      ...nucleiLogPayload,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Nuclei enrichment failed.";

    await upsertNucleiRunState({
      resultId: result.id,
      status: "failed",
      targetUrl: nucleiTargets.targetUrl,
      targetHost: nucleiTargets.targetHost,
      originalDomainTarget: nucleiTargets.originalDomainTarget,
      finalDomainTarget: nucleiTargets.finalDomainTarget,
      domainTarget: nucleiTargets.domainTarget,
      errorMessage,
      startedAt,
      completedAt: new Date(),
    });
    await updateResultSearchDocument(result, []);

    logWorkerEvent("nuclei_enrichment_failed", {
      scanId,
      resultId: result.id,
      status: "exception",
      message: errorMessage,
      ...nucleiLogPayload,
    });
  }
}

async function enrichAttemptResultsWithNuclei(claimedScan: ClaimedScan, authoritativeResult: ScanResultRow | null) {
  const results = authoritativeResult ? [authoritativeResult] : [];

  logWorkerEvent("nuclei_enrichment_batch_started", {
    scanId: claimedScan.scan.id,
    attemptId: claimedScan.attempt.id,
    attemptNumber: claimedScan.attempt.attemptNumber,
    resultCount: results.length,
    selectedResultId: authoritativeResult?.id ?? null,
  });

  for (const result of results) {
    await enrichResultWithNuclei(claimedScan.scan.id, claimedScan.target, result);
  }

  const resultIds = results.map((result) => result.id);
  const runRows = resultIds.length === 0
    ? []
    : await db
      .select({ status: scanResultNucleiRuns.status })
      .from(scanResultNucleiRuns)
      .where(inArray(scanResultNucleiRuns.resultId, resultIds));

  const counts = {
    completed: 0,
    failed: 0,
    skipped: 0,
    running: 0,
    pending: 0,
  } satisfies Record<NucleiRunStatus, number>;

  for (const runRow of runRows) {
    counts[runRow.status] += 1;
  }

  logWorkerEvent("nuclei_enrichment_batch_completed", {
    scanId: claimedScan.scan.id,
    attemptId: claimedScan.attempt.id,
    attemptNumber: claimedScan.attempt.attemptNumber,
    resultCount: results.length,
    runCount: runRows.length,
    selectedResultId: authoritativeResult?.id ?? null,
    ...counts,
  });
}

async function persistHttpxResult(claimedScan: ClaimedScan, payload: HttpxJson, resultCount: { value: number }) {
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
  const bodyFqdns = asStringArray(payload.body_fqdns);
  const promotedCpeTechnologies = promoteTechnologiesFromCpe(cpeEntries);
  const visibleTechnologies = buildEnrichedTechnologies({
    persistedTechnologies: technologies,
    cpeEntries,
    cspJson: csp,
    bodyDomains,
    bodyFqdns,
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

  await emitEvent(claimedScan.scan.id, claimedScan.attempt.id, "scan.result", {
    scanId: claimedScan.scan.id,
    resultId: result.id,
    target: claimedScan.target.normalizedTarget,
    statusCode: result.statusCode ?? 0,
    finalUrl: result.finalUrl ?? result.url ?? claimedScan.target.normalizedTarget,
    title: result.title ?? "",
    server: result.webServer ?? null,
    cdn: {
      enabled: Boolean(result.cdn || result.cdnName || result.cdnType),
      name: result.cdnName ?? null,
      type: result.cdnType ?? null,
    },
    technologies: visibleTechnologies,
    screenshotAvailable: Boolean(result.screenshotObjectKey),
    at: new Date().toISOString(),
  });

  await emitEvent(claimedScan.scan.id, claimedScan.attempt.id, "scan.progress", {
    scanId: claimedScan.scan.id,
    resultCount: resultCount.value,
    at: new Date().toISOString(),
  });

  return true;
}

async function markAttemptFailed(claimedScan: ClaimedScan, errorCode: string, message: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(scanAttempts)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorCode,
        errorMessage: message,
      })
      .where(eq(scanAttempts.id, claimedScan.attempt.id));

    await tx
      .update(scans)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorCode,
        errorMessage: message,
      })
      .where(eq(scans.id, claimedScan.scan.id));

    await tx.insert(scanEvents).values({
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      eventType: "scan.failed",
      payload: {
        scanId: claimedScan.scan.id,
        status: "failed",
        errorCode,
        message,
        at: new Date().toISOString(),
      },
    });
  });
}

async function markAttemptCancelled(claimedScan: ClaimedScan) {
  await db.transaction(async (tx) => {
    await tx
      .update(scanAttempts)
      .set({
        status: "cancelled",
        completedAt: new Date(),
      })
      .where(eq(scanAttempts.id, claimedScan.attempt.id));

    await tx
      .update(scans)
      .set({
        status: "cancelled",
        completedAt: new Date(),
      })
      .where(eq(scans.id, claimedScan.scan.id));

    await tx.insert(scanEvents).values({
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      eventType: "scan.cancelled",
      payload: {
        scanId: claimedScan.scan.id,
        status: "cancelled",
        at: new Date().toISOString(),
      },
    });
  });
}

async function markAttemptCompleted(claimedScan: ClaimedScan, metaPatch: Partial<AttemptMeta>) {
  const [resultCount] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(scanResults)
    .where(eq(scanResults.attemptId, claimedScan.attempt.id));

  const mergedMetaJson = {
    ...(claimedScan.attempt.metaJson ?? {}),
    ...metaPatch,
    resultCount: metaPatch.resultCount ?? resultCount?.value ?? 0,
  };

  await db.transaction(async (tx) => {
    await tx
      .update(scanAttempts)
      .set({
        status: "completed",
        completedAt: new Date(),
        metaJson: mergedMetaJson,
      })
      .where(eq(scanAttempts.id, claimedScan.attempt.id));
  });

  logWorkerEvent("scan_attempt_completed", {
    scanId: claimedScan.scan.id,
    attemptId: claimedScan.attempt.id,
    attemptNumber: claimedScan.attempt.attemptNumber,
    requestProfile: mergedMetaJson.requestProfile,
    resultCount: mergedMetaJson.resultCount,
    forbiddenResultCount: mergedMetaJson.forbiddenResultCount ?? 0,
  });

  return mergedMetaJson;
}

async function markScanProcessing(claimedScan: ClaimedScan) {
  await db.transaction(async (tx) => {
    await tx
      .update(scans)
      .set({
        status: "processing",
      })
      .where(eq(scans.id, claimedScan.scan.id));

    await tx.insert(scanEvents).values({
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      eventType: "scan.status",
      payload: {
        scanId: claimedScan.scan.id,
        status: "processing",
        attemptId: claimedScan.attempt.id,
        at: new Date().toISOString(),
      },
    });
  });
}

async function markScanCompleted(claimedScan: ClaimedScan, resultCount: number) {
  await db.transaction(async (tx) => {
    await tx
      .update(scans)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(scans.id, claimedScan.scan.id));

    await tx.insert(scanEvents).values({
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      eventType: "scan.complete",
      payload: {
        scanId: claimedScan.scan.id,
        status: "completed",
        resultCount,
        at: new Date().toISOString(),
      },
    });
  });
}

async function markScanFailedAfterAttemptCompletion(claimedScan: ClaimedScan, errorCode: string, message: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(scans)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorCode,
        errorMessage: message,
      })
      .where(eq(scans.id, claimedScan.scan.id));

    await tx.insert(scanEvents).values({
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      eventType: "scan.failed",
      payload: {
        scanId: claimedScan.scan.id,
        status: "failed",
        errorCode,
        message,
        at: new Date().toISOString(),
      },
    });
  });
}

async function runClaimedScan(claimedScan: ClaimedScan, signal?: AbortSignal) {
  let activeClaimedScan = claimedScan;
  let retryTargets = [getHttpxExecutionTarget(claimedScan.target.normalizedTarget)];
  let activeAttemptCompleted = false;

  try {
    while (true) {
      activeAttemptCompleted = false;
      const resultCount = { value: 0 };
      const requestProfile =
        typeof activeClaimedScan.attempt.metaJson?.requestProfile === "string"
          ? (activeClaimedScan.attempt.metaJson.requestProfile as HttpxRequestProfile)
          : "baseline";

      const result = await runHttpxCli({
        command: env.HTTPX_BIN ?? "httpx",
        args: buildHttpxArguments(activeClaimedScan.scan, getHttpxBehaviorOptionsForProfile(requestProfile)),
        targets: retryTargets,
        timeoutMs: DEFAULT_SCAN_TIMEOUT_MS,
        signal,
        shouldCancel: async () => isCancellationRequested(activeClaimedScan.scan.id),
        onJsonLine: async (payload) => {
          await persistHttpxResult(activeClaimedScan, payload, resultCount);
        },
      });

      if (result.status === "cancelled") {
        logWorkerEvent("scan_attempt_cancelled", {
          scanId: activeClaimedScan.scan.id,
          attemptId: activeClaimedScan.attempt.id,
          attemptNumber: activeClaimedScan.attempt.attemptNumber,
          requestProfile,
        });
        await markAttemptCancelled(activeClaimedScan);
        return;
      }

      if (result.status === "timed_out") {
        logWorkerEvent("scan_attempt_failed", {
          scanId: activeClaimedScan.scan.id,
          attemptId: activeClaimedScan.attempt.id,
          attemptNumber: activeClaimedScan.attempt.attemptNumber,
          requestProfile,
          reason: "worker_timeout",
        });
        await markAttemptFailed(activeClaimedScan, "worker_timeout", "httpx scan timed out.");
        return;
      }

      if (result.status === "aborted") {
        logWorkerEvent("scan_attempt_failed", {
          scanId: activeClaimedScan.scan.id,
          attemptId: activeClaimedScan.attempt.id,
          attemptNumber: activeClaimedScan.attempt.attemptNumber,
          requestProfile,
          reason: "worker_shutdown",
        });
        await markAttemptFailed(activeClaimedScan, "worker_shutdown", "Worker shutdown interrupted the scan.");
        return;
      }

      if (result.status === "failed") {
        logWorkerEvent("scan_attempt_failed", {
          scanId: activeClaimedScan.scan.id,
          attemptId: activeClaimedScan.attempt.id,
          attemptNumber: activeClaimedScan.attempt.attemptNumber,
          requestProfile,
          reason: `httpx_exit_${result.exitCode}`,
          message: result.stderr || null,
        });
        await markAttemptFailed(activeClaimedScan, `httpx_exit_${result.exitCode}`, result.stderr);
        return;
      }

      const attemptSummary = await summarizeAttemptResults(activeClaimedScan);
      const selectionTracePayload = buildAttemptSelectionTracePayload(activeClaimedScan, requestProfile, attemptSummary);
      const fallbackDecision = buildAttemptFallbackDecision(requestProfile, attemptSummary);

      logWorkerEvent("scan_attempt_selection_evaluated", selectionTracePayload);
      logWorkerEvent("scan_attempt_fallback_decided", {
        ...selectionTracePayload,
        fallbackTriggered: fallbackDecision.shouldFallback,
        fallbackDecisionReason: fallbackDecision.reason,
        retryUrl: fallbackDecision.retryUrl,
        nextRequestProfile: fallbackDecision.nextProfile,
      });

      await markAttemptCompleted(
        activeClaimedScan,
        buildAttemptMeta(
          requestProfile,
          getFallbackReason(requestProfile),
          attemptSummary.resultCount,
          attemptSummary.forbiddenResultCount,
        ),
      );
      activeAttemptCompleted = true;

      if (!fallbackDecision.shouldFallback) {
        await markScanProcessing(activeClaimedScan);
        const authoritativeResult = attemptSummary.authoritativeResultId
          ? (await db
            .select()
            .from(scanResults)
            .where(eq(scanResults.id, attemptSummary.authoritativeResultId))
            .limit(1))[0] ?? null
          : null;

        logWorkerEvent("scan_attempt_post_processing_target", {
          ...selectionTracePayload,
          retryUrl: attemptSummary.authoritativeRetryUrl,
          postProcessingTarget: authoritativeResult ? "authoritative_result" : "none",
        });

        let resultForNuclei = authoritativeResult;

        if (authoritativeResult) {
          try {
            const screenshotTarget = {
              normalizedTarget: attemptSummary.authoritativeRetryUrl ?? activeClaimedScan.target.normalizedTarget,
            } satisfies Pick<ScanRow, "normalizedTarget">;

            resultForNuclei = await enrichResultWithHeadless(authoritativeResult, screenshotTarget, signal);
          } catch (error) {
            console.warn("Headless enrichment failed", {
              scanId: activeClaimedScan.scan.id,
              resultId: authoritativeResult.id,
              message: error instanceof Error ? error.message : "Unknown headless enrichment error",
            });
          }
        }

        await enrichAttemptResultsWithNuclei(activeClaimedScan, resultForNuclei);
        await markScanCompleted(activeClaimedScan, attemptSummary.resultCount);
        return;
      }

      const nextProfile = fallbackDecision.nextProfile;

      if (nextProfile === null) {
        throw new Error("Fallback decision requested a retry without a next request profile.");
      }

      activeClaimedScan = await createFallbackAttempt(
        activeClaimedScan,
        nextProfile,
        `Received authoritative 403 after ${getRequestProfileLabel(requestProfile)}.`,
      );
      activeAttemptCompleted = false;
      retryTargets = buildRetryTargets(activeClaimedScan.target, nextProfile, fallbackDecision.retryUrl);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker execution failed.";

    if (activeAttemptCompleted) {
      await markScanFailedAfterAttemptCompletion(activeClaimedScan, "worker_exception", message);
      return;
    }

    await markAttemptFailed(activeClaimedScan, "worker_exception", message);
  }
}

export async function claimQueuedScanById(scanId: string): Promise<ClaimedScan | null> {
  try {
    return db.transaction(async (tx) => {
      const [claimedScan] = await tx
        .update(scans)
        .set({
          status: "running",
          startedAt: new Date(),
        })
        .where(and(eq(scans.id, scanId), eq(scans.status, "queued")))
        .returning();

      if (!claimedScan) {
        return null;
      }

      const [attemptCount] = await tx
        .select({ value: sql<number>`count(*)::int` })
        .from(scanAttempts)
        .where(eq(scanAttempts.scanId, claimedScan.id));

      const [attempt] = await tx
        .insert(scanAttempts)
        .values({
          scanId: claimedScan.id,
          attemptNumber: (attemptCount?.value ?? 0) + 1,
          workerId: getWorkerId(),
          status: "running",
          startedAt: new Date(),
          metaJson: buildAttemptMeta("baseline", null),
        })
        .returning();

      await tx.insert(scanEvents).values({
        scanId: claimedScan.id,
        attemptId: attempt.id,
        eventType: "scan.status",
        payload: {
          scanId: claimedScan.id,
          status: "running",
          attemptId: attempt.id,
          requestProfile: "baseline",
          at: new Date().toISOString(),
        },
      });

      logWorkerEvent("scan_attempt_started", {
        scanId: claimedScan.id,
        attemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
        requestProfile: "baseline",
        target: claimedScan.normalizedTarget,
      });

      return {
        scan: claimedScan,
        attempt,
        target: {
          inputTarget: claimedScan.inputTarget,
          normalizedTarget: claimedScan.normalizedTarget,
          canonicalTargetId: claimedScan.canonicalTargetId,
        },
      } satisfies ClaimedScan;
    });
  } catch (error) {
    if (!isMissingScanQueueSchemaError(error)) {
      throw error;
    }

    return null;
  }
}

export async function runScanById(scanId: string, signal?: AbortSignal) {
  const claimedScan = await claimQueuedScanById(scanId);

  if (!claimedScan) {
    return false;
  }

  await runClaimedScan(claimedScan, signal);
  return true;
}

export async function runWorkerLoop({ once = false, pollIntervalMs = 1000 }: { once?: boolean; pollIntervalMs?: number } = {}) {
  let stopped = false;
  const abortController = new AbortController();

  const stop = () => {
    if (stopped) {
      return;
    }

    stopped = true;
    abortController.abort();
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopped) {
    const claimedScan = await claimNextQueuedScan();

    if (!claimedScan) {
      if (once) {
        break;
      }

      await sleep(pollIntervalMs);
      continue;
    }

    await runClaimedScan(claimedScan, abortController.signal);

    if (once) {
      break;
    }
  }
}
