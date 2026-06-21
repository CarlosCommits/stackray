import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { scanResults } from "@/lib/db/schema";
import { actorAuthErrorResponse, requireSessionOrBearerActor } from "@/lib/session/actor-auth";
import { errorResponse } from "@/lib/server/http/error-response";
import { getScanRecord } from "@/lib/server/scans/read-service";

const maxRedirects = 3;
const maxFaviconBytes = 1024 * 1024;
const allowedPorts = new Set(["", "80", "443"]);

function isPrivateOrSpecialIpv4(value: string) {
  const parts = value.split(".").map((part) => Number.parseInt(part, 10));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [first, second] = parts as [number, number, number, number];

  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 0 && parts[2] === 0)
    || (first === 192 && second === 0 && parts[2] === 2)
    || (first === 192 && second === 168)
    || (first === 198 && (second === 18 || second === 19))
    || (first === 198 && second === 51 && parts[2] === 100)
    || (first === 203 && second === 0 && parts[2] === 113)
    || first >= 224;
}

function ipv4ToBigInt(ip: string) {
  return ip
    .split(".")
    .map((part) => BigInt(Number.parseInt(part, 10)))
    .reduce((accumulator, part) => (accumulator << BigInt(8)) + part, BigInt(0));
}

function parseIpv6ToBigInt(ip: string) {
  const normalizedIp = ip.split("%", 1)[0]?.toLowerCase() ?? "";
  const ipv4Match = normalizedIp.match(/(.+):(\d{1,3}(?:\.\d{1,3}){3})$/);
  const compressionParts = normalizedIp.split("::");

  if (compressionParts.length > 2) {
    return null;
  }

  if (ipv4Match && isIP(ipv4Match[2]!) !== 4) {
    return null;
  }

  const expandedIp = ipv4Match
    ? `${ipv4Match[1]}:${ipv4ToBigInt(ipv4Match[2]!)
        .toString(16)
        .padStart(8, "0")
        .match(/.{1,4}/g)!
        .join(":")}`
    : normalizedIp;
  const [head = "", tail = ""] = expandedIp.split("::");
  const hasCompression = expandedIp.includes("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missingPartCount = hasCompression ? 8 - headParts.length - tailParts.length : 0;
  const parts = hasCompression
    ? [...headParts, ...Array.from({ length: missingPartCount }, () => "0"), ...tailParts]
    : headParts;

  if (
    parts.length !== 8
    || missingPartCount < 0
    || parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))
  ) {
    return null;
  }

  return parts.reduce((accumulator, part) => (accumulator << BigInt(16)) + BigInt(Number.parseInt(part, 16)), BigInt(0));
}

function ipv6InPrefix(ip: string, prefix: string, prefixLength: number) {
  const ipValue = parseIpv6ToBigInt(ip);
  const prefixValue = parseIpv6ToBigInt(prefix);

  if (ipValue === null || prefixValue === null) {
    return true;
  }

  return (ipValue >> BigInt(128 - prefixLength)) === (prefixValue >> BigInt(128 - prefixLength));
}

function isPrivateOrSpecialIpv6(value: string) {
  return ipv6InPrefix(value, "::", 128)
    || ipv6InPrefix(value, "::1", 128)
    || ipv6InPrefix(value, "::ffff:0:0", 96)
    || ipv6InPrefix(value, "64:ff9b::", 96)
    || ipv6InPrefix(value, "64:ff9b:1::", 48)
    || ipv6InPrefix(value, "100::", 64)
    || ipv6InPrefix(value, "2001::", 32)
    || ipv6InPrefix(value, "2001:2::", 48)
    || ipv6InPrefix(value, "2001:10::", 28)
    || ipv6InPrefix(value, "2001:db8::", 32)
    || ipv6InPrefix(value, "2002::", 16)
    || ipv6InPrefix(value, "fc00::", 7)
    || ipv6InPrefix(value, "fe80::", 10)
    || ipv6InPrefix(value, "ff00::", 8);
}

function isPrivateOrSpecialIp(value: string) {
  if (isIP(value) === 4) {
    return isPrivateOrSpecialIpv4(value);
  }

  if (isIP(value) === 6) {
    return isPrivateOrSpecialIpv6(value);
  }

  return true;
}

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/\.+$/g, "");
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isLikelyMmh3Hash(value: string) {
  return /^-?\d+$/.test(value);
}

function resolveFaviconCandidate(candidate: string | null, baseUrl: string | null) {
  if (!candidate || isLikelyMmh3Hash(candidate)) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = /^https?:\/\//i.test(candidate)
      ? new URL(candidate)
      : baseUrl
        ? new URL(candidate, baseUrl)
        : new URL(candidate);
  } catch {
    return null;
  }

  return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
}

function resolveResultFaviconUrl(result: {
  faviconUrl: string | null;
  faviconPath: string | null;
  finalUrl: string | null;
  url: string | null;
  rawJson: Record<string, unknown>;
}) {
  const baseUrl = asString(result.finalUrl) ?? asString(result.url);
  const rawFavicon = asString(result.rawJson.favicon);
  const rawFaviconUrl = asString(result.rawJson.favicon_url);
  const rawFaviconPath = asString(result.rawJson.favicon_path);

  for (const candidate of [
    result.faviconUrl,
    rawFaviconUrl,
    result.faviconPath,
    rawFaviconPath,
    rawFavicon,
  ]) {
    const faviconUrl = resolveFaviconCandidate(candidate, baseUrl);

    if (faviconUrl) {
      return faviconUrl;
    }
  }

  return null;
}

function resolveResultFallbackFaviconUrl(result: {
  finalUrl: string | null;
  url: string | null;
}) {
  const baseUrl = asString(result.finalUrl) ?? asString(result.url);

  if (!baseUrl) {
    return null;
  }

  let parsedBaseUrl: URL;

  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    return null;
  }

  if (parsedBaseUrl.protocol !== "http:" && parsedBaseUrl.protocol !== "https:") {
    return null;
  }

  const hostname = normalizeHostname(parsedBaseUrl.hostname);

  if (!hostname || hostname === "localhost" || (isIP(hostname) && isPrivateOrSpecialIp(hostname))) {
    return null;
  }

  const fallbackUrl = new URL("https://www.google.com/s2/favicons");
  fallbackUrl.searchParams.set("domain", hostname);
  fallbackUrl.searchParams.set("sz", "128");

  return fallbackUrl;
}

async function assertFetchableFaviconUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP favicon URLs can be proxied.");
  }

  if (url.username || url.password || !allowedPorts.has(url.port)) {
    throw new Error("Favicon URL is not allowed.");
  }

  if (isIP(url.hostname)) {
    if (isPrivateOrSpecialIp(url.hostname)) {
      throw new Error("Favicon URL host is not allowed.");
    }

    return;
  }

  const addresses = await lookup(normalizeHostname(url.hostname), { all: true, verbatim: true });

  if (addresses.length === 0 || addresses.some((address) => isPrivateOrSpecialIp(address.address))) {
    throw new Error("Favicon URL host is not allowed.");
  }
}

async function fetchFavicon(url: URL, redirectCount = 0): Promise<Response> {
  await assertFetchableFaviconUrl(url);

  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      Accept: "image/avif,image/webp,image/svg+xml,image/*,*/*;q=0.8",
      "User-Agent": "Stackray favicon proxy",
    },
  });

  if (response.status >= 300 && response.status < 400) {
    if (redirectCount >= maxRedirects) {
      throw new Error("Too many favicon redirects.");
    }

    const location = response.headers.get("location");

    if (!location) {
      throw new Error("Favicon redirect was missing a location.");
    }

    return fetchFavicon(new URL(location, url), redirectCount + 1);
  }

  return response;
}

function sniffFaviconContentType(body: Uint8Array, declaredContentType: string | null) {
  const declaredType = declaredContentType?.split(";", 1)[0]?.trim().toLowerCase() ?? null;

  if (declaredType?.startsWith("image/")) {
    return declaredContentType ?? declaredType;
  }

  if (
    body[0] === 0x89
    && body[1] === 0x50
    && body[2] === 0x4e
    && body[3] === 0x47
  ) {
    return "image/png";
  }

  if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    return "image/jpeg";
  }

  const asciiPrefix = new TextDecoder().decode(body.slice(0, Math.min(body.length, 512))).trimStart().toLowerCase();

  if (asciiPrefix.startsWith("<svg") || asciiPrefix.startsWith("<?xml") && asciiPrefix.includes("<svg")) {
    return "image/svg+xml";
  }

  if (asciiPrefix.startsWith("gif87a") || asciiPrefix.startsWith("gif89a")) {
    return "image/gif";
  }

  if (asciiPrefix.startsWith("riff") && asciiPrefix.slice(8, 12) === "webp") {
    return "image/webp";
  }

  if (body[0] === 0x00 && body[1] === 0x00 && body[2] === 0x01 && body[3] === 0x00) {
    return "image/x-icon";
  }

  return null;
}

async function buildFaviconResponse(response: Response) {
  if (!response.ok) {
    return null;
  }

  const contentLength = response.headers.get("content-length");

  if (contentLength && Number.parseInt(contentLength, 10) > maxFaviconBytes) {
    return errorResponse(413, "favicon_too_large", "The favicon is too large to proxy.");
  }

  const body = await response.arrayBuffer();

  if (body.byteLength > maxFaviconBytes) {
    return errorResponse(413, "favicon_too_large", "The favicon is too large to proxy.");
  }

  const contentType = sniffFaviconContentType(new Uint8Array(body), response.headers.get("content-type"));

  if (!contentType) {
    return null;
  }

  return new NextResponse(body, {
    headers: {
      "Cache-Control": "private, max-age=86400",
      "Content-Security-Policy": "sandbox; default-src 'none'; script-src 'none'; img-src data:; style-src 'unsafe-inline'",
      "Content-Type": contentType,
      "Cross-Origin-Resource-Policy": "same-origin",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ scanId: string; resultId: string }> },
) {
  try {
    const actor = await requireSessionOrBearerActor(request);
    const { scanId, resultId } = await context.params;
    const scan = await getScanRecord(actor, scanId);

    if (!scan) {
      return errorResponse(404, "scan_not_found", "The requested scan could not be found.");
    }

    const [result] = await db
      .select({
        faviconUrl: scanResults.faviconUrl,
        faviconPath: scanResults.faviconPath,
        finalUrl: scanResults.finalUrl,
        url: scanResults.url,
        rawJson: scanResults.rawJson,
      })
      .from(scanResults)
      .where(and(eq(scanResults.scanId, scanId), eq(scanResults.id, resultId)))
      .limit(1);

    if (!result) {
      return errorResponse(404, "scan_result_not_found", "The requested scan result could not be found.");
    }

    const faviconUrl = resolveResultFaviconUrl(result);

    if (!faviconUrl) {
      return errorResponse(404, "favicon_not_found", "No favicon URL is available for this scan result.");
    }

    const response = await fetchFavicon(faviconUrl);
    const proxiedResponse = await buildFaviconResponse(response);

    if (proxiedResponse) {
      return proxiedResponse;
    }

    const fallbackFaviconUrl = resolveResultFallbackFaviconUrl(result);

    if (fallbackFaviconUrl) {
      const fallbackResponse = await fetchFavicon(fallbackFaviconUrl);
      const proxiedFallbackResponse = await buildFaviconResponse(fallbackResponse);

      if (proxiedFallbackResponse) {
        return proxiedFallbackResponse;
      }
    }

    return response.ok
      ? errorResponse(415, "unsupported_favicon_type", "The proxied favicon is not an image.")
      : errorResponse(502, "favicon_fetch_failed", "The favicon could not be fetched.");
  } catch (error) {
    return actorAuthErrorResponse(error)
      ?? errorResponse(403, "favicon_proxy_forbidden", error instanceof Error ? error.message : "Favicon proxy request was rejected.");
  }
}
