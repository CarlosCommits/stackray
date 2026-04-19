import { isIP } from "node:net";

import { z } from "zod";

const hostnameSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9.-]+$/i, "Target contains unsupported characters.");

type NormalizedTarget = {
  inputTarget: string;
  normalizedTarget: string;
  targetType: "url" | "host" | "domain";
};

function isPrivateIpv4Address(host: string): boolean {
  const parts = host.split(".").map((part) => Number.parseInt(part, 10));

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  if (parts[0] === 10 || parts[0] === 127) {
    return true;
  }

  if (parts[0] === 169 && parts[1] === 254) {
    return true;
  }

  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }

  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }

  return false;
}

function isPrivateIpv6Address(host: string): boolean {
  const normalized = host.toLowerCase();

  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

function assertPublicHost(host: string) {
  const normalizedHost = host.trim().toLowerCase();

  if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(normalizedHost)) {
    throw new Error("Private and localhost targets are not allowed.");
  }

  const ipVersion = isIP(normalizedHost);

  if (ipVersion === 4 && isPrivateIpv4Address(normalizedHost)) {
    throw new Error("Private IPv4 targets are not allowed.");
  }

  if (ipVersion === 6 && isPrivateIpv6Address(normalizedHost)) {
    throw new Error("Private IPv6 targets are not allowed.");
  }
}

function normalizeUrlTarget(value: string): NormalizedTarget {
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https targets are supported.");
  }

  if (url.username || url.password) {
    throw new Error("Targets cannot include embedded credentials.");
  }

  assertPublicHost(url.hostname);

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();

  return {
    inputTarget: value,
    normalizedTarget: url.toString(),
    targetType: "url",
  };
}

function normalizeHostTarget(value: string): NormalizedTarget {
  const normalizedHost = hostnameSchema.parse(value).toLowerCase();

  assertPublicHost(normalizedHost);

  return {
    inputTarget: value,
    normalizedTarget: normalizedHost,
    targetType: isIP(normalizedHost) ? "host" : normalizedHost.includes(".") ? "domain" : "host",
  };
}

export function normalizeTargets(targets: readonly string[]): NormalizedTarget[] {
  const uniqueTargets = new Map<string, NormalizedTarget>();

  for (const target of targets) {
    const trimmedTarget = target.trim();

    if (!trimmedTarget) {
      continue;
    }

    const normalized = /^https?:\/\//i.test(trimmedTarget)
      ? normalizeUrlTarget(trimmedTarget)
      : normalizeHostTarget(trimmedTarget);

    if (!uniqueTargets.has(normalized.normalizedTarget)) {
      uniqueTargets.set(normalized.normalizedTarget, normalized);
    }
  }

  return [...uniqueTargets.values()];
}

export function normalizeTarget(target: string): NormalizedTarget {
  const [normalizedTarget] = normalizeTargets([target]);

  if (!normalizedTarget) {
    throw new Error("A valid public target is required.");
  }

  return normalizedTarget;
}
