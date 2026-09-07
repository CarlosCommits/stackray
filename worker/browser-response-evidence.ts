import type { scanResults } from "../drizzle/schema.ts";
import type { HttpxJson } from "./httpx.ts";

type ScanResultRow = typeof scanResults.$inferSelect;

export type BrowserResponseEvidence = {
  finalUrl: string | null;
  statusCode: number | null;
  title: string | null;
  webServer: string | null;
  contentType: string | null;
  contentLength: number | null;
  words: number | null;
  lines: number | null;
  location: string | null;
  bodyPreview: string | null;
  rawHeaders: string | null;
  responseHeadersJson: Record<string, unknown>;
  hashesJson: Record<string, unknown>;
  redirectChainStatusCodes: number[];
  redirectChainJson: Record<string, unknown>[];
  failed: boolean;
};

export type BrowserResponsePromotion = Partial<Pick<
  ScanResultRow,
  | "finalUrl"
  | "statusCode"
  | "title"
  | "webServer"
  | "contentType"
  | "contentLength"
  | "words"
  | "lines"
  | "location"
  | "bodyPreview"
  | "rawHeaders"
  | "responseHeadersJson"
  | "hashesJson"
  | "redirectChainStatusCodes"
  | "redirectChainJson"
  | "failed"
>>;

type BrowserResponsePromotionSource = Pick<
  ScanResultRow,
  "statusCode" | "title" | "contentType"
> & Partial<Pick<
  ScanResultRow,
  "redirectChainStatusCodes" | "redirectChainJson"
>>;

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => (
      typeof entry === "object" && entry !== null && !Array.isArray(entry)
    ))
    : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
    : [];
}

function redirectItemRequestUrl(item: Record<string, unknown>) {
  return asString(item["request-url"] ?? item.requestUrl ?? item.url);
}

function hasObservedRedirectChain(chain: readonly Record<string, unknown>[] | null | undefined) {
  return chain?.some((item) => redirectItemRequestUrl(item) !== null) ?? false;
}

function compactBrowserRedirectChain(evidence: BrowserResponseEvidence) {
  const chain: Record<string, unknown>[] = [];
  const statusCodes: number[] = [];
  let previousUrl: string | null = null;

  for (const [index, item] of evidence.redirectChainJson.entries()) {
    const requestUrl = redirectItemRequestUrl(item);

    if (!requestUrl) {
      continue;
    }

    const normalizedUrl = requestUrl.trim();
    if (normalizedUrl === previousUrl) {
      continue;
    }

    chain.push(item);
    const statusCode = evidence.redirectChainStatusCodes[index];
    if (statusCode !== undefined) {
      statusCodes.push(statusCode);
    }
    previousUrl = normalizedUrl;
  }

  return { chain, statusCodes };
}

export function extractBrowserResponseEvidence(payload: HttpxJson): BrowserResponseEvidence {
  const response = asObject(payload.browser_response);

  return {
    finalUrl: asString(response.final_url) ?? asString(response.url),
    statusCode: asNumber(response.status_code),
    title: asString(response.title)?.trim() || null,
    webServer: asString(response.webserver),
    contentType: asString(response.content_type),
    contentLength: asNumber(response.content_length),
    words: asNumber(response.words),
    lines: asNumber(response.lines),
    location: asString(response.location),
    bodyPreview: asString(response.body_preview),
    rawHeaders: asString(response.raw_header),
    responseHeadersJson: asObject(response.header),
    hashesJson: asObject(response.hash),
    redirectChainStatusCodes: asNumberArray(response.chain_status_codes),
    redirectChainJson: asObjectArray(response.chain),
    failed: asBoolean(response.failed),
  };
}

function isChallengeTitle(value: string | null) {
  const title = value?.trim().toLowerCase() ?? "";
  return title === "access denied"
    || title === "forbidden"
    || title === "checking your browser..."
    || title === "vercel security checkpoint"
    || title.includes("just a moment");
}

export function shouldPromoteBrowserResponse(
  result: BrowserResponsePromotionSource,
  evidence: BrowserResponseEvidence,
) {
  const browserRecovered = evidence.statusCode !== null
    && evidence.statusCode >= 200
    && evidence.statusCode < 400;
  if (!browserRecovered) return false;

  const contentType = result.contentType?.toLowerCase() ?? "";
  const degradedMachineDocument = !result.title
    && (contentType.includes("text/markdown") || contentType.includes("text/x-markdown"));

  return result.statusCode === null
    || result.statusCode >= 400
    || isChallengeTitle(result.title)
    || degradedMachineDocument;
}

export function buildBrowserResponsePromotion(
  result: BrowserResponsePromotionSource,
  evidence: BrowserResponseEvidence,
): BrowserResponsePromotion {
  if (!shouldPromoteBrowserResponse(result, evidence)) return {};

  const retainHttpxRedirectChain = hasObservedRedirectChain(result.redirectChainJson);
  const browserRedirectChain = compactBrowserRedirectChain(evidence);

  return {
    finalUrl: evidence.finalUrl,
    statusCode: evidence.statusCode,
    title: evidence.title,
    webServer: evidence.webServer,
    contentType: evidence.contentType,
    contentLength: evidence.contentLength,
    words: evidence.words,
    lines: evidence.lines,
    location: evidence.location,
    bodyPreview: evidence.bodyPreview,
    rawHeaders: evidence.rawHeaders,
    responseHeadersJson: evidence.responseHeadersJson,
    hashesJson: evidence.hashesJson,
    redirectChainStatusCodes: retainHttpxRedirectChain
      ? result.redirectChainStatusCodes ?? []
      : browserRedirectChain.statusCodes,
    redirectChainJson: retainHttpxRedirectChain
      ? result.redirectChainJson ?? []
      : browserRedirectChain.chain,
    failed: evidence.failed,
  };
}
