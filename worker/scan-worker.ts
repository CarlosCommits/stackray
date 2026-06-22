import { spawn } from "node:child_process";
import { resolveTxt } from "node:dns/promises";
import type { Dirent } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, isAbsolute, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDomain } from "tldts";
import { parse as parseYaml } from "yaml";

import {
  scanAttempts,
  scanEvents,
  scanResultDetections,
  scanResultNucleiMatches,
  scanResultNucleiRuns,
  scanResults,
  scanPhaseRuns,
  scanSubdomainDiscoveryRuns,
  scanSubdomains,
  scans,
} from "../drizzle/schema.ts";
import { db } from "./db.ts";
import { env } from "../lib/env/server.ts";
import { enqueueGraphileJob } from "../lib/server/jobs/graphile.ts";
import { uploadScreenshotObject } from "../lib/server/storage/screenshot-uploads.ts";
import { buildScreenshotObjectKey, screenshotStorageEnabled } from "../lib/server/storage/screenshots.ts";
import { extractCpeVersion, normalizeCpeVersion } from "../lib/server/scans/cpe.ts";
import { buildEnrichedTechnologies, getNucleiDnsServiceTechnologyName, promoteTechnologiesFromCpe } from "../lib/server/scans/technology-enrichment.ts";
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
import {
  buildSubfinderArguments,
  parseSubfinderJsonLine,
  runSubfinderCli,
} from "./subfinder.ts";
import { enrichIpAddress } from "./ip-enrichment.ts";

type ScanRow = typeof scans.$inferSelect;
type AttemptRow = typeof scanAttempts.$inferSelect;
type ScanResultRow = typeof scanResults.$inferSelect;
type DetectionInsert = typeof scanResultDetections.$inferInsert;
type NucleiRunStatus = typeof scanResultNucleiRuns.$inferInsert.status;
type SubdomainDiscoveryRunStatus = typeof scanSubdomainDiscoveryRuns.$inferInsert.status;
type ScanPhaseKind = typeof scanPhaseRuns.$inferInsert.phase;
type ScanPhaseStatus = typeof scanPhaseRuns.$inferInsert.status;
type HttpxRequestProfile = "baseline" | "browser_headers";
type ParsedNucleiMatch = Exclude<ReturnType<typeof parseNucleiJsonLine>, null>;

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
  "id" | "input" | "url" | "finalUrl" | "statusCode" | "title" | "contentType" | "observedAt"
>;

type AttemptResultSummary = {
  resultCount: number;
  forbiddenResultCount: number;
  candidateResults: RankedAuthoritativeScanResult<AttemptResultSelectionRow>[];
  authoritativeResult: RankedAuthoritativeScanResult<AttemptResultSelectionRow> | null;
  authoritativeResultId: string | null;
  authoritativeResultStatusCode: number | null;
  authoritativeResultTitle: string | null;
  authoritativeResultContentType: string | null;
  authoritativeRetryUrl: string | null;
};

const ENRICHMENT_PHASES = ["subfinder", "headless", "browser_fallback", "nuclei_dns", "nuclei_http", "ip_intel"] as const;
const TERMINAL_PHASE_STATUSES = new Set<ScanPhaseStatus>(["completed", "failed", "skipped", "cancelled"]);
export const FINALIZE_RETRY_DELAY_MS = 30_000;

type HeadlessDocumentObservation = {
  url: string | null;
  statusCode: number | null;
};

function isEnrichmentPhase(phase: ScanPhaseKind): phase is typeof ENRICHMENT_PHASES[number] {
  return (ENRICHMENT_PHASES as readonly ScanPhaseKind[]).includes(phase);
}

type HeadlessNetworkSummary = {
  networkRequestCount: number;
  scriptRequestCount: number;
  sameOriginScriptRequestCount: number;
  pendingSameOriginScriptCount: number;
};

type HeadlessMetadataPromotion = {
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

type AttemptFallbackDecision = {
  shouldFallback: boolean;
  nextProfile: HttpxRequestProfile | null;
  retryUrl: string | null;
  reason:
    | "authoritative_result_blocked"
    | "authoritative_result_degraded"
    | "authoritative_result_not_blocked"
    | "authoritative_result_missing"
    | "fallback_exhausted";
};

type NoJsonHttpProbePlaceholderInput = {
  scanId: string;
  attemptId: string;
  inputTarget: string;
  normalizedTarget: string;
  requestProfile: HttpxRequestProfile;
  fallbackReason: string;
};

type BrowserFallbackProvider = "akamai" | "cloudflare" | "datadome" | "perimeterx" | "forter" | "unknown";

type BrowserFallbackDecision = {
  shouldRun: boolean;
  confidence: "none" | "suspected" | "confirmed" | "recovery";
  provider?: BrowserFallbackProvider;
  reason: string;
  signals: string[];
};

type BrowserFallbackDecisionOptions = {
  headlessFailed?: boolean;
  headlessScreenshotMissing?: boolean;
};

type BrowserFallbackPhaseMeta = {
  decision: BrowserFallbackDecision;
  triggerOptions: BrowserFallbackDecisionOptions;
  outcome?: BrowserFallbackOutcome;
  recovered?: boolean;
};

type BrowserFallbackOutcome = "recovered" | "confirmed_block" | "no_recovery" | "disabled";

type HeadlessEnrichmentEvidence = {
  title: string | null;
  documentObservation: HeadlessDocumentObservation | null;
  networkSummary: HeadlessNetworkSummary | null;
  technologies: string[];
  completedPassCount: number;
  runtimeTechnologyDegraded: boolean;
};

const DEFAULT_SCAN_TIMEOUT_MS = env.STACKRAY_HTTPX_TIMEOUT_MS ?? 15 * 60 * 1000;
const HTTP_PROBE_RECOVERY_LOCK_GRACE_SECONDS = Math.ceil((DEFAULT_SCAN_TIMEOUT_MS + 60_000) / 1000);
const DEFAULT_NUCLEI_TIMEOUT_MS = env.STACKRAY_NUCLEI_TIMEOUT_MS ?? 2 * 60 * 1000;
const DEFAULT_SUBFINDER_SOURCE_TIMEOUT_SECONDS = env.STACKRAY_SUBFINDER_SOURCE_TIMEOUT_SECONDS ?? 60;
const DEFAULT_SUBFINDER_MAX_TIME_MINUTES = env.STACKRAY_SUBFINDER_MAX_TIME_MINUTES
  ?? (env.STACKRAY_SUBFINDER_TIMEOUT_MS ? Math.max(1, Math.floor(env.STACKRAY_SUBFINDER_TIMEOUT_MS / 60_000)) : 5);
const DEFAULT_SUBFINDER_PROCESS_TIMEOUT_MS =
  env.STACKRAY_SUBFINDER_TIMEOUT_MS ?? (DEFAULT_SUBFINDER_MAX_TIME_MINUTES * 60_000) + 10_000;
const DEFAULT_SCREENSHOT_TIMEOUT_MS = env.STACKRAY_SCREENSHOT_TIMEOUT_MS ?? 30 * 1000;
const DEFAULT_HEADLESS_ENRICHMENT_TIMEOUT_MS =
  env.STACKRAY_HEADLESS_ENRICHMENT_TIMEOUT_MS ?? Math.max(45 * 1000, DEFAULT_SCREENSHOT_TIMEOUT_MS + 30 * 1000);
const DEFAULT_HEADLESS_IDLE_MS = env.STACKRAY_HEADLESS_IDLE_MS ?? 10 * 1000;
const DEFAULT_HEADLESS_TECH_DETECTION_TIMEOUT_MS = resolveHeadlessTechnologyDetectionTimeoutMs({
  configuredTimeoutMs: env.STACKRAY_HEADLESS_TECH_DETECTION_TIMEOUT_MS,
  headlessIdleMs: DEFAULT_HEADLESS_IDLE_MS,
  screenshotTimeoutMs: DEFAULT_SCREENSHOT_TIMEOUT_MS,
  screenshotProcessTimeoutMs: DEFAULT_HEADLESS_ENRICHMENT_TIMEOUT_MS,
});
const DEFAULT_BROWSER_FALLBACK_ENABLED = env.STACKRAY_BROWSER_FALLBACK_ENABLED !== "false";
const DEFAULT_BROWSER_FALLBACK_TIMEOUT_MS = env.STACKRAY_BROWSER_FALLBACK_TIMEOUT_MS ?? 90 * 1000;
const DEFAULT_BROWSER_FALLBACK_SETTLE_TIMEOUT_MS = env.STACKRAY_BROWSER_FALLBACK_SETTLE_TIMEOUT_MS ?? 40 * 1000;
const DEFAULT_BROWSER_FALLBACK_IDLE_MS = env.STACKRAY_BROWSER_FALLBACK_IDLE_MS ?? 3 * 1000;
const DEFAULT_BROWSER_FALLBACK_CHROME_BIN = env.STACKRAY_BROWSER_FALLBACK_CHROME_BIN ?? "/usr/bin/google-chrome";
const SCREENSHOT_CAPTURE_ATTEMPT_LIMIT = 2;
const DEFAULT_CANCELLATION_POLL_INTERVAL_MS = 500;
const PROCESS_KILL_GRACE_PERIOD_MS = 1_000;
const CUSTOM_WAPPALYZER_FINGERPRINTS_PATH = join(process.cwd(), "lib", "server", "scans", "custom-wappalyzer-fingerprints.json");
const DEFAULT_HTTPX_BEHAVIOR_OPTIONS: HttpxBehaviorOptions = {
  browserLikeHeaders: false,
  followRedirects: null,
};
const BLOCKED_HTTP_STATUS_CODES = new Set([403, 429]);
const BROWSER_LIKE_HEADERS = [
  "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6568.0 Safari/537.36",
  "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language: en-US,en;q=0.9",
  "Sec-Fetch-Dest: document",
  "Sec-Fetch-Mode: navigate",
  "Sec-Fetch-Site: none",
  "Sec-Fetch-User: ?1",
  'Sec-Ch-Ua: "Chromium";v="128", "Not;A=Brand";v="99"',
  "Sec-Ch-Ua-Mobile: ?0",
  'Sec-Ch-Ua-Platform: "Linux"',
];

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

type FaviconFields = ReturnType<typeof extractFaviconFields>;

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

type CpeEntry = {
  cpe: string;
  vendor: string | null;
  product: string | null;
  version: string | null;
};

export { extractCpeVersion };

function extractCpeEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as CpeEntry[];
  }

  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      return [{ cpe: entry, vendor: null, product: null, version: extractCpeVersion(entry) }];
    }

    if (isObject(entry) && typeof entry.cpe === "string") {
      return [
        {
          cpe: entry.cpe,
          vendor: typeof entry.vendor === "string" ? entry.vendor : null,
          product: typeof entry.product === "string" ? entry.product : null,
          version: typeof entry.version === "string" ? normalizeCpeVersion(entry.version) : extractCpeVersion(entry.cpe),
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
  cpeEntries: readonly CpeEntry[];
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
      version: entry.version,
      source: "cpe",
      slug: null,
      vendor: entry.vendor,
      product: entry.product,
      cpe: entry.cpe,
    });
  }

  return detectionRows;
}

export function buildNucleiTechnologyDetectionRows(input: {
  resultId: string;
  matches: readonly { findingKind: string; matcherName: string | null; technologyName: string | null; technologyVersion: string | null }[];
}) {
  const detectionRows: DetectionInsert[] = [];
  const seen = new Set<string>();

  for (const match of input.matches) {
    const technologyName = match.technologyName ?? getNucleiDnsServiceTechnologyName({
      findingKind: match.findingKind,
      matcherName: match.matcherName,
    });

    if (!technologyName) {
      continue;
    }

    const canonicalTechnology = canonicalizeTechnologyLabel(technologyName);
    const version = match.technologyVersion ?? canonicalTechnology.version;
    const key = [
      canonicalTechnology.name.trim().toLowerCase(),
      version?.trim().toLowerCase() ?? "",
    ].join("::");

    if (!canonicalTechnology.name.trim() || seen.has(key)) {
      continue;
    }

    seen.add(key);

    detectionRows.push({
      resultId: input.resultId,
      kind: "technology",
      name: canonicalTechnology.name,
      version,
      source: "nuclei",
      slug: null,
      vendor: null,
      product: null,
      cpe: null,
    });
  }

  return detectionRows;
}

const STACKRAY_DNS_SERVICE_TEMPLATE_ID = "stackray-dns-service-detection";
const STACKRAY_DNS_SERVICE_TEMPLATE_PATH = "dns/stackray-dns-service-detection.yaml";
const TXT_FINGERPRINT_TEMPLATE_ID = "txt-fingerprint";
const TXT_FINGERPRINT_TEMPLATE_PATH = "dns/txt-fingerprint.yaml";

type TxtDetectionRule = {
  templateId: string;
  templatePath: string;
  findingKind: "dns_service" | "technology";
  matcherName: string;
  words?: readonly string[];
  patterns?: readonly RegExp[];
};

const TXT_FALLBACK_TEMPLATE_SOURCES = [
  {
    templateId: "txt-service-detect",
    templatePath: "dns/txt-service-detect.yaml",
    findingKind: "dns_service",
    repoLocal: false,
  },
  {
    templateId: "replit-dns-verification",
    templatePath: "dns/replit-dns-verification.yaml",
    findingKind: "technology",
    repoLocal: true,
  },
  {
    templateId: STACKRAY_DNS_SERVICE_TEMPLATE_ID,
    templatePath: STACKRAY_DNS_SERVICE_TEMPLATE_PATH,
    findingKind: "dns_service",
    repoLocal: true,
  },
] as const satisfies ReadonlyArray<{
  templateId: string;
  templatePath: string;
  findingKind: TxtDetectionRule["findingKind"];
  repoLocal: boolean;
}>;

const txtDetectionRuleCache = new Map<string, Promise<readonly TxtDetectionRule[]>>();

function asRegexArray(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const pattern = asString(entry)?.trim();

        if (!pattern) {
          return [];
        }

        return [pattern];
      })
    : [];
}

function compileNucleiRegex(pattern: string) {
  let flags = "u";
  let source = pattern;

  if (source.startsWith("(?i)")) {
    flags = "iu";
    source = source.slice(4);
  }

  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

export function parseNucleiTxtDetectionRulesTemplate(
  templateContents: string,
  source: Pick<TxtDetectionRule, "templateId" | "templatePath" | "findingKind"> = {
    templateId: "txt-service-detect",
    templatePath: "dns/txt-service-detect.yaml",
    findingKind: "dns_service",
  },
): TxtDetectionRule[] {
  const parsedTemplate = parseYaml(templateContents);

  if (!isObject(parsedTemplate)) {
    return [];
  }

  const rules: TxtDetectionRule[] = [];

  for (const dnsEntry of Array.isArray(parsedTemplate.dns) ? parsedTemplate.dns : []) {
    if (isObject(dnsEntry) && asString(dnsEntry.type)?.toUpperCase() !== "TXT") {
      continue;
    }

    if (!isObject(dnsEntry) || !Array.isArray(dnsEntry.matchers)) {
      continue;
    }

    for (const matcher of dnsEntry.matchers) {
      if (!isObject(matcher)) {
        continue;
      }

      const matcherName = asString(matcher.name)?.trim();

      if (!matcherName) {
        continue;
      }

      if (matcher.type === "word") {
        const words = asStringArray(matcher.words)
          .map((word) => word.trim())
          .filter((word) => word.length > 0);

        if (words.length > 0) {
          rules.push({ ...source, matcherName, words });
        }

        continue;
      }

      if (matcher.type === "regex") {
        const patterns = asRegexArray(matcher.regex)
          .flatMap((pattern) => {
            const compiledPattern = compileNucleiRegex(pattern);

            return compiledPattern ? [compiledPattern] : [];
          });

        if (patterns.length > 0) {
          rules.push({ ...source, matcherName, patterns });
        }
      }
    }
  }

  return rules;
}

export function parseNucleiTxtServiceRulesTemplate(templateContents: string): TxtDetectionRule[] {
  return parseNucleiTxtDetectionRulesTemplate(templateContents);
}

function resolveTxtFallbackTemplatePath(source: typeof TXT_FALLBACK_TEMPLATE_SOURCES[number], templatesDir?: string | null) {
  if (source.repoLocal) {
    return fileURLToPath(new URL(`./nuclei-templates/${source.templatePath}`, import.meta.url));
  }

  return templatesDir ? join(templatesDir, source.templatePath) : null;
}

export async function loadStackrayTxtDnsServiceRules(input: {
  templatesDir?: string | null;
  readTemplateFile?: (templatePath: string) => Promise<string>;
}) {
  const rules: TxtDetectionRule[] = [];

  for (const source of TXT_FALLBACK_TEMPLATE_SOURCES) {
    const templatePath = resolveTxtFallbackTemplatePath(source, input.templatesDir);

    if (!templatePath) {
      continue;
    }

    if (input.readTemplateFile) {
      rules.push(...parseNucleiTxtDetectionRulesTemplate(await input.readTemplateFile(templatePath), source));
      continue;
    }

    let cachedRules = txtDetectionRuleCache.get(templatePath);

    if (!cachedRules) {
      cachedRules = readFile(templatePath, "utf8")
        .then((templateContents) => parseNucleiTxtDetectionRulesTemplate(templateContents, source))
        .catch(() => []);
      txtDetectionRuleCache.set(templatePath, cachedRules);
    }

    rules.push(...await cachedRules);
  }

  return rules;
}

function txtRecordMatchesServiceRule(record: string, rule: TxtDetectionRule) {
  const normalizedRecord = record.toLowerCase();

  if (rule.words) {
    return rule.words.some((word) => normalizedRecord.includes(word.toLowerCase()));
  }

  return rule.patterns?.some((pattern) => pattern.test(record)) ?? false;
}

function buildStackrayTxtRecordMatch(input: {
  subject: string;
  txtRecords: readonly string[];
  txtRecordChunks: readonly (readonly string[])[];
}): ParsedNucleiMatch {
  const rawJson = {
    "template-id": TXT_FINGERPRINT_TEMPLATE_ID,
    "template-path": TXT_FINGERPRINT_TEMPLATE_PATH,
    "matcher-name": "regex-1",
    type: "dns",
    severity: "info",
    host: input.subject,
    "matched-at": input.subject,
    "extracted-results": [...input.txtRecords],
    "stackray-source": "node:dns.resolveTxt",
    "stackray-txt-record-chunks": input.txtRecordChunks.map((record) => [...record]),
  };

  return {
    templateId: TXT_FINGERPRINT_TEMPLATE_ID,
    templatePath: TXT_FINGERPRINT_TEMPLATE_PATH,
    matcherName: "regex-1",
    protocolType: "dns",
    severity: "info",
    matchedAt: input.subject,
    host: input.subject,
    ip: null,
    port: null,
    scheme: null,
    url: null,
    path: null,
    extractedResults: [...input.txtRecords],
    technologyName: null,
    technologyVersion: null,
    findingKind: "txt_record",
    subject: input.subject,
    subjectType: "domain",
    rawJson,
  };
}

function buildStackrayTxtDetectionMatch(input: {
  subject: string;
  rule: TxtDetectionRule;
  extractedResults: readonly string[];
  source: string;
}): ParsedNucleiMatch {
  const rawJson = {
    "template-id": input.rule.templateId,
    "template-path": input.rule.templatePath,
    "matcher-name": input.rule.matcherName,
    type: "dns",
    severity: "info",
    host: input.subject,
    "matched-at": input.subject,
    "extracted-results": [...input.extractedResults],
    "stackray-source": input.source,
  };

  return {
    templateId: input.rule.templateId,
    templatePath: input.rule.templatePath,
    matcherName: input.rule.matcherName,
    protocolType: "dns",
    severity: "info",
    matchedAt: input.subject,
    host: input.subject,
    ip: null,
    port: null,
    scheme: null,
    url: null,
    path: null,
    extractedResults: [...input.extractedResults],
    technologyName: input.rule.findingKind === "technology" ? input.rule.matcherName : null,
    technologyVersion: null,
    findingKind: input.rule.findingKind,
    subject: input.subject,
    subjectType: "domain",
    rawJson,
  };
}

export function buildStackrayTxtDetectionMatches(input: {
  subject: string;
  txtRecords: readonly string[];
  rules: readonly TxtDetectionRule[];
  source?: string;
}) {
  return input.rules.flatMap((rule) => {
    const extractedResults = input.txtRecords.filter((record) => txtRecordMatchesServiceRule(record, rule));

    if (extractedResults.length === 0) {
      return [];
    }

    return [buildStackrayTxtDetectionMatch({
      subject: input.subject,
      rule,
      extractedResults,
      source: input.source ?? "stackray:txt-service-rules",
    })];
  });
}

export const buildStackrayTxtDnsServiceMatches = buildStackrayTxtDetectionMatches;

export function buildStackrayResolvedTxtMatches(input: {
  subject: string;
  txtRecords: readonly string[];
  rules: readonly TxtDetectionRule[];
  txtRecordChunks?: readonly (readonly string[])[];
}) {
  if (input.txtRecords.length === 0) {
    return [];
  }

  const txtRecordChunks = input.txtRecordChunks ?? input.txtRecords.map((record) => [record]);

  return [
    buildStackrayTxtRecordMatch({
      subject: input.subject,
      txtRecords: input.txtRecords,
      txtRecordChunks,
    }),
    ...buildStackrayTxtDetectionMatches({
      subject: input.subject,
      txtRecords: input.txtRecords,
      rules: input.rules,
      source: "node:dns.resolveTxt",
    }),
  ];
}

export function selectTxtFallbackSubjects(subjects: readonly string[], matches: readonly ParsedNucleiMatch[]) {
  const subjectsWithTxtRecords = new Set(
    matches.flatMap((match) => match.findingKind === "txt_record" && match.subject ? [match.subject] : []),
  );
  const fallbackSubjects: string[] = [];
  const seen = new Set<string>();

  for (const subject of subjects) {
    if (seen.has(subject) || subjectsWithTxtRecords.has(subject)) {
      continue;
    }

    seen.add(subject);
    fallbackSubjects.push(subject);
  }

  return fallbackSubjects;
}

export async function collectStackrayResolvedTxtMatches(input: {
  subjects: readonly string[];
  existingMatches: readonly ParsedNucleiMatch[];
  templatesDir?: string | null;
  txtDnsServiceRules?: readonly TxtDetectionRule[];
  readTxtDetectionTemplateFile?: (templatePath: string) => Promise<string>;
  resolveTxtRecords?: typeof resolveTxt;
}) {
  const matches: ParsedNucleiMatch[] = [];
  const resolveTxtRecords = input.resolveTxtRecords ?? resolveTxt;
  const txtDnsServiceRules = input.txtDnsServiceRules ?? await loadStackrayTxtDnsServiceRules({
    templatesDir: input.templatesDir,
    readTemplateFile: input.readTxtDetectionTemplateFile,
  });
  const existingTxtRecordsBySubject = new Map<string, string[]>();

  for (const match of input.existingMatches) {
    if (match.findingKind !== "txt_record" || !match.subject || match.extractedResults.length === 0) {
      continue;
    }

    const existingTxtRecords = existingTxtRecordsBySubject.get(match.subject) ?? [];
    existingTxtRecords.push(...match.extractedResults);
    existingTxtRecordsBySubject.set(match.subject, existingTxtRecords);
  }

  for (const subject of new Set(input.subjects)) {
    const existingTxtRecords = existingTxtRecordsBySubject.get(subject);

    if (existingTxtRecords) {
      matches.push(...buildStackrayTxtDetectionMatches({
        subject,
        txtRecords: existingTxtRecords,
        rules: txtDnsServiceRules,
        source: "stackray:existing-txt-record",
      }));
      continue;
    }

    try {
      const txtRecordChunks = await resolveTxtRecords(subject);
      const txtRecords = txtRecordChunks.map((record) => record.join(""));
      matches.push(...buildStackrayResolvedTxtMatches({
        subject,
        txtRecords,
        rules: txtDnsServiceRules,
        txtRecordChunks,
      }));
    } catch {
      // TXT fallback evidence is opportunistic; Nuclei findings still determine the run status.
      continue;
    }
  }

  return matches;
}

function getNucleiMatchDedupeKey(match: ParsedNucleiMatch) {
  const subject = match.subject ?? match.matchedAt ?? "";

  if (match.findingKind === "txt_record") {
    return [match.findingKind, subject].join("::");
  }

  if (match.findingKind === "dns_service") {
    const serviceName = getNucleiDnsServiceTechnologyName(match) ?? match.matcherName ?? "";

    return [match.findingKind, subject, serviceName.trim().toLowerCase()].join("::");
  }

  return [match.findingKind, match.matcherName ?? "", subject].join("::");
}

function mergeNucleiMatchEvidence(existingMatch: ParsedNucleiMatch, nextMatch: ParsedNucleiMatch): ParsedNucleiMatch {
  const extractedResults = [...new Set([...existingMatch.extractedResults, ...nextMatch.extractedResults])];

  if (extractedResults.length === existingMatch.extractedResults.length) {
    return existingMatch;
  }

  return {
    ...existingMatch,
    extractedResults,
    rawJson: {
      ...existingMatch.rawJson,
      "extracted-results": extractedResults,
    },
  };
}

export function mergeUniqueNucleiMatches(matches: readonly ParsedNucleiMatch[]) {
  const mergedMatches: ParsedNucleiMatch[] = [];
  const mergedMatchIndexes = new Map<string, number>();

  for (const match of matches) {
    const key = getNucleiMatchDedupeKey(match);
    const existingIndex = mergedMatchIndexes.get(key);

    if (existingIndex === undefined) {
      mergedMatchIndexes.set(key, mergedMatches.length);
      mergedMatches.push(match);
      continue;
    }

    const existingMatch = mergedMatches[existingIndex];

    if (!existingMatch) {
      mergedMatchIndexes.set(key, mergedMatches.length);
      mergedMatches.push(match);
      continue;
    }

    mergedMatches[existingIndex] = mergeNucleiMatchEvidence(existingMatch, match);
  }

  return mergedMatches;
}

function appendUniqueNucleiMatches(matches: ParsedNucleiMatch[], nextMatches: readonly ParsedNucleiMatch[]) {
  matches.splice(0, matches.length, ...mergeUniqueNucleiMatches([...matches, ...nextMatches]));
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

export function collectUniqueTechnologyNames(technologyNames: readonly (string | null)[]) {
  const visibleTechnologyNames: string[] = [];
  const seen = new Map<string, { index: number; hasVersion: boolean }>();

  for (const technologyName of technologyNames) {
    if (!technologyName) {
      continue;
    }

    const canonicalTechnology = canonicalizeTechnologyLabel(technologyName);
    const normalizedTechnologyName = canonicalTechnology.name.trim().toLowerCase();

    if (!normalizedTechnologyName) {
      continue;
    }

    const label = canonicalTechnology.version ? `${canonicalTechnology.name}:${canonicalTechnology.version}` : canonicalTechnology.name;
    const existing = seen.get(normalizedTechnologyName);

    if (!existing) {
      seen.set(normalizedTechnologyName, {
        index: visibleTechnologyNames.length,
        hasVersion: Boolean(canonicalTechnology.version),
      });
      visibleTechnologyNames.push(label);
      continue;
    }

    if (!existing.hasVersion && canonicalTechnology.version) {
      visibleTechnologyNames[existing.index] = label;
      existing.hasVersion = true;
    }
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

  return args;
}

export function getHttpxBehaviorOptionsForProfile(profile: HttpxRequestProfile): HttpxBehaviorOptions {
  switch (profile) {
    case "baseline":
      return { browserLikeHeaders: false, followRedirects: null };
    case "browser_headers":
      return { browserLikeHeaders: true, followRedirects: null };
  }
}

export function getNextHttpxRequestProfile(profile: HttpxRequestProfile): HttpxRequestProfile | null {
  switch (profile) {
    case "baseline":
      return "browser_headers";
    case "browser_headers":
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
  }
}

function getFallbackReason(profile: HttpxRequestProfile) {
  switch (profile) {
    case "baseline":
      return null;
    case "browser_headers":
      return "blocked_after_baseline";
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

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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
  // Screenshot mode already runs Chrome. Pair it with standard tech detection so
  // the deeper -tdh runtime matcher cannot keep screenshot capture past its timeout.
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

function buildBrowserFallbackCommand(args: string[]) {
  const httpxBin = env.HTTPX_BIN ?? "httpx";

  return {
    command: env.STACKRAY_BROWSER_FALLBACK_XVFB_BIN ?? "xvfb-run",
    args: ["-a", httpxBin, ...args],
  };
}

export function shouldCaptureHomepageScreenshot(result: { statusCode: number | null; contentType: string | null; finalUrl: string | null; path: string | null }) {
  const contentType = result.contentType?.toLowerCase() ?? "";

  if (!result.finalUrl) {
    return false;
  }

  if (result.statusCode === null) {
    return contentType.includes("text/html") || contentType.includes("application/xhtml+xml") || contentType.length === 0;
  }

  const statusCode = result.statusCode;

  if ((statusCode < 200 || statusCode >= 400) && !BLOCKED_HTTP_STATUS_CODES.has(statusCode)) {
    return false;
  }

  return contentType.includes("text/html") || contentType.includes("application/xhtml+xml") || contentType.length === 0;
}

export function isDegradedMachineReadableDocument(result: { statusCode: number | null; title: string | null; contentType: string | null }) {
  const statusCode = result.statusCode ?? 0;
  const title = result.title?.trim() ?? "";
  const contentType = result.contentType?.toLowerCase() ?? "";

  if (statusCode < 200 || statusCode >= 400) {
    return false;
  }

  return title.length === 0 && (contentType.includes("text/markdown") || contentType.includes("text/x-markdown"));
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

async function persistResultRawJsonPatch(result: ScanResultRow, patch: Record<string, unknown>) {
  const [updatedResult] = await db
    .update(scanResults)
    .set({
      rawJson: {
        ...toObject(result.rawJson),
        ...patch,
      },
    })
    .where(eq(scanResults.id, result.id))
    .returning();

  return updatedResult ?? result;
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
  const confidence: BrowserFallbackDecision["confidence"] = hasBlockedStatus && (hasProviderSignal || hasBlockedPageText)
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

async function emitResultEventForRow(result: ScanResultRow, target: Pick<ScanRow, "normalizedTarget">) {
  const persistedTechnologyNames = await getPersistedTechnologyNames(result.id);
  const visibleTechnologies = buildStoredResultVisibleTechnologies(result, [], persistedTechnologyNames ?? undefined);

  await emitEvent(result.scanId, result.attemptId, "scan.result", {
    scanId: result.scanId,
    resultId: result.id,
    target: target.normalizedTarget,
    statusCode: result.statusCode ?? 0,
    finalUrl: result.finalUrl ?? result.url ?? target.normalizedTarget,
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
    let updatedResult: typeof scanResults.$inferSelect | null = null;
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

async function enrichResultWithBrowserFallback(
  result: ScanResultRow,
  target: Pick<ScanRow, "normalizedTarget">,
  decision: BrowserFallbackDecision,
  signal?: AbortSignal,
) {
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
  let processClosed = false;

  const closePromise = new Promise<number>((resolve, reject) => {
    httpx.on("error", reject);
    httpx.on("close", (code) => {
      processClosed = true;
      resolve(code ?? 0);
    });
  });

  const terminateProcess = (reason: Exclude<RunHttpxCliResult["status"], "completed" | "failed">) => {
    if (terminationReason) {
      return;
    }

    terminationReason = reason;

    if (!processClosed) {
      httpx.kill("SIGTERM");
      setTimeout(() => {
        if (!processClosed) {
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
        } catch (error) {
          logWorkerEvent("cancellation_check_failed", {
            errorName: getErrorName(error),
            message: getErrorMessage(error),
          });
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

function getPhaseJobKey(scanId: string, attemptId: string, phase: ScanPhaseKind) {
  return `scan:${scanId}:attempt:${attemptId}:phase:${phase}`;
}

function getHttpProbeScanJobKey(scanId: string) {
  return `scan:${scanId}:http_probe`;
}

async function emitPhaseEvent(phaseRun: typeof scanPhaseRuns.$inferSelect) {
  await emitEvent(phaseRun.scanId, phaseRun.attemptId, "scan.phase", {
    scanId: phaseRun.scanId,
    attemptId: phaseRun.attemptId,
    resultId: phaseRun.resultId,
    phase: phaseRun.phase,
    status: phaseRun.status,
    errorCode: phaseRun.errorCode,
    errorMessage: phaseRun.errorMessage,
    meta: phaseRun.metaJson,
    queuedAt: phaseRun.queuedAt.toISOString(),
    startedAt: phaseRun.startedAt?.toISOString() ?? null,
    completedAt: phaseRun.completedAt?.toISOString() ?? null,
    at: new Date().toISOString(),
  });
}

function normalizePhaseMetaForComparison(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizePhaseMetaForComparison);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, entry]) => [key, normalizePhaseMetaForComparison(entry)]),
    );
  }

  return value;
}

export function phaseMetaEquals(left: unknown, right: unknown) {
  return JSON.stringify(normalizePhaseMetaForComparison(left)) === JSON.stringify(normalizePhaseMetaForComparison(right));
}

function dateTimeEquals(left: Date | null, right: Date | null) {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null);
}

export function phaseRunStateEquals(
  existing: typeof scanPhaseRuns.$inferSelect,
  next: {
    resultId: string | null;
    status: ScanPhaseStatus;
    workerId: string | null;
    jobKey: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    metaJson: Record<string, unknown>;
    startedAt: Date | null;
    completedAt: Date | null;
  },
) {
  return existing.resultId === next.resultId
    && existing.status === next.status
    && existing.workerId === next.workerId
    && existing.jobKey === next.jobKey
    && existing.errorCode === next.errorCode
    && existing.errorMessage === next.errorMessage
    && dateTimeEquals(existing.startedAt, next.startedAt)
    && dateTimeEquals(existing.completedAt, next.completedAt)
    && phaseMetaEquals(existing.metaJson, next.metaJson);
}

async function upsertPhaseRun({
  scanId,
  attemptId,
  resultId = null,
  phase,
  status,
  errorCode = null,
  errorMessage = null,
  metaJson = {},
  jobKey = getPhaseJobKey(scanId, attemptId, phase),
}: {
  scanId: string;
  attemptId: string;
  resultId?: string | null;
  phase: ScanPhaseKind;
  status: ScanPhaseStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  metaJson?: Record<string, unknown>;
  jobKey?: string | null;
}) {
  const now = new Date();
  const [existing] = await db
    .select()
    .from(scanPhaseRuns)
    .where(and(eq(scanPhaseRuns.attemptId, attemptId), eq(scanPhaseRuns.phase, phase)))
    .limit(1);
  const startedAt = status === "running"
    ? existing?.status === "running"
      ? existing.startedAt ?? now
      : now
    : TERMINAL_PHASE_STATUSES.has(status)
      ? existing?.startedAt ?? null
      : null;
  const completedAt = TERMINAL_PHASE_STATUSES.has(status)
    ? existing?.status === status && TERMINAL_PHASE_STATUSES.has(existing.status)
      ? existing.completedAt ?? now
      : now
    : null;
  const workerId = status === "running"
    ? getWorkerId()
    : TERMINAL_PHASE_STATUSES.has(status)
      ? existing?.workerId ?? null
      : null;
  const nextPhaseRunState = {
    resultId,
    status,
    workerId,
    jobKey,
    errorCode,
    errorMessage,
    metaJson,
    startedAt,
    completedAt,
  };

  if (existing && phaseRunStateEquals(existing, nextPhaseRunState)) {
    return existing;
  }

  const [phaseRun] = existing
    ? await db
      .update(scanPhaseRuns)
      .set({
        ...nextPhaseRunState,
        updatedAt: now,
      })
      .where(eq(scanPhaseRuns.id, existing.id))
      .returning()
    : await db
      .insert(scanPhaseRuns)
      .values({
        scanId,
        attemptId,
        resultId,
        phase,
        status,
        workerId,
        jobKey,
        errorCode,
        errorMessage,
        metaJson,
        startedAt,
        completedAt,
        queuedAt: now,
        updatedAt: now,
      })
      .returning();

  if (phaseRun) {
    await emitPhaseEvent(phaseRun);
  }

  if (isEnrichmentPhase(phase) && TERMINAL_PHASE_STATUSES.has(status)) {
    await pokeFinalizePhase(scanId, attemptId);
  }

  return phaseRun ?? null;
}

async function markPhaseRunning(scanId: string, attemptId: string, phase: ScanPhaseKind, resultId?: string | null, metaJson?: Record<string, unknown>) {
  await upsertPhaseRun({ scanId, attemptId, resultId, phase, status: "running", metaJson });
}

async function pokeFinalizePhase(scanId: string, attemptId: string) {
  await enqueuePhaseJob("finalize", { scanId, attemptId }, { jobKeyMode: "replace" });
}

async function markPhaseCompleted(scanId: string, attemptId: string, phase: ScanPhaseKind, resultId?: string | null, metaJson?: Record<string, unknown>) {
  await upsertPhaseRun({ scanId, attemptId, resultId, phase, status: "completed", metaJson });
}

async function markPhaseSkipped(scanId: string, attemptId: string, phase: ScanPhaseKind, reason: string, resultId?: string | null) {
  await upsertPhaseRun({
    scanId,
    attemptId,
    resultId,
    phase,
    status: "skipped",
    errorMessage: reason,
    metaJson: { reason },
  });
}

async function markPhaseFailed(
  scanId: string,
  attemptId: string,
  phase: ScanPhaseKind,
  error: unknown,
  resultId?: string | null,
  metaJson?: Record<string, unknown>,
) {
  const message = error instanceof Error ? error.message : String(error);

  await upsertPhaseRun({
    scanId,
    attemptId,
    resultId,
    phase,
    status: "failed",
    errorCode: "phase_failed",
    errorMessage: message,
    metaJson: { ...metaJson, message },
  });
}

async function enqueuePhaseJob(
  phase: ScanPhaseKind,
  payload: Record<string, unknown>,
  options: { runAt?: Date; jobKeyMode?: "replace" | "preserve_run_at" | "unsafe_dedupe" } = {},
) {
  const scanId = typeof payload.scanId === "string" ? payload.scanId : null;
  const attemptId = typeof payload.attemptId === "string" ? payload.attemptId : null;

  if (!scanId || !attemptId) {
    throw new Error(`Cannot enqueue ${phase} without scanId and attemptId.`);
  }

  await enqueueGraphileJob(db, phase, payload, {
    jobKey: getPhaseJobKey(scanId, attemptId, phase),
    jobKeyMode: options.jobKeyMode ?? "preserve_run_at",
    runAt: options.runAt,
  });
}

async function queuePhase(scanId: string, attemptId: string, phase: ScanPhaseKind, payload: Record<string, unknown>, resultId?: string | null) {
  await queuePhaseRun(scanId, attemptId, phase, resultId);
  await enqueuePhaseJob(phase, payload);
}

async function queuePhaseRun(scanId: string, attemptId: string, phase: ScanPhaseKind, resultId?: string | null) {
  await upsertPhaseRun({
    scanId,
    attemptId,
    resultId,
    phase,
    status: "queued",
  });
}

export async function recoverStaleHttpProbeJobs() {
  const queuedScansWithoutPhase = await db
    .select({
      scanId: scans.id,
      submittedAt: scans.submittedAt,
    })
    .from(scans)
    .where(and(
      eq(scans.status, "queued"),
      isNull(scans.cancellationRequestedAt),
      sql`not exists (
        select 1
        from scan_phase_runs
        where scan_id = ${scans.id}
          and phase = 'http_probe'
      )`,
      sql`not exists (
        select 1
        from graphile_worker.jobs
        where task_identifier in ('http_probe', 'run_scan')
          and "key" = 'scan:' || ${scans.id}::text || ':http_probe'
          and attempts < max_attempts
          and (
            (locked_at is not null and locked_at > now() - make_interval(secs => ${HTTP_PROBE_RECOVERY_LOCK_GRACE_SECONDS}))
            or locked_at is null
          )
      )`,
    ));

  const recoveredScanIds = new Set<string>();

  for (const scan of queuedScansWithoutPhase) {
    const recovered = await db.transaction(async (tx) => {
      const [lockedScan] = await tx
        .select({
          scanId: scans.id,
          submittedAt: scans.submittedAt,
        })
        .from(scans)
        .where(and(
          eq(scans.id, scan.scanId),
          eq(scans.status, "queued"),
          isNull(scans.cancellationRequestedAt),
          sql`not exists (
            select 1
            from scan_phase_runs
            where scan_id = ${scans.id}
              and phase = 'http_probe'
          )`,
          sql`not exists (
            select 1
            from graphile_worker.jobs
            where task_identifier in ('http_probe', 'run_scan')
              and "key" = 'scan:' || ${scans.id}::text || ':http_probe'
              and attempts < max_attempts
              and (
                (locked_at is not null and locked_at > now() - make_interval(secs => ${HTTP_PROBE_RECOVERY_LOCK_GRACE_SECONDS}))
                or locked_at is null
              )
          )`,
        ))
        .limit(1)
        .for("update", { skipLocked: true });

      if (!lockedScan) {
        return false;
      }

      const nowIso = new Date().toISOString();
      await tx.insert(scanEvents).values({
        scanId: lockedScan.scanId,
        attemptId: null,
        eventType: "scan.status",
        payload: {
          scanId: lockedScan.scanId,
          status: "queued",
          recoveryReason: "missing_http_probe_job_requeued",
          at: nowIso,
        },
      });

      await enqueueGraphileJob(tx, "http_probe", { scanId: lockedScan.scanId }, {
        jobKey: getHttpProbeScanJobKey(lockedScan.scanId),
        jobKeyMode: "replace",
        runAt: lockedScan.submittedAt,
      });

      return true;
    });

    if (recovered) {
      recoveredScanIds.add(scan.scanId);
    }
  }

  const stalePhases = await db
    .select({
      phaseRunId: scanPhaseRuns.id,
      scanId: scanPhaseRuns.scanId,
      attemptId: scanPhaseRuns.attemptId,
      submittedAt: scans.submittedAt,
    })
    .from(scanPhaseRuns)
    .innerJoin(scans, eq(scanPhaseRuns.scanId, scans.id))
    .where(and(
      eq(scanPhaseRuns.phase, "http_probe"),
      inArray(scanPhaseRuns.status, ["queued", "running"]),
      inArray(scans.status, ["queued", "running", "processing"]),
      isNull(scans.cancellationRequestedAt),
      sql`not exists (
        select 1
        from graphile_worker.jobs
        where task_identifier in ('http_probe', 'run_scan')
          and "key" = 'scan:' || ${scanPhaseRuns.scanId}::text || ':http_probe'
          and attempts < max_attempts
          and (
            (locked_at is not null and locked_at > now() - make_interval(secs => ${HTTP_PROBE_RECOVERY_LOCK_GRACE_SECONDS}))
            or (${scans.status} = 'queued' and locked_at is null and run_at <= now())
          )
      )`,
    ));

  for (const phase of stalePhases) {
    const message = "HTTP probe was recovered after its worker stopped before completion.";
    const recovered = await db.transaction(async (tx) => {
      const [lockedPhase] = await tx
        .select({
          phaseRunId: scanPhaseRuns.id,
          scanId: scanPhaseRuns.scanId,
          attemptId: scanPhaseRuns.attemptId,
          resultId: scanPhaseRuns.resultId,
          submittedAt: scans.submittedAt,
        })
        .from(scanPhaseRuns)
        .innerJoin(scans, eq(scanPhaseRuns.scanId, scans.id))
        .innerJoin(scanAttempts, eq(scanPhaseRuns.attemptId, scanAttempts.id))
        .where(and(
          eq(scanPhaseRuns.id, phase.phaseRunId),
          eq(scanPhaseRuns.phase, "http_probe"),
          inArray(scanPhaseRuns.status, ["queued", "running"]),
          inArray(scans.status, ["queued", "running", "processing"]),
          isNull(scans.cancellationRequestedAt),
          inArray(scanAttempts.status, ["queued", "running"]),
          sql`not exists (
            select 1
            from graphile_worker.jobs
            where task_identifier in ('http_probe', 'run_scan')
              and "key" = 'scan:' || ${scanPhaseRuns.scanId}::text || ':http_probe'
              and attempts < max_attempts
              and (
                (locked_at is not null and locked_at > now() - make_interval(secs => ${HTTP_PROBE_RECOVERY_LOCK_GRACE_SECONDS}))
                or (${scans.status} = 'queued' and locked_at is null and run_at <= now())
              )
          )`,
        ))
        .limit(1)
        .for("update", { skipLocked: true });

      if (!lockedPhase) {
        return false;
      }

      const now = new Date();
      const completedAtIso = now.toISOString();

      await tx
        .update(scanAttempts)
        .set({
          status: "failed",
          completedAt: now,
          errorCode: "stale_http_probe_recovered",
          errorMessage: message,
        })
        .where(eq(scanAttempts.id, lockedPhase.attemptId));

      await tx
        .update(scanPhaseRuns)
        .set({
          status: "failed",
          workerId: null,
          errorCode: "phase_failed",
          errorMessage: message,
          metaJson: { message },
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(scanPhaseRuns.id, lockedPhase.phaseRunId));

      await tx
        .update(scans)
        .set({
          status: "queued",
          completedAt: null,
          errorCode: null,
          errorMessage: null,
        })
        .where(eq(scans.id, lockedPhase.scanId));

      await tx.insert(scanEvents).values([
        {
          scanId: lockedPhase.scanId,
          attemptId: lockedPhase.attemptId,
          eventType: "scan.phase",
          payload: {
            scanId: lockedPhase.scanId,
            attemptId: lockedPhase.attemptId,
            resultId: lockedPhase.resultId,
            phase: "http_probe",
            status: "failed",
            errorCode: "phase_failed",
            errorMessage: message,
            meta: { message },
            at: completedAtIso,
          },
        },
        {
          scanId: lockedPhase.scanId,
          attemptId: lockedPhase.attemptId,
          eventType: "scan.status",
          payload: {
            scanId: lockedPhase.scanId,
            attemptId: lockedPhase.attemptId,
            status: "queued",
            recoveryReason: "stale_http_probe_recovered",
            at: completedAtIso,
          },
        },
      ]);

      await enqueueGraphileJob(tx, "http_probe", { scanId: lockedPhase.scanId }, {
        jobKey: getHttpProbeScanJobKey(lockedPhase.scanId),
        jobKeyMode: "replace",
        runAt: lockedPhase.submittedAt,
      });

      return true;
    });

    if (recovered) {
      recoveredScanIds.add(phase.scanId);
    }
  }

  if (queuedScansWithoutPhase.length > 0 || stalePhases.length > 0) {
    logWorkerEvent("stale_http_probe_jobs_requeued", {
      count: recoveredScanIds.size,
      queuedScanWithoutPhaseCount: queuedScansWithoutPhase.length,
      stalePhaseCount: stalePhases.length,
    });
  }

  return recoveredScanIds.size;
}

async function getPhaseRunForAttempt(attemptId: string, phase: ScanPhaseKind) {
  const [phaseRun] = await db
    .select()
    .from(scanPhaseRuns)
    .where(and(eq(scanPhaseRuns.attemptId, attemptId), eq(scanPhaseRuns.phase, phase)))
    .limit(1);

  return phaseRun ?? null;
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

async function enqueueQueuedPhase(
  attemptId: string,
  phase: ScanPhaseKind,
  payload: Record<string, unknown>,
  metaJson?: Record<string, unknown>,
) {
  const phaseRun = await getPhaseRunForAttempt(attemptId, phase);

  if (phaseRun?.status !== "queued") {
    return false;
  }

  if (metaJson) {
    await upsertPhaseRun({
      scanId: phaseRun.scanId,
      attemptId,
      resultId: typeof payload.resultId === "string" ? payload.resultId : phaseRun.resultId,
      phase,
      status: "queued",
      metaJson,
    });
  }

  await enqueuePhaseJob(phase, payload, { jobKeyMode: "replace" });
  return true;
}

async function enqueueNucleiDnsAfterHeadless(scanId: string, attemptId: string, resultId: string) {
  await enqueueQueuedPhase(attemptId, "nuclei_dns", { scanId, attemptId, resultId });
}

async function enqueueBrowserFallbackAfterHeadless(
  scanId: string,
  attemptId: string,
  resultId: string,
  decision: BrowserFallbackDecision,
  triggerOptions: BrowserFallbackDecisionOptions,
) {
  await enqueueQueuedPhase(
    attemptId,
    "browser_fallback",
    { scanId, attemptId, resultId },
    buildBrowserFallbackPhaseMeta(decision, triggerOptions),
  );
}

async function enqueueIpIntelAfterBrowserEnrichment(scanId: string, attemptId: string, resultId: string) {
  const result = await getScanResultForPhase(scanId, attemptId, resultId);

  if (!result) {
    await markPhaseFailed(scanId, attemptId, "ip_intel", new Error("IP intel phase could not find its scan result."), resultId);
    return false;
  }

  if (!result.hostIp) {
    await markPhaseSkipped(scanId, attemptId, "ip_intel", "Authoritative result did not include a host IP.", resultId);
    return false;
  }

  return enqueueQueuedPhase(attemptId, "ip_intel", { scanId, attemptId, resultId });
}

async function enqueueNucleiHttpAfterDns(scanId: string, attemptId: string, resultId: string) {
  await enqueueQueuedPhase(attemptId, "nuclei_http", { scanId, attemptId, resultId });
}

async function isCancellationRequested(scanId: string) {
  try {
    const [scan] = await db
      .select({ cancellationRequestedAt: scans.cancellationRequestedAt })
      .from(scans)
      .where(eq(scans.id, scanId))
      .limit(1);

    return scan?.cancellationRequestedAt !== null;
  } catch (error) {
    logWorkerEvent("scan_cancellation_check_failed", {
      scanId,
      errorName: getErrorName(error),
      message: getErrorMessage(error),
    });

    return false;
  }
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
      .orderBy(asc(scans.submittedAt), asc(scans.id))
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

      const now = new Date();
      const queuedAtIso = now.toISOString();
      const [httpProbePhase] = await tx
        .insert(scanPhaseRuns)
        .values({
          scanId: claimedScan.id,
          attemptId: attempt.id,
          phase: "http_probe",
          status: "queued",
          jobKey: getHttpProbeScanJobKey(claimedScan.id),
          metaJson: {},
          queuedAt: now,
          updatedAt: now,
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

      if (httpProbePhase) {
        await tx.insert(scanEvents).values({
          scanId: claimedScan.id,
          attemptId: attempt.id,
          eventType: "scan.phase",
          payload: {
            scanId: claimedScan.id,
            attemptId: attempt.id,
            resultId: null,
            phase: "http_probe",
            status: "queued",
            errorCode: null,
            errorMessage: null,
            meta: {},
            queuedAt: queuedAtIso,
            startedAt: null,
            completedAt: null,
            at: queuedAtIso,
          },
        });
      }

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

    const now = new Date();
    const queuedAtIso = now.toISOString();
    const [httpProbePhase] = await tx
      .insert(scanPhaseRuns)
      .values({
        scanId: claimedScan.scan.id,
        attemptId: attempt.id,
        phase: "http_probe",
        status: "queued",
        jobKey: getHttpProbeScanJobKey(claimedScan.scan.id),
        metaJson: { requestProfile: profile, fallbackReason },
        queuedAt: now,
        updatedAt: now,
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

    if (httpProbePhase) {
      await tx.insert(scanEvents).values({
        scanId: claimedScan.scan.id,
        attemptId: attempt.id,
        eventType: "scan.phase",
        payload: {
          scanId: claimedScan.scan.id,
          attemptId: attempt.id,
          resultId: null,
          phase: "http_probe",
          status: "queued",
          errorCode: null,
          errorMessage: null,
          meta: { requestProfile: profile, fallbackReason },
          queuedAt: queuedAtIso,
          startedAt: null,
          completedAt: null,
          at: queuedAtIso,
        },
      });
    }

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
      title: scanResults.title,
      contentType: scanResults.contentType,
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
    authoritativeResultTitle: authoritativeResult?.result.title ?? null,
    authoritativeResultContentType: authoritativeResult?.result.contentType ?? null,
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
      title: candidate.result.title ?? null,
      contentType: candidate.result.contentType ?? null,
      input: candidate.input,
      url: candidate.url,
      finalUrl: candidate.finalUrl,
      matchedOn: candidate.matchedOn,
      matchesPrimaryTarget: candidate.matchesPrimaryTarget,
    })),
    selectedResultId: attemptSummary.authoritativeResultId,
    selectedResultStatus: attemptSummary.authoritativeResultStatusCode,
    selectedResultTitle: attemptSummary.authoritativeResultTitle,
    selectedResultContentType: attemptSummary.authoritativeResultContentType,
    selectedResultUrl: attemptSummary.authoritativeResult?.url ?? null,
    selectedResultFinalUrl: attemptSummary.authoritativeResult?.finalUrl ?? null,
    selectedMatchSource: attemptSummary.authoritativeResult?.matchedOn ?? null,
    forbiddenResultCount: attemptSummary.forbiddenResultCount,
    resultCount: attemptSummary.resultCount,
  };
}

export function buildAttemptFallbackDecision(
  requestProfile: HttpxRequestProfile,
  summary: Pick<
    AttemptResultSummary,
    "authoritativeResultStatusCode" | "authoritativeResultTitle" | "authoritativeResultContentType" | "authoritativeRetryUrl"
  >,
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

  if (!BLOCKED_HTTP_STATUS_CODES.has(summary.authoritativeResultStatusCode)) {
    if (
      nextProfile
      && isDegradedMachineReadableDocument({
        statusCode: summary.authoritativeResultStatusCode,
        title: summary.authoritativeResultTitle,
        contentType: summary.authoritativeResultContentType,
      })
    ) {
      return {
        shouldFallback: true,
        nextProfile,
        retryUrl: summary.authoritativeRetryUrl,
        reason: "authoritative_result_degraded",
      };
    }

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

function formatFallbackAttemptReason(
  requestProfile: HttpxRequestProfile,
  fallbackDecision: AttemptFallbackDecision,
  summary: Pick<AttemptResultSummary, "authoritativeResultStatusCode" | "authoritativeResultContentType">,
) {
  if (fallbackDecision.reason === "authoritative_result_degraded") {
    return `Received degraded ${summary.authoritativeResultContentType ?? "unknown content"} result after ${getRequestProfileLabel(requestProfile)}.`;
  }

  return `Received authoritative ${summary.authoritativeResultStatusCode ?? "missing"} after ${getRequestProfileLabel(requestProfile)}.`;
}

export function buildRetryTargets(
  target: Pick<ScanRow, "normalizedTarget">,
) {
  return [getHttpxExecutionTarget(target.normalizedTarget)];
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

async function deleteNucleiTechnologyDetections(resultId: string) {
  await db
    .delete(scanResultDetections)
    .where(
      and(
        eq(scanResultDetections.resultId, resultId),
        eq(scanResultDetections.kind, "technology"),
        eq(scanResultDetections.source, "nuclei"),
      ),
    );
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

type NucleiPhaseGroup = "dns" | "http";

function filterNucleiExecutionPhasesForGroup(phases: readonly NucleiExecutionPhase[], group: NucleiPhaseGroup) {
  return phases.filter((phase) => group === "dns" ? phase.subjectType === "domain" : phase.subjectType === "url");
}

function getNucleiPhaseGroupLabel(group: NucleiPhaseGroup) {
  return group === "dns" ? "nuclei_dns" : "nuclei_http";
}

async function deleteNucleiMatchesForExecutionPhases(runId: string, executionPhases: readonly NucleiExecutionPhase[]) {
  const templateIds = [...new Set(executionPhases.flatMap((phase) => phase.templateIds))];

  if (templateIds.length === 0) {
    return;
  }

  await db
    .delete(scanResultNucleiMatches)
    .where(and(eq(scanResultNucleiMatches.runId, runId), inArray(scanResultNucleiMatches.templateId, templateIds)));
}

async function insertNucleiMatches(runId: string, resultId: string, matches: readonly ParsedNucleiMatch[]) {
  if (matches.length === 0) {
    return;
  }

  await db.insert(scanResultNucleiMatches).values(
    matches.map((match) => ({
      runId,
      resultId,
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

async function rebuildNucleiTechnologyDetections(result: ScanResultRow) {
  const matches = await db
    .select({
      findingKind: scanResultNucleiMatches.findingKind,
      matcherName: scanResultNucleiMatches.matcherName,
      technologyName: scanResultNucleiMatches.technologyName,
      technologyVersion: scanResultNucleiMatches.technologyVersion,
    })
    .from(scanResultNucleiMatches)
    .where(eq(scanResultNucleiMatches.resultId, result.id));

  await deleteNucleiTechnologyDetections(result.id);

  const nucleiTechnologyRows = buildNucleiTechnologyDetectionRows({
    resultId: result.id,
    matches,
  });

  if (nucleiTechnologyRows.length > 0) {
    await db.insert(scanResultDetections).values(nucleiTechnologyRows);
  }

  await updateResultSearchDocument(result, []);
  return nucleiTechnologyRows;
}

async function enrichResultWithNucleiPhaseGroup(
  scanId: string,
  scanTarget: Pick<ScanRow, "normalizedTarget">,
  result: ScanResultRow,
  group: NucleiPhaseGroup,
) {
  const nucleiTargets = selectNucleiTargets(scanTarget, result);
  const allExecutionPhases = buildNucleiExecutionPhases(nucleiTargets);
  const executionPhases = filterNucleiExecutionPhasesForGroup(allExecutionPhases, group);
  const phaseLabel = getNucleiPhaseGroupLabel(group);
  const nucleiLogPayload = buildNucleiLogPayload(
    nucleiTargets.targetUrl,
    nucleiTargets.targetHost,
    nucleiTargets.originalDomainTarget,
    nucleiTargets.finalDomainTarget,
    nucleiTargets.domainTarget,
  );

  if (executionPhases.length === 0) {
    logWorkerEvent("nuclei_phase_skipped", {
      scanId,
      resultId: result.id,
      phase: phaseLabel,
      reason: "missing_nuclei_targets",
      ...nucleiLogPayload,
    });
    return {
      status: "skipped" as const,
      matchCount: 0,
      technologyCount: 0,
      errorMessage: "No Nuclei targets were available for this phase.",
    };
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

  await deleteNucleiMatchesForExecutionPhases(run.id, executionPhases);
  await rebuildNucleiTechnologyDetections(result);

  logWorkerEvent("nuclei_phase_started", {
    scanId,
    resultId: result.id,
    phase: phaseLabel,
    executionPhaseCount: executionPhases.length,
    ...nucleiLogPayload,
  });

  try {
    const matches: ParsedNucleiMatch[] = [];

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

        await insertNucleiMatches(run.id, result.id, mergeUniqueNucleiMatches(matches));
        const nucleiTechnologyRows = await rebuildNucleiTechnologyDetections(result);
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

        logWorkerEvent("nuclei_phase_failed", {
          scanId,
          resultId: result.id,
          phase: phaseLabel,
          status: nucleiResult.status,
          exitCode: nucleiResult.exitCode,
          message: errorMessage,
          failedSubject: phase.subject,
          failedSubjectType: phase.subjectType,
          ...nucleiLogPayload,
        });

        return {
          status: "failed" as const,
          matchCount: matches.length,
          technologyCount: nucleiTechnologyRows.length,
          errorMessage,
        };
      }
    }

    if (group === "dns") {
      appendUniqueNucleiMatches(
        matches,
        await collectStackrayResolvedTxtMatches({
          subjects: executionPhases.flatMap((phase) => phase.subjectType === "domain" ? [phase.subject] : []),
          existingMatches: matches,
          templatesDir: env.NUCLEI_TEMPLATES_DIR ?? null,
        }),
      );
    }

    const uniqueMatches = mergeUniqueNucleiMatches(matches);
    await insertNucleiMatches(run.id, result.id, uniqueMatches);
    const nucleiTechnologyRows = await rebuildNucleiTechnologyDetections(result);

    logWorkerEvent("nuclei_phase_completed", {
      scanId,
      resultId: result.id,
      phase: phaseLabel,
      matchCount: uniqueMatches.length,
      technologyCount: nucleiTechnologyRows.length,
      findingCount: uniqueMatches.length - nucleiTechnologyRows.length,
      executionPhaseCount: executionPhases.length,
      durationMs: Date.now() - startedAt.getTime(),
      ...nucleiLogPayload,
    });

    return {
      status: "completed" as const,
      matchCount: uniqueMatches.length,
      technologyCount: nucleiTechnologyRows.length,
      errorMessage: null,
    };
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
    await rebuildNucleiTechnologyDetections(result);

    logWorkerEvent("nuclei_phase_failed", {
      scanId,
      resultId: result.id,
      phase: phaseLabel,
      status: "exception",
      message: errorMessage,
      ...nucleiLogPayload,
    });

    return {
      status: "failed" as const,
      matchCount: 0,
      technologyCount: 0,
      errorMessage,
    };
  }
}

async function createSubdomainDiscoveryRun(
  claimedScan: ClaimedScan,
  status: SubdomainDiscoveryRunStatus,
  targetDomain: string | null,
  errorMessage: string | null = null,
) {
  const [run] = await db
    .insert(scanSubdomainDiscoveryRuns)
    .values({
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      status,
      targetDomain,
      errorMessage,
      startedAt: status === "skipped" ? null : new Date(),
      completedAt: status === "skipped" ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: scanSubdomainDiscoveryRuns.attemptId,
      set: {
        status,
        targetDomain,
        errorMessage,
        resultCount: 0,
        startedAt: status === "skipped" ? null : new Date(),
        completedAt: status === "skipped" ? new Date() : null,
      },
    })
    .returning();

  await db
    .delete(scanSubdomains)
    .where(eq(scanSubdomains.runId, run.id));

  return run;
}

async function completeSubdomainDiscoveryRun(
  runId: string,
  status: SubdomainDiscoveryRunStatus,
  resultCount: number,
  errorMessage: string | null = null,
) {
  await db
    .update(scanSubdomainDiscoveryRuns)
    .set({
      status,
      resultCount,
      errorMessage,
      completedAt: new Date(),
    })
    .where(eq(scanSubdomainDiscoveryRuns.id, runId));
}

async function emitSubdomainProgress(claimedScan: ClaimedScan, subdomainCount: number) {
  const resultCount = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(scanResults)
    .where(eq(scanResults.attemptId, claimedScan.attempt.id));

  await emitEvent(claimedScan.scan.id, claimedScan.attempt.id, "scan.progress", {
    scanId: claimedScan.scan.id,
    resultCount: resultCount[0]?.value ?? 0,
    subdomainCount,
    at: new Date().toISOString(),
  });
}

async function enrichAttemptWithSubfinder(
  claimedScan: ClaimedScan,
  signal?: AbortSignal,
): Promise<
  | { status: "completed" }
  | { status: "cancelled" }
  | { status: "aborted" }
  | { status: "failed"; errorMessage: string }
> {
  const targetDomain = getRegistrableDomain(claimedScan.target.normalizedTarget);

  if (!targetDomain) {
    await createSubdomainDiscoveryRun(claimedScan, "skipped", null, "Scan target does not have a registrable domain.");
    logWorkerEvent("subfinder_discovery_skipped", {
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      target: claimedScan.target.normalizedTarget,
      reason: "no_registrable_domain",
    });
    return { status: "completed" };
  }

  const run = await createSubdomainDiscoveryRun(claimedScan, "running", targetDomain);
  const seen = new Set<string>();
  let resultCount = 0;

  logWorkerEvent("subfinder_discovery_started", {
    scanId: claimedScan.scan.id,
    attemptId: claimedScan.attempt.id,
    targetDomain,
  });

  const result = await runSubfinderCli({
    command: env.SUBFINDER_BIN ?? "subfinder",
    args: buildSubfinderArguments(targetDomain, {
      sourceTimeoutSeconds: DEFAULT_SUBFINDER_SOURCE_TIMEOUT_SECONDS,
      maxTimeMinutes: DEFAULT_SUBFINDER_MAX_TIME_MINUTES,
    }),
    timeoutMs: DEFAULT_SUBFINDER_PROCESS_TIMEOUT_MS,
    signal,
    shouldCancel: async () => isCancellationRequested(claimedScan.scan.id),
    onJsonLine: async (payload) => {
      const parsed = parseSubfinderJsonLine(payload);

      if (!parsed || parsed.host === targetDomain || !parsed.host.endsWith(`.${targetDomain}`)) {
        return;
      }

      const source = parsed.source ?? (parsed.sources.length === 1 ? parsed.sources[0] : null);
      const ipKey = parsed.ip?.toLowerCase() ?? "";
      const sourceKey = source?.toLowerCase() ?? "";
      const key = [parsed.host, ipKey, sourceKey].join("\0");

      if (seen.has(key)) {
        return;
      }

      seen.add(key);

      const inserted = await db
        .insert(scanSubdomains)
        .values({
          scanId: claimedScan.scan.id,
          attemptId: claimedScan.attempt.id,
          runId: run.id,
          rootDomain: targetDomain,
          host: parsed.host,
          ip: parsed.ip,
          ipKey,
          source,
          sourceKey,
          wildcardCertificate: parsed.wildcardCertificate,
          rawJson: parsed.rawJson,
        })
        .onConflictDoNothing()
        .returning({ id: scanSubdomains.id });

      if (inserted.length > 0) {
        resultCount += 1;
      }
    },
  }).catch((error: unknown) => ({
    status: "failed" as const,
    exitCode: 1,
    stderr: error instanceof Error ? error.message : "Subfinder failed.",
  }));

  if (result.status === "cancelled") {
    await completeSubdomainDiscoveryRun(run.id, "skipped", resultCount, "Scan was cancelled.");
    logWorkerEvent("subfinder_discovery_cancelled", {
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      targetDomain,
      resultCount,
    });
    return { status: "cancelled" };
  }

  if (result.status === "aborted") {
    await completeSubdomainDiscoveryRun(run.id, "failed", resultCount, "Worker shutdown interrupted subdomain discovery.");
    logWorkerEvent("subfinder_discovery_aborted", {
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      targetDomain,
      resultCount,
    });
    return { status: "aborted" };
  }

  if (result.status === "completed") {
    await completeSubdomainDiscoveryRun(run.id, "completed", resultCount);
    await emitSubdomainProgress(claimedScan, resultCount);
    logWorkerEvent("subfinder_discovery_completed", {
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      targetDomain,
      resultCount,
    });
    return { status: "completed" };
  }

  if (result.status === "timed_out") {
    const timeoutMessage = `Subfinder timed out after ${DEFAULT_SUBFINDER_PROCESS_TIMEOUT_MS}ms; using partial results.`;
    await completeSubdomainDiscoveryRun(run.id, "completed", resultCount, timeoutMessage);
    await emitSubdomainProgress(claimedScan, resultCount);
    logWorkerEvent("subfinder_discovery_timed_out", {
      scanId: claimedScan.scan.id,
      attemptId: claimedScan.attempt.id,
      targetDomain,
      resultCount,
      timeoutMs: DEFAULT_SUBFINDER_PROCESS_TIMEOUT_MS,
      message: result.stderr || timeoutMessage,
    });
    return { status: "completed" };
  }

  const errorMessage = result.stderr || `subfinder ${result.status}`;
  await completeSubdomainDiscoveryRun(run.id, "failed", resultCount, errorMessage);
  logWorkerEvent("subfinder_discovery_failed", {
    scanId: claimedScan.scan.id,
    attemptId: claimedScan.attempt.id,
    targetDomain,
    status: result.status,
    resultCount,
    message: errorMessage,
  });
  return { status: "failed", errorMessage };
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

  await emitEvent(claimedScan.scan.id, claimedScan.attempt.id, "scan.progress", {
    scanId: claimedScan.scan.id,
    resultCount: resultCount.value,
    at: new Date().toISOString(),
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

async function createNoJsonHttpProbePlaceholderResult(
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
    await markPhaseRunning(claimedScan.scan.id, claimedScan.attempt.id, "http_probe");

    while (true) {
      activeAttemptCompleted = false;
      const resultCount = { value: 0 };
      const requestProfile =
        activeClaimedScan.attempt.metaJson?.requestProfile === "browser_headers" ? "browser_headers" : "baseline";
      const activeFallbackReason =
        typeof activeClaimedScan.attempt.metaJson?.fallbackReason === "string"
          ? activeClaimedScan.attempt.metaJson.fallbackReason
          : getFallbackReason(requestProfile);
      const activeScanId = activeClaimedScan.scan.id;
      const activeAttemptId = activeClaimedScan.attempt.id;
      const activeAttemptNumber = activeClaimedScan.attempt.attemptNumber;

      const result = await runHttpxCli({
        command: env.HTTPX_BIN ?? "httpx",
        args: buildHttpxArguments(activeClaimedScan.scan, getHttpxBehaviorOptionsForProfile(requestProfile)),
        targets: retryTargets,
        timeoutMs: DEFAULT_SCAN_TIMEOUT_MS,
        signal,
        shouldCancel: async () => isCancellationRequested(activeScanId),
        onJsonLine: async (payload) => {
          await persistHttpxResult(activeClaimedScan, payload, resultCount);
        },
      });

      if (result.status === "cancelled") {
        logWorkerEvent("scan_attempt_cancelled", {
          scanId: activeScanId,
          attemptId: activeAttemptId,
          attemptNumber: activeAttemptNumber,
          requestProfile,
        });
        await markAttemptCancelled(activeClaimedScan);
        await upsertPhaseRun({
          scanId: activeScanId,
          attemptId: activeAttemptId,
          phase: "http_probe",
          status: "cancelled",
          errorMessage: "Scan was cancelled.",
        });
        return;
      }

      if (result.status === "timed_out") {
        logWorkerEvent("scan_attempt_failed", {
          scanId: activeScanId,
          attemptId: activeAttemptId,
          attemptNumber: activeAttemptNumber,
          requestProfile,
          reason: "worker_timeout",
        });
        await markAttemptFailed(activeClaimedScan, "worker_timeout", "httpx scan timed out.");
        await upsertPhaseRun({
          scanId: activeScanId,
          attemptId: activeAttemptId,
          phase: "http_probe",
          status: "failed",
          errorCode: "worker_timeout",
          errorMessage: "httpx scan timed out.",
        });
        return;
      }

      if (result.status === "aborted") {
        logWorkerEvent("scan_attempt_failed", {
          scanId: activeScanId,
          attemptId: activeAttemptId,
          attemptNumber: activeAttemptNumber,
          requestProfile,
          reason: "worker_shutdown",
        });
        await markAttemptFailed(activeClaimedScan, "worker_shutdown", "Worker shutdown interrupted the scan.");
        await upsertPhaseRun({
          scanId: activeScanId,
          attemptId: activeAttemptId,
          phase: "http_probe",
          status: "failed",
          errorCode: "worker_shutdown",
          errorMessage: "Worker shutdown interrupted the scan.",
        });
        return;
      }

      if (result.status === "failed") {
        logWorkerEvent("scan_attempt_failed", {
          scanId: activeScanId,
          attemptId: activeAttemptId,
          attemptNumber: activeAttemptNumber,
          requestProfile,
          reason: `httpx_exit_${result.exitCode}`,
          message: result.stderr || null,
        });
        await markAttemptFailed(activeClaimedScan, `httpx_exit_${result.exitCode}`, result.stderr);
        await upsertPhaseRun({
          scanId: activeScanId,
          attemptId: activeAttemptId,
          phase: "http_probe",
          status: "failed",
          errorCode: `httpx_exit_${result.exitCode}`,
          errorMessage: result.stderr,
        });
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
          activeFallbackReason,
          attemptSummary.resultCount,
          attemptSummary.forbiddenResultCount,
        ),
      );
      activeAttemptCompleted = true;

      if (!fallbackDecision.shouldFallback) {
        let authoritativeResult = attemptSummary.authoritativeResultId
          ? (await db
            .select()
            .from(scanResults)
            .where(eq(scanResults.id, attemptSummary.authoritativeResultId))
            .limit(1))[0] ?? null
          : null;
        const createdNoJsonPlaceholder =
          !authoritativeResult
          && fallbackDecision.reason === "fallback_exhausted"
          && attemptSummary.resultCount === 0
            ? await createNoJsonHttpProbePlaceholderResult(
              activeClaimedScan,
              requestProfile,
              activeFallbackReason ?? getFallbackReason(requestProfile) ?? "http_probe_no_output",
            )
            : null;

        authoritativeResult ??= createdNoJsonPlaceholder;

        logWorkerEvent("scan_attempt_post_processing_target", {
          ...selectionTracePayload,
          retryUrl: attemptSummary.authoritativeRetryUrl,
          postProcessingTarget: createdNoJsonPlaceholder
            ? "http_probe_no_output_placeholder"
            : authoritativeResult
              ? "authoritative_result"
              : "none",
        });

        if (await isCancellationRequested(activeScanId)) {
          await markAttemptCancelled(activeClaimedScan);
          await upsertPhaseRun({
            scanId: activeScanId,
            attemptId: activeAttemptId,
            phase: "http_probe",
            status: "cancelled",
            errorMessage: "Scan was cancelled.",
          });
          return;
        }

        await markScanProcessing(activeClaimedScan);
        await markPhaseCompleted(activeScanId, activeAttemptId, "http_probe", authoritativeResult?.id ?? null, {
          resultCount: attemptSummary.resultCount,
          selectedResultId: authoritativeResult?.id ?? null,
          selectedResultStatusCode: authoritativeResult?.statusCode ?? null,
          provisionalResultKind: createdNoJsonPlaceholder ? "http_probe_no_output" : null,
        });
        await queueEnrichmentPhaseJobs(activeClaimedScan, authoritativeResult);
        return;
      }

      const nextProfile = fallbackDecision.nextProfile;

      if (nextProfile === null) {
        throw new Error("Fallback decision requested a retry without a next request profile.");
      }

      activeClaimedScan = await createFallbackAttempt(
        activeClaimedScan,
        nextProfile,
        formatFallbackAttemptReason(requestProfile, fallbackDecision, attemptSummary),
      );
      activeAttemptCompleted = false;
      await markPhaseSkipped(activeScanId, activeAttemptId, "http_probe", "A fallback HTTP probe attempt superseded this attempt.");
      await markPhaseRunning(activeClaimedScan.scan.id, activeClaimedScan.attempt.id, "http_probe");
      retryTargets = buildRetryTargets(activeClaimedScan.target);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker execution failed.";

    if (activeAttemptCompleted) {
      await markScanFailedAfterAttemptCompletion(activeClaimedScan, "worker_exception", message);
      await markPhaseFailed(activeClaimedScan.scan.id, activeClaimedScan.attempt.id, "http_probe", error);
      return;
    }

    await markAttemptFailed(activeClaimedScan, "worker_exception", message);
    await markPhaseFailed(activeClaimedScan.scan.id, activeClaimedScan.attempt.id, "http_probe", error);
  }
}

async function claimQueuedScanById(scanId: string): Promise<ClaimedScan | null> {
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

      const now = new Date();
      const queuedAtIso = now.toISOString();
      const [httpProbePhase] = await tx
        .insert(scanPhaseRuns)
        .values({
          scanId: claimedScan.id,
          attemptId: attempt.id,
          phase: "http_probe",
          status: "queued",
          jobKey: getHttpProbeScanJobKey(claimedScan.id),
          metaJson: {},
          queuedAt: now,
          updatedAt: now,
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

      if (httpProbePhase) {
        await tx.insert(scanEvents).values({
          scanId: claimedScan.id,
          attemptId: attempt.id,
          eventType: "scan.phase",
          payload: {
            scanId: claimedScan.id,
            attemptId: attempt.id,
            resultId: null,
            phase: "http_probe",
            status: "queued",
            errorCode: null,
            errorMessage: null,
            meta: {},
            queuedAt: queuedAtIso,
            startedAt: null,
            completedAt: null,
            at: queuedAtIso,
          },
        });
      }

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

async function getClaimedScanForAttempt(scanId: string, attemptId: string): Promise<ClaimedScan | null> {
  const [scan] = await db
    .select()
    .from(scans)
    .where(eq(scans.id, scanId))
    .limit(1);

  if (!scan) {
    return null;
  }

  const [attempt] = await db
    .select()
    .from(scanAttempts)
    .where(and(eq(scanAttempts.id, attemptId), eq(scanAttempts.scanId, scanId)))
    .limit(1);

  if (!attempt) {
    return null;
  }

  return {
    scan,
    attempt,
    target: {
      inputTarget: scan.inputTarget,
      normalizedTarget: scan.normalizedTarget,
      canonicalTargetId: scan.canonicalTargetId,
    },
  } satisfies ClaimedScan;
}

async function getScanResultForPhase(scanId: string, attemptId: string, resultId: string): Promise<ScanResultRow | null> {
  const [result] = await db
    .select()
    .from(scanResults)
    .where(and(eq(scanResults.id, resultId), eq(scanResults.scanId, scanId), eq(scanResults.attemptId, attemptId)))
    .limit(1);

  return result ?? null;
}

async function queueEnrichmentPhaseJobs(claimedScan: ClaimedScan, authoritativeResult: ScanResultRow | null) {
  const scanId = claimedScan.scan.id;
  const attemptId = claimedScan.attempt.id;

  await queuePhase(scanId, attemptId, "subfinder", { scanId, attemptId });

  if (!authoritativeResult) {
    await markPhaseSkipped(scanId, attemptId, "headless", "No authoritative HTTP result was selected.");
    await markPhaseSkipped(scanId, attemptId, "browser_fallback", "No authoritative HTTP result was selected.");
    await markPhaseSkipped(scanId, attemptId, "nuclei_dns", "No authoritative HTTP result was selected.");
    await markPhaseSkipped(scanId, attemptId, "nuclei_http", "No authoritative HTTP result was selected.");
    await markPhaseSkipped(scanId, attemptId, "ip_intel", "No authoritative HTTP result was selected.");
  } else {
    const resultId = authoritativeResult.id;
    await Promise.all([
      queuePhase(scanId, attemptId, "headless", { scanId, attemptId, resultId }, resultId),
      queuePhaseRun(scanId, attemptId, "browser_fallback", resultId),
      queuePhaseRun(scanId, attemptId, "nuclei_dns", resultId),
      queuePhaseRun(scanId, attemptId, "nuclei_http", resultId),
      queuePhaseRun(scanId, attemptId, "ip_intel", resultId),
    ]);
  }

  await queuePhase(scanId, attemptId, "finalize", { scanId, attemptId });
}

async function getPhaseRunsForAttempt(attemptId: string) {
  return db
    .select()
    .from(scanPhaseRuns)
    .where(eq(scanPhaseRuns.attemptId, attemptId));
}

async function finalizeNucleiRunAggregate(claimedScan: ClaimedScan, result: ScanResultRow | null, phaseRuns: readonly (typeof scanPhaseRuns.$inferSelect)[]) {
  if (!result) {
    return;
  }

  const nucleiPhases = phaseRuns.filter((phaseRun) => phaseRun.phase === "nuclei_dns" || phaseRun.phase === "nuclei_http");

  if (nucleiPhases.length === 0 || nucleiPhases.some((phaseRun) => !TERMINAL_PHASE_STATUSES.has(phaseRun.status))) {
    return;
  }

  const nucleiTargets = selectNucleiTargets(claimedScan.target, result);
  const [existingRun] = await db
    .select()
    .from(scanResultNucleiRuns)
    .where(eq(scanResultNucleiRuns.resultId, result.id))
    .limit(1);
  const aggregateStatus: NucleiRunStatus = nucleiPhases.some((phaseRun) => phaseRun.status === "failed")
    ? "failed"
    : nucleiPhases.some((phaseRun) => phaseRun.status === "completed")
      ? "completed"
    : "skipped";
  const errorMessages = nucleiPhases.flatMap((phaseRun) => phaseRun.errorMessage ? [`${phaseRun.phase}: ${phaseRun.errorMessage}`] : []);

  await upsertNucleiRunState({
    resultId: result.id,
    status: aggregateStatus,
    targetUrl: nucleiTargets.targetUrl,
    targetHost: nucleiTargets.targetHost,
    originalDomainTarget: nucleiTargets.originalDomainTarget,
    finalDomainTarget: nucleiTargets.finalDomainTarget,
    domainTarget: nucleiTargets.domainTarget,
    errorMessage: errorMessages.length > 0 ? errorMessages.join(" | ") : null,
    startedAt: existingRun?.startedAt ?? nucleiPhases.find((phaseRun) => phaseRun.startedAt)?.startedAt ?? new Date(),
    completedAt: new Date(),
  });
  await rebuildNucleiTechnologyDetections(result);
}

async function getFinalizationResult(claimedScan: ClaimedScan) {
  const summary = await summarizeAttemptResults(claimedScan);

  if (!summary.authoritativeResultId) {
    return null;
  }

  return getScanResultForPhase(claimedScan.scan.id, claimedScan.attempt.id, summary.authoritativeResultId);
}

export async function runScanById(scanId: string, signal?: AbortSignal) {
  const claimedScan = await claimQueuedScanById(scanId);

  if (!claimedScan) {
    return false;
  }

  await runClaimedScan(claimedScan, signal);
  return true;
}

export const runHttpProbeById = runScanById;

export async function runHeadlessPhaseById(scanId: string, attemptId: string, resultId: string, signal?: AbortSignal) {
  const claimedScan = await getClaimedScanForAttempt(scanId, attemptId);
  const result = await getScanResultForPhase(scanId, attemptId, resultId);

  if (!claimedScan || !result) {
    await markPhaseFailed(scanId, attemptId, "headless", new Error("Headless phase could not find its scan attempt or result."), resultId);
    await markPhaseFailed(scanId, attemptId, "browser_fallback", new Error("Browser fallback phase could not run because headless could not find its scan attempt or result."), resultId);
    await markPhaseFailed(scanId, attemptId, "nuclei_dns", new Error("Nuclei DNS phase could not run because headless could not find its scan attempt or result."), resultId);
    await markPhaseFailed(scanId, attemptId, "nuclei_http", new Error("Nuclei HTTP phase could not run because headless could not find its scan attempt or result."), resultId);
    await markPhaseFailed(scanId, attemptId, "ip_intel", new Error("IP intel phase could not run because headless could not find its scan attempt or result."), resultId);
    return false;
  }

  await markPhaseRunning(scanId, attemptId, "headless", resultId);

  try {
    const screenshotTarget = {
      normalizedTarget: result.finalUrl ?? result.url ?? claimedScan.target.normalizedTarget,
    } satisfies Pick<ScanRow, "normalizedTarget">;
    const updatedResult = await enrichResultWithHeadless(result, screenshotTarget, signal);

    await markPhaseCompleted(scanId, attemptId, "headless", resultId, {
      screenshotAvailable: Boolean(updatedResult.screenshotObjectKey),
      title: updatedResult.title ?? null,
      faviconUrl: updatedResult.faviconUrl ?? null,
    });
    const headlessScreenshotMissing =
      screenshotStorageEnabled()
      && shouldCaptureHomepageScreenshot(updatedResult)
      && !updatedResult.screenshotObjectKey;
    const fallbackTriggerOptions = { headlessScreenshotMissing };
    const fallbackDecision = buildBrowserFallbackDecision(updatedResult, fallbackTriggerOptions);
    if (fallbackDecision.shouldRun) {
      await enqueueBrowserFallbackAfterHeadless(scanId, attemptId, resultId, fallbackDecision, fallbackTriggerOptions);
    } else {
      await markPhaseSkipped(scanId, attemptId, "browser_fallback", fallbackDecision.reason, resultId);
      await enqueueIpIntelAfterBrowserEnrichment(scanId, attemptId, resultId);
      await enqueueNucleiDnsAfterHeadless(scanId, attemptId, resultId);
    }
    return true;
  } catch (error) {
    console.warn("Headless enrichment failed", {
      scanId,
      resultId,
      message: error instanceof Error ? error.message : "Unknown headless enrichment error",
    });
    await markPhaseFailed(scanId, attemptId, "headless", error, resultId);
    const fallbackTriggerOptions = { headlessFailed: true };
    const fallbackDecision = buildBrowserFallbackDecision(result, fallbackTriggerOptions);
    if (fallbackDecision.shouldRun) {
      await enqueueBrowserFallbackAfterHeadless(scanId, attemptId, resultId, fallbackDecision, fallbackTriggerOptions);
    } else {
      await markPhaseSkipped(scanId, attemptId, "browser_fallback", fallbackDecision.reason, resultId);
      await enqueueIpIntelAfterBrowserEnrichment(scanId, attemptId, resultId);
      await enqueueNucleiDnsAfterHeadless(scanId, attemptId, resultId);
    }
    return false;
  }
}

export async function runBrowserFallbackPhaseById(scanId: string, attemptId: string, resultId: string, signal?: AbortSignal) {
  const claimedScan = await getClaimedScanForAttempt(scanId, attemptId);
  const result = await getScanResultForPhase(scanId, attemptId, resultId);

  if (!claimedScan || !result) {
    await markPhaseFailed(scanId, attemptId, "browser_fallback", new Error("Browser fallback phase could not find its scan attempt or result."), resultId);
    await markPhaseFailed(scanId, attemptId, "nuclei_dns", new Error("Nuclei DNS phase could not run because browser fallback could not find its scan attempt or result."), resultId);
    await markPhaseFailed(scanId, attemptId, "nuclei_http", new Error("Nuclei HTTP phase could not run because browser fallback could not find its scan attempt or result."), resultId);
    await markPhaseFailed(scanId, attemptId, "ip_intel", new Error("IP intel phase could not run because browser fallback could not find its scan attempt or result."), resultId);
    return false;
  }

  const phaseRun = await getPhaseRunForAttempt(attemptId, "browser_fallback");
  const fallbackTriggerOptions = buildBrowserFallbackDecisionOptionsFromMeta(phaseRun?.metaJson);
  const fallbackDecision = buildBrowserFallbackDecision(result, fallbackTriggerOptions);
  const fallbackPhaseMeta = buildBrowserFallbackPhaseMeta(fallbackDecision, fallbackTriggerOptions);

  if (!fallbackDecision.shouldRun) {
    await markPhaseSkipped(scanId, attemptId, "browser_fallback", fallbackDecision.reason, resultId);
    await enqueueIpIntelAfterBrowserEnrichment(scanId, attemptId, resultId);
    await enqueueNucleiDnsAfterHeadless(scanId, attemptId, resultId);
    return false;
  }

  await markPhaseRunning(scanId, attemptId, "browser_fallback", resultId, fallbackPhaseMeta);

  try {
    const fallbackTarget = {
      normalizedTarget: result.finalUrl ?? result.url ?? claimedScan.target.normalizedTarget,
    } satisfies Pick<ScanRow, "normalizedTarget">;
    const fallbackResult = await enrichResultWithBrowserFallback(result, fallbackTarget, fallbackDecision, signal);

    if (fallbackResult.run.status !== "completed") {
      throw new Error(fallbackResult.run.stderr || `Browser fallback exited with status ${fallbackResult.run.status}.`);
    }

    await markPhaseCompleted(scanId, attemptId, "browser_fallback", resultId, {
      ...fallbackPhaseMeta,
      outcome: fallbackResult.outcome,
      recovered: fallbackResult.recovered,
    });
    await enqueueIpIntelAfterBrowserEnrichment(scanId, attemptId, resultId);
    await enqueueNucleiDnsAfterHeadless(scanId, attemptId, resultId);
    return fallbackResult.recovered;
  } catch (error) {
    console.warn("Browser fallback failed", {
      scanId,
      resultId,
      message: error instanceof Error ? error.message : "Unknown browser fallback error",
    });
    await markPhaseFailed(scanId, attemptId, "browser_fallback", error, resultId, fallbackPhaseMeta);
    await enqueueIpIntelAfterBrowserEnrichment(scanId, attemptId, resultId);
    await enqueueNucleiDnsAfterHeadless(scanId, attemptId, resultId);
    return false;
  }
}

export async function runSubfinderPhaseById(scanId: string, attemptId: string, signal?: AbortSignal) {
  const claimedScan = await getClaimedScanForAttempt(scanId, attemptId);

  if (!claimedScan) {
    await markPhaseFailed(scanId, attemptId, "subfinder", new Error("Subfinder phase could not find its scan attempt."));
    return false;
  }

  await markPhaseRunning(scanId, attemptId, "subfinder");

  try {
    const result = await enrichAttemptWithSubfinder(claimedScan, signal);

    if (result.status === "cancelled") {
      await markAttemptCancelled(claimedScan);
      await upsertPhaseRun({
        scanId,
        attemptId,
        phase: "subfinder",
        status: "cancelled",
        errorMessage: "Scan was cancelled.",
      });
      return false;
    }

    if (result.status === "aborted") {
      await markAttemptFailed(claimedScan, "worker_shutdown", "Worker shutdown interrupted the scan.");
      await upsertPhaseRun({
        scanId,
        attemptId,
        phase: "subfinder",
        status: "failed",
        errorCode: "worker_shutdown",
        errorMessage: "Worker shutdown interrupted the scan.",
      });
      return false;
    }

    if (result.status === "failed") {
      await markPhaseFailed(scanId, attemptId, "subfinder", new Error(result.errorMessage));
      return false;
    }

    await markPhaseCompleted(scanId, attemptId, "subfinder");
    return true;
  } catch (error) {
    await markPhaseFailed(scanId, attemptId, "subfinder", error);
    return false;
  }
}

export async function runNucleiDnsPhaseById(scanId: string, attemptId: string, resultId: string) {
  return runNucleiPhaseById(scanId, attemptId, resultId, "dns");
}

export async function runNucleiHttpPhaseById(scanId: string, attemptId: string, resultId: string) {
  return runNucleiPhaseById(scanId, attemptId, resultId, "http");
}

async function runNucleiPhaseById(scanId: string, attemptId: string, resultId: string, group: NucleiPhaseGroup) {
  const phase = group === "dns" ? "nuclei_dns" : "nuclei_http";
  const claimedScan = await getClaimedScanForAttempt(scanId, attemptId);
  const result = await getScanResultForPhase(scanId, attemptId, resultId);

  if (!claimedScan || !result) {
    await markPhaseFailed(scanId, attemptId, phase, new Error(`${phase} could not find its scan attempt or result.`), resultId);
    if (group === "dns") {
      await markPhaseFailed(scanId, attemptId, "nuclei_http", new Error("Nuclei HTTP phase could not run because nuclei DNS could not find its scan attempt or result."), resultId);
    }
    return false;
  }

  await markPhaseRunning(scanId, attemptId, phase, resultId);
  const phaseResult = await enrichResultWithNucleiPhaseGroup(scanId, claimedScan.target, result, group);

  if (phaseResult.status === "skipped") {
    await markPhaseSkipped(scanId, attemptId, phase, phaseResult.errorMessage, resultId);
    if (group === "dns") {
      await enqueueNucleiHttpAfterDns(scanId, attemptId, resultId);
    }
    return true;
  }

  if (phaseResult.status === "failed") {
    await upsertPhaseRun({
      scanId,
      attemptId,
      resultId,
      phase,
      status: "failed",
      errorCode: "nuclei_failed",
      errorMessage: phaseResult.errorMessage,
      metaJson: {
        matchCount: phaseResult.matchCount,
        technologyCount: phaseResult.technologyCount,
      },
    });
    if (group === "dns") {
      await enqueueNucleiHttpAfterDns(scanId, attemptId, resultId);
    }
    return false;
  }

  await markPhaseCompleted(scanId, attemptId, phase, resultId, {
    matchCount: phaseResult.matchCount,
    technologyCount: phaseResult.technologyCount,
  });
  if (group === "dns") {
    await enqueueNucleiHttpAfterDns(scanId, attemptId, resultId);
  }
  return true;
}

export async function runIpIntelPhaseById(scanId: string, attemptId: string, resultId: string) {
  const result = await getScanResultForPhase(scanId, attemptId, resultId);

  if (!result) {
    await markPhaseFailed(scanId, attemptId, "ip_intel", new Error("IP intel phase could not find its scan result."), resultId);
    return false;
  }

  if (!result.hostIp) {
    await markPhaseSkipped(scanId, attemptId, "ip_intel", "Authoritative result did not include a host IP.", resultId);
    return true;
  }

  await markPhaseRunning(scanId, attemptId, "ip_intel", resultId, { hostIp: result.hostIp });

  try {
    await enrichIpAddress(result.hostIp);
    await markPhaseCompleted(scanId, attemptId, "ip_intel", resultId, { hostIp: result.hostIp });
    return true;
  } catch (error) {
    await markPhaseFailed(scanId, attemptId, "ip_intel", error, resultId);
    return false;
  }
}

export async function finalizeScanById(scanId: string, attemptId: string) {
  const claimedScan = await getClaimedScanForAttempt(scanId, attemptId);

  if (!claimedScan) {
    await markPhaseFailed(scanId, attemptId, "finalize", new Error("Finalize phase could not find its scan attempt."));
    return false;
  }

  if (claimedScan.scan.status === "completed") {
    await markPhaseCompleted(scanId, attemptId, "finalize");
    return true;
  }

  if (claimedScan.scan.status === "failed" || claimedScan.scan.status === "cancelled") {
    await markPhaseSkipped(scanId, attemptId, "finalize", `Scan is already ${claimedScan.scan.status}.`);
    return false;
  }

  await markPhaseRunning(scanId, attemptId, "finalize");

  const phaseRuns = await getPhaseRunsForAttempt(attemptId);
  const phaseByKind = new Map(phaseRuns.map((phaseRun) => [phaseRun.phase, phaseRun]));
  const pendingPhases = ENRICHMENT_PHASES.filter((phase) => {
    const phaseRun = phaseByKind.get(phase);
    return !phaseRun || !TERMINAL_PHASE_STATUSES.has(phaseRun.status);
  });

  if (pendingPhases.length > 0) {
    await upsertPhaseRun({
      scanId,
      attemptId,
      phase: "finalize",
      status: "queued",
      metaJson: { waitingFor: pendingPhases },
    });
    await enqueuePhaseJob("finalize", { scanId, attemptId }, { runAt: new Date(Date.now() + FINALIZE_RETRY_DELAY_MS) });
    return false;
  }

  if (await isCancellationRequested(scanId)) {
    await markAttemptCancelled(claimedScan);
    await upsertPhaseRun({
      scanId,
      attemptId,
      phase: "finalize",
      status: "cancelled",
      errorMessage: "Scan was cancelled.",
    });
    return false;
  }

  const result = await getFinalizationResult(claimedScan);
  await finalizeNucleiRunAggregate(claimedScan, result, phaseRuns);
  const [resultCount] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(scanResults)
    .where(eq(scanResults.attemptId, attemptId));

  await markScanCompleted(claimedScan, resultCount?.value ?? 0);
  await markPhaseCompleted(scanId, attemptId, "finalize", result?.id ?? null, {
    resultCount: resultCount?.value ?? 0,
  });
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
