import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { type NextRequest, NextResponse } from "next/server";

import { actorAuthErrorResponse, requireSessionOrBearerActor } from "@/lib/session/actor-auth";
import { errorResponse } from "@/lib/server/http/error-response";

const maxRedirects = 3;
const maxImageBytes = 5 * 1024 * 1024;
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

  if (prefixLength === 0) {
    return true;
  }

  const shift = BigInt(128 - prefixLength);

  return (ipValue >> shift) === (prefixValue >> shift);
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

async function assertFetchableImageUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP image URLs can be proxied.");
  }

  if (url.username || url.password || !allowedPorts.has(url.port)) {
    throw new Error("Image URL is not allowed.");
  }

  if (isIP(url.hostname)) {
    if (isPrivateOrSpecialIp(url.hostname)) {
      throw new Error("Image URL host is not allowed.");
    }

    return;
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });

  if (addresses.length === 0 || addresses.some((address) => isPrivateOrSpecialIp(address.address))) {
    throw new Error("Image URL host is not allowed.");
  }
}

async function fetchImage(url: URL, redirectCount = 0): Promise<Response> {
  await assertFetchableImageUrl(url);

  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      Accept: "image/avif,image/webp,image/svg+xml,image/*,*/*;q=0.8",
      "User-Agent": "Stackray image proxy",
    },
  });

  if (response.status >= 300 && response.status < 400) {
    if (redirectCount >= maxRedirects) {
      throw new Error("Too many image redirects.");
    }

    const location = response.headers.get("location");

    if (!location) {
      throw new Error("Image redirect was missing a location.");
    }

    return fetchImage(new URL(location, url), redirectCount + 1);
  }

  return response;
}

export async function GET(request: NextRequest) {
  try {
    await requireSessionOrBearerActor(request);

    const rawUrl = request.nextUrl.searchParams.get("url");

    if (!rawUrl || rawUrl.length > 4096) {
      return errorResponse(400, "invalid_image_url", "A valid image URL is required.");
    }

    let imageUrl: URL;

    try {
      imageUrl = new URL(rawUrl);
    } catch {
      return errorResponse(400, "invalid_image_url", "A valid image URL is required.");
    }

    const response = await fetchImage(imageUrl);

    if (!response.ok) {
      return errorResponse(502, "image_fetch_failed", "The image could not be fetched.");
    }

    const contentLength = response.headers.get("content-length");

    if (contentLength && Number.parseInt(contentLength, 10) > maxImageBytes) {
      return errorResponse(413, "image_too_large", "The image is too large to proxy.");
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";

    if (!contentType.toLowerCase().startsWith("image/") && contentType.toLowerCase() !== "application/octet-stream") {
      return errorResponse(415, "unsupported_image_type", "The proxied asset is not an image.");
    }

    const body = await response.arrayBuffer();

    if (body.byteLength > maxImageBytes) {
      return errorResponse(413, "image_too_large", "The image is too large to proxy.");
    }

    return new NextResponse(body, {
      headers: {
        "Cache-Control": "private, max-age=86400",
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    return actorAuthErrorResponse(error)
      ?? errorResponse(403, "image_proxy_forbidden", error instanceof Error ? error.message : "Image proxy request was rejected.");
  }
}
