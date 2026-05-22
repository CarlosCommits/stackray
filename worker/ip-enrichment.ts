import { reverse, resolveTxt } from "node:dns/promises";
import { isIP } from "node:net";

import { eq } from "drizzle-orm";

import { ipEnrichments } from "../drizzle/schema.ts";
import { env } from "../lib/env/server.ts";
import { db } from "./db.ts";

const IP_ENRICHMENT_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const IANA_IPV4_BOOTSTRAP_URL = "https://data.iana.org/rdap/ipv4.json";
const RDAP_ORG_FALLBACK_URL = "https://rdap.org/ip";
const HACKER_TARGET_REVERSE_IP_URL = "https://api.hackertarget.com/reverseiplookup/";
const THC_REVERSE_IP_URL = "https://ip.thc.org";
const HACKER_TARGET_MIN_REQUEST_INTERVAL_MS = 500;
const THC_MIN_REQUEST_INTERVAL_MS = 2_000;
const MAX_HACKER_TARGET_REVERSE_IP_DOMAINS = 500;
const MAX_THC_REVERSE_IP_DOMAINS = 100;

type IpEnrichmentRow = typeof ipEnrichments.$inferSelect;

type RirBootstrap = {
  services?: unknown;
};

type RirService = {
  ranges: string[];
  urls: string[];
};

type RdapEntity = {
  roles: string[];
  handle: string | null;
  fn: string | null;
  org: string | null;
  kind: string | null;
  addressLabel: string | null;
  depth: number;
};

let ipv4BootstrapPromise: Promise<RirService[]> | null = null;
const providerRequestQueues = new Map<string, Promise<number>>();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.flatMap((entry) => {
    const stringValue = asString(entry);

    return stringValue ? [stringValue] : [];
  }) : [];
}

function normalizeIp(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  return isIP(trimmed) ? trimmed : null;
}

function isPrivateOrSpecialIpv4(ip: string) {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts as [number, number, number, number];

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && parts[2] === 0) ||
    (a === 192 && b === 0 && parts[2] === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && parts[2] === 100) ||
    (a === 203 && b === 0 && parts[2] === 113) ||
    a >= 224
  );
}

function ipv4ToBigInt(ip: string) {
  return ip
    .split(".")
    .map((part) => BigInt(Number.parseInt(part, 10)))
    .reduce((accumulator, part) => (accumulator << BigInt(8)) + part, BigInt(0));
}

function parseIpv4Range(range: string) {
  if (range.includes("/")) {
    const [baseIp, prefixValue] = range.split("/");
    const prefix = Number.parseInt(prefixValue ?? "", 10);

    if (!baseIp || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
      return null;
    }

    const hostBits = 32 - prefix;
    const blockSize = BigInt(1) << BigInt(hostBits);
    const start = (ipv4ToBigInt(baseIp.trim()) / blockSize) * blockSize;

    return {
      start,
      end: start + blockSize - BigInt(1),
    };
  }

  const [start, end] = range.split("-");

  if (!start || !end) {
    return null;
  }

  return {
    start: ipv4ToBigInt(start.trim()),
    end: ipv4ToBigInt(end.trim()),
  };
}

function getRegistryFromUrl(url: string) {
  const normalized = url.toLowerCase();

  if (normalized.includes("arin.net")) return "arin";
  if (normalized.includes("ripe.net")) return "ripe";
  if (normalized.includes("apnic.net")) return "apnic";
  if (normalized.includes("lacnic.net")) return "lacnic";
  if (normalized.includes("afrinic.net")) return "afrinic";

  return null;
}

function getRegistryFromRdapPayload(payload: Record<string, unknown>, queryUrl: string) {
  const port43 = asString(payload.port43);
  const port43Registry = port43 ? getRegistryFromUrl(`https://${port43}`) : null;

  if (port43Registry) {
    return port43Registry;
  }

  if (Array.isArray(payload.links)) {
    for (const link of payload.links) {
      if (!isObject(link)) {
        continue;
      }

      const registry = asString(link.href) ? getRegistryFromUrl(asString(link.href)!) : null;

      if (registry) {
        return registry;
      }
    }
  }

  return getRegistryFromUrl(queryUrl);
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        "user-agent": "Stackray IP enrichment (+https://stackray.local)",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.text();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS}ms: ${url}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimitedFetchText(provider: string, minIntervalMs: number, url: string) {
  const previous = providerRequestQueues.get(provider) ?? Promise.resolve(0);
  const next = previous.catch(() => 0).then(async (lastStartedAt) => {
    const elapsed = Date.now() - lastStartedAt;
    const remaining = minIntervalMs - elapsed;

    if (remaining > 0) {
      await wait(remaining);
    }

    return Date.now();
  });

  providerRequestQueues.set(provider, next);
  await next;

  return fetchText(url);
}

async function fetchJson(url: string) {
  return JSON.parse(await fetchText(url)) as unknown;
}

function parseIpv4Bootstrap(payload: RirBootstrap): RirService[] {
  if (!Array.isArray(payload.services)) {
    return [];
  }

  return payload.services.flatMap((entry) => {
    if (!Array.isArray(entry) || entry.length < 2) {
      return [];
    }

    const ranges = asStringArray(entry[0]);
    const urls = asStringArray(entry[1]);

    return ranges.length > 0 && urls.length > 0 ? [{ ranges, urls }] : [];
  });
}

async function getIpv4Bootstrap() {
  ipv4BootstrapPromise ??= fetchJson(IANA_IPV4_BOOTSTRAP_URL).then((payload) => {
    return isObject(payload) ? parseIpv4Bootstrap(payload) : [];
  });

  return ipv4BootstrapPromise;
}

async function getRdapLookupUrl(ip: string) {
  if (isIP(ip) !== 4) {
    return `${RDAP_ORG_FALLBACK_URL}/${encodeURIComponent(ip)}`;
  }

  const ipNumber = ipv4ToBigInt(ip);
  const services = await getIpv4Bootstrap();

  for (const service of services) {
    for (const range of service.ranges) {
      const parsedRange = parseIpv4Range(range);

      if (parsedRange && ipNumber >= parsedRange.start && ipNumber <= parsedRange.end) {
        const baseUrl = service.urls[0]?.replace(/\/+$/g, "");

        if (baseUrl) {
          return `${baseUrl}/ip/${encodeURIComponent(ip)}`;
        }
      }
    }
  }

  return `${RDAP_ORG_FALLBACK_URL}/${encodeURIComponent(ip)}`;
}

function parseVcardField(vcardArray: unknown, fieldName: string) {
  if (!Array.isArray(vcardArray) || !Array.isArray(vcardArray[1])) {
    return null;
  }

  for (const field of vcardArray[1]) {
    if (!Array.isArray(field) || field[0] !== fieldName) {
      continue;
    }

    if (fieldName === "adr" && isObject(field[1])) {
      return asString(field[1].label) ?? (Array.isArray(field[3]) ? field[3].filter(Boolean).join(", ") : asString(field[3]));
    }

    return Array.isArray(field[3]) ? field[3].filter(Boolean).join(", ") : asString(field[3]);
  }

  return null;
}

function collectRdapEntities(value: unknown, depth = 0): RdapEntity[] {
  if (!Array.isArray(value) || depth > 4) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isObject(entry)) {
      return [];
    }

    const entity: RdapEntity = {
      roles: asStringArray(entry.roles),
      handle: asString(entry.handle),
      fn: parseVcardField(entry.vcardArray, "fn"),
      org: parseVcardField(entry.vcardArray, "org"),
      kind: parseVcardField(entry.vcardArray, "kind"),
      addressLabel: parseVcardField(entry.vcardArray, "adr"),
      depth,
    };

    return [entity, ...collectRdapEntities(entry.entities, depth + 1)];
  });
}

function extractRdapCidrs(payload: Record<string, unknown>) {
  const cidrValues = payload.cidr0_cidrs;

  return Array.isArray(cidrValues)
    ? cidrValues.flatMap((entry) => {
        if (!isObject(entry)) {
          return [];
        }

        const prefix = asString(entry.v4prefix) ?? asString(entry.v6prefix);
        const length = typeof entry.length === "number" ? entry.length : null;

        return prefix && length !== null ? [`${prefix}/${length}`] : [];
      })
    : [];
}

function extractStringArray(payload: Record<string, unknown>, key: string) {
  return Array.isArray(payload[key]) ? payload[key].filter((entry): entry is string => typeof entry === "string") : [];
}

function getProviderLikeEntityName(entity: RdapEntity) {
  const names = [entity.org, entity.fn].flatMap((name) => name ? [name] : []);

  return names.find((name) => {
    const normalized = name.trim().toLowerCase();

    if (!normalized || ["admin", "abuse", "noc", "technical"].includes(normalized)) {
      return false;
    }

    return /\b(?:cloud|hosting|host|internet|telecom|communications?|network|datacenter|digital|systems|technolog(?:y|ies)|llc|inc|ltd|limited|corp|corporation|company|gmbh|sas|sa|ag|bv|plc|pte|ovh|akamai|cloudflare|hetzner|leaseweb|linode|akamai|microsoft|google|amazon|oracle|digitalocean|vultr)\b/i.test(name);
  }) ?? null;
}

function pickRdapProviderName(entities: RdapEntity[], networkName: string | null) {
  const providerEntity = entities
    .toSorted((left, right) => right.depth - left.depth)
    .find((entity) => getProviderLikeEntityName(entity));

  return providerEntity ? getProviderLikeEntityName(providerEntity) : networkName;
}

async function lookupRdap(ip: string) {
  const primaryUrl = await getRdapLookupUrl(ip);
  const fallbackUrl = `${RDAP_ORG_FALLBACK_URL}/${encodeURIComponent(ip)}`;
  let url = primaryUrl;
  let payload: unknown;
  let fallbackFrom: string | null = null;
  const bootstrapRegistry = getRegistryFromUrl(primaryUrl);

  try {
    payload = await fetchJson(primaryUrl);
  } catch (error) {
    if (primaryUrl === fallbackUrl) {
      throw error;
    }

    fallbackFrom = primaryUrl;
    url = fallbackUrl;
    payload = await fetchJson(fallbackUrl);
  }

  if (!isObject(payload)) {
    throw new Error("RDAP response was not an object.");
  }

  const entities = collectRdapEntities(payload.entities);
  const networkName = asString(payload.name);
  const providerName = pickRdapProviderName(entities, networkName);

  return {
    source: "rdap",
    queryUrl: url,
    fallbackFrom,
    bootstrapRegistry,
    registry: getRegistryFromRdapPayload(payload, url),
    name: networkName,
    handle: asString(payload.handle),
    type: asString(payload.type),
    parentHandle: asString(payload.parentHandle),
    startAddress: asString(payload.startAddress),
    endAddress: asString(payload.endAddress),
    cidrs: extractRdapCidrs(payload),
    country: asString(payload.country),
    status: extractStringArray(payload, "status"),
    providerName,
    entities,
  };
}

function reverseIpv4(ip: string) {
  return ip.split(".").toReversed().join(".");
}

function flattenTxt(records: string[][]) {
  return records.map((record) => record.join("")).filter((record) => record.trim().length > 0);
}

function cleanAsDescription(value: string | null) {
  if (!value) {
    return null;
  }

  return value.replace(/,\s*[A-Z]{2}$/i, "").trim() || value;
}

async function lookupBgp(ip: string) {
  if (isIP(ip) !== 4) {
    return {
      source: "team-cymru-dns",
      supported: false,
      reason: "IPv6 BGP lookup is not implemented yet.",
    };
  }

  const originRecords = flattenTxt(await resolveTxt(`${reverseIpv4(ip)}.origin.asn.cymru.com`));
  const originRecord = originRecords[0] ?? null;

  if (!originRecord || /^na\b/i.test(originRecord)) {
    return {
      source: "team-cymru-dns",
      supported: true,
      asNumber: null,
      prefix: null,
      raw: originRecord,
    };
  }

  const [asn, prefix, country, registry, allocatedAt] = originRecord.split("|").map((part) => part.trim());
  const asNumber = asn ? `AS${asn.replace(/^AS/i, "")}` : null;
  let description: string | null = null;

  if (asNumber) {
    const asRecords = flattenTxt(await resolveTxt(`${asNumber}.asn.cymru.com`));
    const asRecord = asRecords[0] ?? null;

    if (asRecord) {
      description = cleanAsDescription(asRecord.split("|").map((part) => part.trim())[4] ?? null);
    }
  }

  return {
    source: "team-cymru-dns",
    supported: true,
    asNumber,
    prefix: prefix || null,
    country: country || null,
    registry: registry || null,
    allocatedAt: allocatedAt || null,
    description,
    providerName: description,
    raw: originRecord,
  };
}

async function lookupPtr(ip: string) {
  try {
    return await reverse(ip);
  } catch {
    return [];
  }
}

function parseReverseIpBody(body: string, limit: number) {
  if (/^(?:error|api count|no dns a records found)/i.test(body.trim())) {
    return {
      domains: [] as string[],
      error: body.trim(),
    };
  }

  const domains = body
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((line) => !line.startsWith(";"))
    .filter((line) => /^[a-z0-9*_.-]+\.[a-z0-9.-]+$/i.test(line))
    .filter((line, index, values) => values.indexOf(line) === index)
    .slice(0, limit);

  return {
    domains,
    error: null,
  };
}

function shouldFallbackReverseIpLookup(parsed: { domains: string[]; error: string | null }) {
  return parsed.domains.length === 0 || Boolean(parsed.error);
}

async function lookupExternalReverseIp(ip: string) {
  if (env.STACKRAY_EXTERNAL_REVERSE_IP === "false") {
    return {
      provider: "hackertarget",
      enabled: false,
      domains: [],
      error: null,
    };
  }

  const hackerTargetUrl = `${HACKER_TARGET_REVERSE_IP_URL}?q=${encodeURIComponent(ip)}`;

  try {
    const parsed = parseReverseIpBody(
      await rateLimitedFetchText("hackertarget-reverse-ip", HACKER_TARGET_MIN_REQUEST_INTERVAL_MS, hackerTargetUrl),
      MAX_HACKER_TARGET_REVERSE_IP_DOMAINS,
    );

    if (!shouldFallbackReverseIpLookup(parsed)) {
      return {
        provider: "hackertarget",
        enabled: true,
        sourceUrl: hackerTargetUrl,
        domains: parsed.domains,
        error: null,
      };
    }

    const thcUrl = `${THC_REVERSE_IP_URL}/${encodeURIComponent(ip)}?l=${MAX_THC_REVERSE_IP_DOMAINS}&nocolor=1&noheader=1`;
    const fallbackParsed = parseReverseIpBody(
      await rateLimitedFetchText("ip-thc-reverse-ip", THC_MIN_REQUEST_INTERVAL_MS, thcUrl),
      MAX_THC_REVERSE_IP_DOMAINS,
    );

    return {
      provider: "ip.thc.org",
      enabled: true,
      sourceUrl: thcUrl,
      fallbackFrom: hackerTargetUrl,
      domains: fallbackParsed.domains,
      error: fallbackParsed.error ?? (fallbackParsed.domains.length > 0 ? null : parsed.error),
    };
  } catch (error) {
    const thcUrl = `${THC_REVERSE_IP_URL}/${encodeURIComponent(ip)}?l=${MAX_THC_REVERSE_IP_DOMAINS}&nocolor=1&noheader=1`;
    const fallbackParsed = parseReverseIpBody(
      await rateLimitedFetchText("ip-thc-reverse-ip", THC_MIN_REQUEST_INTERVAL_MS, thcUrl),
      MAX_THC_REVERSE_IP_DOMAINS,
    );

    return {
      provider: "ip.thc.org",
      enabled: true,
      sourceUrl: thcUrl,
      fallbackFrom: hackerTargetUrl,
      domains: fallbackParsed.domains,
      error: fallbackParsed.error ?? (fallbackParsed.domains.length > 0 ? null : error instanceof Error ? error.message : "HackerTarget reverse IP lookup failed."),
    };
  }
}

function selectProvider(input: {
  rdap: Awaited<ReturnType<typeof lookupRdap>> | null;
  bgp: Awaited<ReturnType<typeof lookupBgp>> | null;
}) {
  if (input.bgp && "providerName" in input.bgp && input.bgp.providerName) {
    return {
      providerName: input.bgp.providerName,
      providerSource: "bgp",
    };
  }

  if (input.rdap?.providerName) {
    return {
      providerName: input.rdap.providerName,
      providerSource: "rdap",
    };
  }

  return {
    providerName: null,
    providerSource: null,
  };
}

function isCacheFresh(row: IpEnrichmentRow | undefined, now: Date) {
  return Boolean(row?.refreshedAt && now.getTime() - row.refreshedAt.getTime() < IP_ENRICHMENT_CACHE_MS);
}

export async function enrichIpAddress(ipValue: string | null | undefined, now = new Date()) {
  const ip = normalizeIp(ipValue);

  if (!ip || (isIP(ip) === 4 && isPrivateOrSpecialIpv4(ip))) {
    return null;
  }

  const [existing] = await db.select().from(ipEnrichments).where(eq(ipEnrichments.ip, ip)).limit(1);

  if (isCacheFresh(existing, now)) {
    return existing;
  }

  const errors: Record<string, string> = {};
  const [rdapResult, bgpResult, ptrResult, reverseIpResult] = await Promise.allSettled([
    lookupRdap(ip),
    lookupBgp(ip),
    lookupPtr(ip),
    lookupExternalReverseIp(ip),
  ]);

  const rdap = rdapResult.status === "fulfilled" ? rdapResult.value : null;
  const bgp = bgpResult.status === "fulfilled" ? bgpResult.value : null;
  const ptr = ptrResult.status === "fulfilled" ? ptrResult.value : [];
  const reverseIp = reverseIpResult.status === "fulfilled" ? reverseIpResult.value : null;

  if (rdapResult.status === "rejected") errors.rdap = rdapResult.reason instanceof Error ? rdapResult.reason.message : "RDAP lookup failed.";
  if (bgpResult.status === "rejected") errors.bgp = bgpResult.reason instanceof Error ? bgpResult.reason.message : "BGP lookup failed.";
  if (ptrResult.status === "rejected") errors.ptr = ptrResult.reason instanceof Error ? ptrResult.reason.message : "PTR lookup failed.";
  if (reverseIpResult.status === "rejected") errors.reverseIp = reverseIpResult.reason instanceof Error ? reverseIpResult.reason.message : "Reverse IP lookup failed.";

  const provider = selectProvider({ rdap, bgp });
  const [row] = await db
    .insert(ipEnrichments)
    .values({
      ip,
      providerName: provider.providerName,
      providerSource: provider.providerSource,
      rdapJson: rdap ?? {},
      bgpJson: bgp ?? {},
      ptrJson: ptr,
      reverseIpJson: reverseIp ?? {},
      errorJson: errors,
      refreshedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: ipEnrichments.ip,
      set: {
        providerName: provider.providerName,
        providerSource: provider.providerSource,
        rdapJson: rdap ?? {},
        bgpJson: bgp ?? {},
        ptrJson: ptr,
        reverseIpJson: reverseIp ?? {},
        errorJson: errors,
        refreshedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  return row ?? null;
}
