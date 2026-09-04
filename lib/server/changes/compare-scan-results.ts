import {
  getResponseHeaderRule,
  normalizeResponseHeaderName,
  type ResponseHeaderDisposition,
} from "../../changes/response-headers.ts";
import { setCookieHeaderValuesMatch } from "../../changes/set-cookie.ts";
import {
  canonicalizeEndpoint,
  canonicalizeResponseHeaders,
  contentSecurityPolicyHeaderValuesMatch,
  stableFingerprint,
} from "./canonicalization.ts";

export const SCAN_COMPARISON_ALGORITHM_VERSION = "19";
export const DEFAULT_MAX_COMPARISON_ENDPOINTS = 5_000;
export const DEFAULT_MAX_CHANGE_ITEMS = 2_000;
const BODY_SIMHASH_CHANGE_DISTANCE = 3;

export type ScanChangeCategory = "availability" | "content" | "delivery" | "dns" | "tls" | "technology";

export type ScanChangeType =
  | "status.changed"
  | "redirect.changed"
  | "body_fingerprint.changed"
  | "response_headers.changed"
  | "favicon.changed"
  | "favicon_location.changed"
  | "dns.host_ip_changed"
  | "dns.a_changed"
  | "dns.aaaa_changed"
  | "dns.cname_changed"
  | "tls.certificate_changed"
  | "tls.jarm_changed"
  | "technology.changed"
  | "cpe.changed"
  | "metadata.title_changed"
  | "metadata.server_changed"
  | "metadata.content_type_changed"
  | "metadata.cdn_changed"
  | "metadata.capabilities_changed";

export interface ComparableTechnologyDetection {
  name: string;
  version?: string | null;
  cpe?: string | null;
}

export interface ComparableScanResult {
  id?: string | null;
  resultId?: string | null;
  input?: string | null;
  url?: string | null;
  finalUrl?: string | null;
  scheme?: string | null;
  host?: string | null;
  port?: string | number | null;
  path?: string | null;
  statusCode?: number | null;
  title?: string | null;
  webServer?: string | null;
  server?: string | null;
  contentType?: string | null;
  contentLength?: number | null;
  location?: string | null;
  redirectChainStatusCodes?: readonly number[] | null;
  redirectChainJson?: readonly Record<string, unknown>[] | null;
  redirectChain?: { statusCodes?: readonly number[]; items?: readonly Record<string, unknown>[] } | null;
  responseHeadersJson?: Record<string, unknown> | null;
  responseHeaders?: Record<string, unknown> | null;
  hashesJson?: Record<string, unknown> | null;
  hashes?: Record<string, string> | null;
  faviconMmh3?: string | null;
  faviconMd5?: string | null;
  faviconUrl?: string | null;
  faviconPath?: string | null;
  favicon?: { mmh3?: string | null; md5?: string | null; url?: string | null; path?: string | null } | null;
  hostIp?: string | null;
  dnsARecords?: readonly string[] | null;
  dnsAaaaRecords?: readonly string[] | null;
  dnsCnameRecords?: readonly string[] | null;
  dns?: {
    hostIp?: string | null;
    a?: readonly string[];
    aaaa?: readonly string[];
    cname?: readonly string[];
  } | null;
  tlsJson?: Record<string, unknown> | null;
  tls?: { certificate?: Record<string, unknown>; jarmHash?: string | null } | null;
  jarmHash?: string | null;
  technologies?: readonly string[] | null;
  technologyDetections?: readonly ComparableTechnologyDetection[] | null;
  cpe?: readonly (string | { cpe: string })[] | null;
  cdn?: boolean | { enabled?: boolean; name?: string | null; type?: string | null } | null;
  cdnName?: string | null;
  cdnType?: string | null;
  http2?: boolean | null;
  pipeline?: boolean | null;
  websocket?: boolean | null;
  vhost?: boolean | null;
  capabilities?: { http2?: boolean; pipeline?: boolean; websocket?: boolean; vhost?: boolean } | null;
}

export interface ComparableScanSnapshot {
  results: readonly ComparableScanResult[];
}

export interface ComparableIpNetworkIdentity {
  registrantId: string;
  registrantName?: string | null;
  providerName?: string | null;
  originAsn: string;
}

export interface ScanChangeItem {
  algorithmVersion: string;
  endpointKey: string;
  category: ScanChangeCategory;
  type: ScanChangeType;
  confidence: "high" | "medium";
  alertEligible: boolean;
  before: unknown;
  after: unknown;
}

export interface CompareScanResultsInput {
  baseline: ComparableScanSnapshot;
  current: ComparableScanSnapshot;
  ipNetworkIdentities?: ReadonlyMap<string, ComparableIpNetworkIdentity>;
  maxEndpoints?: number;
  maxChangeItems?: number;
}

export interface ScanComparisonOutput {
  algorithmVersion: string;
  items: ScanChangeItem[];
  comparedEndpointCount: number;
  totalChangeCount: number;
  omittedChangeCount: number;
  skippedResultCount: number;
  truncated: boolean;
}

type ItemInput = Omit<ScanChangeItem, "algorithmVersion" | "endpointKey">;

const EVIDENCE_ARRAY_LIMIT = 50;
const EVIDENCE_STRING_LIMIT = 512;

function boundedString(value: string) {
  return value.length <= EVIDENCE_STRING_LIMIT ? value : `${value.slice(0, EVIDENCE_STRING_LIMIT)}…`;
}

function boundEvidence(value: unknown): unknown {
  if (typeof value === "string") {
    return boundedString(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, EVIDENCE_ARRAY_LIMIT).map(boundEvidence);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .slice(0, EVIDENCE_ARRAY_LIMIT)
        .map(([key, entry]) => [key, boundEvidence(entry)]),
    );
  }

  return value;
}

function asComparableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value).flatMap(([key, entry]) => {
    const stringValue = asComparableString(entry);
    return stringValue ? [[key, stringValue] as const] : [];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function normalizeHashKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function simhashHammingDistance(before: string, after: string) {
  try {
    let differingBits = BigInt(before) ^ BigInt(after);
    let distance = 0;

    while (differingBits > BigInt(0)) {
      distance += 1;
      differingBits &= differingBits - BigInt(1);
    }

    return distance;
  } catch {
    return null;
  }
}

function selectBodyHashPair(before: ComparableScanResult, after: ComparableScanResult) {
  const beforeHashes = asStringRecord(before.hashesJson ?? before.hashes);
  const afterHashes = asStringRecord(after.hashesJson ?? after.hashes);

  if (!beforeHashes || !afterHashes) {
    return null;
  }

  const normalizedBefore = new Map(Object.entries(beforeHashes).map(([key, value]) => [normalizeHashKey(key), value]));
  const normalizedAfter = new Map(Object.entries(afterHashes).map(([key, value]) => [normalizeHashKey(key), value]));

  const key = ["bodysimhash", "simhash"].find((candidate) => normalizedBefore.has(candidate) && normalizedAfter.has(candidate));
  if (!key) return null;

  const beforeSimhash = normalizedBefore.get(key)!;
  const afterSimhash = normalizedAfter.get(key)!;
  const distance = simhashHammingDistance(beforeSimhash, afterSimhash);

  if (distance === null) return null;

  return {
    algorithm: "simhash" as const,
    before: beforeSimhash,
    after: afterSimhash,
    beforeHashes: { body_simhash: beforeSimhash },
    afterHashes: { body_simhash: afterSimhash },
    materiallyChanged: distance > BODY_SIMHASH_CHANGE_DISTANCE,
  };
}

function sortedUnique(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].toSorted();
}

function compareStringSets(before: readonly string[] | null | undefined, after: readonly string[] | null | undefined) {
  if (!before || !after) {
    return null;
  }

  const beforeValues = sortedUnique(before);
  const afterValues = sortedUnique(after);
  const beforeSet = new Set(beforeValues);
  const afterSet = new Set(afterValues);
  const added = afterValues.filter((value) => !beforeSet.has(value));
  const removed = beforeValues.filter((value) => !afterSet.has(value));

  return added.length > 0 || removed.length > 0 ? { added, removed } : null;
}

type HeaderChangeKinds = {
  added: string[];
  changed: string[];
  removed: string[];
};

type HeaderChangesByDisposition = Record<ResponseHeaderDisposition, HeaderChangeKinds>;

const CACHE_STATE_HEADER_NAMES = [
  "cache-status",
  "cf-cache-status",
  "x-cache",
  "x-vercel-cache",
] as const;

function emptyHeaderChangesByDisposition(): HeaderChangesByDisposition {
  return {
    meaningful: { added: [], changed: [], removed: [] },
    routine: { added: [], changed: [], removed: [] },
    representation: { added: [], changed: [], removed: [] },
    unknown: { added: [], changed: [], removed: [] },
  };
}

function collectHeaderValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectHeaderValues);
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value).trim()];
  }

  if (value === null) {
    return [""];
  }

  return [];
}

function responseHeaderValues(headers: Record<string, unknown>, expectedName: string) {
  return Object.entries(headers).flatMap(([name, value]) => (
    normalizeResponseHeaderName(name) === expectedName ? collectHeaderValues(value) : []
  ));
}

function varyTokens(headers: Record<string, unknown>) {
  return new Set(
    responseHeaderValues(headers, "vary")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function onlyAcceptEncodingVaries(
  beforeHeaders: Record<string, unknown>,
  afterHeaders: Record<string, unknown>,
) {
  const beforeTokens = varyTokens(beforeHeaders);
  const afterTokens = varyTokens(afterHeaders);
  const allTokens = new Set([...beforeTokens, ...afterTokens]);
  const changedTokens = [...allTokens].filter((token) => beforeTokens.has(token) !== afterTokens.has(token));

  return beforeTokens.size > 0
    && afterTokens.size > 0
    && changedTokens.length === 1
    && changedTokens[0] === "accept-encoding";
}

function hasCachePathTransition(
  beforeHeaders: Record<string, unknown>,
  afterHeaders: Record<string, unknown>,
) {
  const beforeHasAge = responseHeaderValues(beforeHeaders, "age").length > 0;
  const afterHasAge = responseHeaderValues(afterHeaders, "age").length > 0;

  if (beforeHasAge !== afterHasAge) {
    return true;
  }

  return CACHE_STATE_HEADER_NAMES.some((name) => {
    const beforeValues = responseHeaderValues(beforeHeaders, name);
    const afterValues = responseHeaderValues(afterHeaders, name);

    return stableFingerprint(beforeValues) !== stableFingerprint(afterValues)
      && (beforeValues.length > 0 || afterValues.length > 0);
  });
}

function hasStableResponseShape(before: ComparableScanResult, after: ComparableScanResult) {
  return before.statusCode !== null
    && before.statusCode !== undefined
    && before.statusCode === after.statusCode
    && before.contentType !== null
    && before.contentType !== undefined
    && before.contentType.trim().toLowerCase() === after.contentType?.trim().toLowerCase()
    && before.contentLength !== null
    && before.contentLength !== undefined
    && before.contentLength === after.contentLength;
}

function isRoutineAcceptEncodingVaryTransition(
  before: ComparableScanResult,
  after: ComparableScanResult,
  beforeHeaders: Record<string, unknown>,
  afterHeaders: Record<string, unknown>,
) {
  return hasStableResponseShape(before, after)
    && onlyAcceptEncodingVaries(beforeHeaders, afterHeaders)
    && hasCachePathTransition(beforeHeaders, afterHeaders);
}

function getHeaderPresenceTransitionDisposition(name: string, semanticFingerprint: string | undefined) {
  const disposition = getResponseHeaderRule(name).disposition;

  if (name === "alt-svc") {
    return "routine";
  }

  return disposition === "meaningful" && !semanticFingerprint
    ? "routine"
    : disposition;
}

function classifyHeaderChanges(
  beforeViews: ReturnType<typeof canonicalizeResponseHeaders>,
  afterViews: ReturnType<typeof canonicalizeResponseHeaders>,
  before: ComparableScanResult,
  after: ComparableScanResult,
  beforeHeaders: Record<string, unknown>,
  afterHeaders: Record<string, unknown>,
) {
  const changes = emptyHeaderChangesByDisposition();
  const nameChanges = compareStringSets(beforeViews.strict.names, afterViews.strict.names)
    ?? { added: [], removed: [] };
  const afterNameSet = new Set(afterViews.strict.names);

  for (const name of nameChanges.added) {
    const effectiveDisposition = getHeaderPresenceTransitionDisposition(
      name,
      afterViews.semantic.fingerprintsByName[name],
    );
    changes[effectiveDisposition].added.push(name);
  }

  for (const name of nameChanges.removed) {
    const effectiveDisposition = getHeaderPresenceTransitionDisposition(
      name,
      beforeViews.semantic.fingerprintsByName[name],
    );
    changes[effectiveDisposition].removed.push(name);
  }

  for (const name of beforeViews.strict.names) {
    if (!afterNameSet.has(name)) {
      continue;
    }

    if (beforeViews.strict.fingerprintsByName[name] === afterViews.strict.fingerprintsByName[name]) {
      continue;
    }

    const rule = getResponseHeaderRule(name);
    if (rule.disposition !== "meaningful") {
      changes[rule.disposition].changed.push(name);
      continue;
    }

    if (name === "vary" && isRoutineAcceptEncodingVaryTransition(before, after, beforeHeaders, afterHeaders)) {
      changes.routine.changed.push(name);
      continue;
    }

    const beforeSemanticFingerprint = beforeViews.semantic.fingerprintsByName[name];
    const afterSemanticFingerprint = afterViews.semantic.fingerprintsByName[name];
    const cspReportingValuesMatch = (
      name === "content-security-policy" || name === "content-security-policy-report-only"
    ) && contentSecurityPolicyHeaderValuesMatch(
      responseHeaderValues(beforeHeaders, name),
      responseHeaderValues(afterHeaders, name),
    );
    const cookieLifetimeValuesMatch = name === "set-cookie" && setCookieHeaderValuesMatch(
      responseHeaderValues(beforeHeaders, name),
      responseHeaderValues(afterHeaders, name),
    );
    const semanticChanged = beforeSemanticFingerprint !== afterSemanticFingerprint
      && !cspReportingValuesMatch
      && !cookieLifetimeValuesMatch;
    changes[semanticChanged ? "meaningful" : "routine"].changed.push(name);
  }

  return changes;
}

function hasAlertEligibleHeaderChanges(changes: HeaderChangeKinds) {
  return [...changes.added, ...changes.changed, ...changes.removed]
    .some((name) => getResponseHeaderRule(name).alertBehavior === "semantic");
}

function knownStringSetsMatch(before: readonly string[] | null | undefined, after: readonly string[] | null | undefined) {
  return Boolean(before && after && stableFingerprint(sortedUnique(before)) === stableFingerprint(sortedUnique(after)));
}

function compareKnownScalar<T>(before: T | null | undefined, after: T | null | undefined) {
  return before !== null && before !== undefined && after !== null && after !== undefined && before !== after;
}

function normalizeObservedUrl(value: string, baseUrl?: string | null) {
  try {
    return new URL(value, baseUrl ?? undefined).toString();
  } catch {
    return value;
  }
}

function redirectItemRequestUrl(item: Record<string, unknown>) {
  return asComparableString(item["request-url"] ?? item.requestUrl ?? item.url);
}

function getRedirectEvidence(result: ComparableScanResult) {
  const items = result.redirectChainJson ?? result.redirectChain?.items;
  const initialUrl = asComparableString(result.url ?? result.input);
  const observedRequestUrls = items?.flatMap((item) => {
    const requestUrl = redirectItemRequestUrl(item);
    return requestUrl ? [requestUrl] : [];
  }) ?? [];
  const rawChain = observedRequestUrls.length > 0
    ? observedRequestUrls
    : initialUrl
      ? [initialUrl]
      : [];
  const baseUrl = initialUrl ?? rawChain[0] ?? null;
  const chain = rawChain.map((url) => normalizeObservedUrl(url, baseUrl));
  const explicitFinalUrl = asComparableString(result.finalUrl);
  const fallbackLocation = asComparableString(result.location);
  const finalUrl = explicitFinalUrl
    ? normalizeObservedUrl(explicitFinalUrl, baseUrl)
    : fallbackLocation
      ? normalizeObservedUrl(fallbackLocation, chain.at(-1) ?? baseUrl)
      : chain.at(-1) ?? null;

  if (chain.length === 0 && !finalUrl) {
    return null;
  }

  return {
    chain,
    finalUrl,
  };
}

function getFavicon(result: ComparableScanResult) {
  return {
    md5: asComparableString(result.faviconMd5 ?? result.favicon?.md5),
    mmh3: asComparableString(result.faviconMmh3 ?? result.favicon?.mmh3),
    url: asComparableString(result.faviconUrl ?? result.favicon?.url),
    path: asComparableString(result.faviconPath ?? result.favicon?.path),
  };
}

function getTechnologySet(result: ComparableScanResult) {
  if (!result.technologies && !result.technologyDetections) {
    return null;
  }

  return sortedUnique([
    ...(result.technologies ?? []),
    ...(result.technologyDetections ?? []).map((detection) =>
      detection.version ? `${detection.name}@${detection.version}` : detection.name,
    ),
  ]);
}

function getCpeSet(result: ComparableScanResult) {
  const detectionCpes = result.technologyDetections?.flatMap((detection) => (detection.cpe ? [detection.cpe] : []));

  if (!result.cpe && !detectionCpes) {
    return null;
  }

  return sortedUnique([...(result.cpe ?? []).map((entry) => (typeof entry === "string" ? entry : entry.cpe)), ...(detectionCpes ?? [])]);
}

function getCertificate(result: ComparableScanResult) {
  return result.tlsJson ?? result.tls?.certificate ?? null;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function certificateIdentity(result: ComparableScanResult) {
  const certificate = getCertificate(result);
  if (!certificate) {
    return null;
  }

  const hashes = recordValue(
    certificate.fingerprint_hash
    ?? certificate.fingerprintHash
    ?? certificate.fingerprint,
  );
  for (const algorithm of ["sha256", "sha1", "md5"] as const) {
    const fingerprint = asComparableString(hashes?.[algorithm] ?? certificate[algorithm]);
    if (fingerprint) {
      return { algorithm, fingerprint: fingerprint.toLowerCase() };
    }
  }

  const subjectAlternativeNames = Array.isArray(certificate.subject_an ?? certificate.subjectAlternativeNames)
    ? (certificate.subject_an ?? certificate.subjectAlternativeNames) as unknown[]
    : [];
  const fallbackIdentity = {
    serial: asComparableString(certificate.serial),
    issuer: asComparableString(certificate.issuer_dn ?? certificate.issuerDn ?? certificate.issuer_cn ?? certificate.issuerCn),
    subject: asComparableString(certificate.subject_dn ?? certificate.subjectDn ?? certificate.subject_cn ?? certificate.subjectCn),
    subjectAlternativeNames: subjectAlternativeNames.flatMap((value) => {
      const name = asComparableString(value);
      return name ? [name.toLowerCase()] : [];
    }).toSorted(),
    notBefore: asComparableString(certificate.not_before ?? certificate.notBefore),
    notAfter: asComparableString(certificate.not_after ?? certificate.notAfter),
  };

  return Object.values(fallbackIdentity).some((value) => Array.isArray(value) ? value.length > 0 : value !== null)
    ? { algorithm: "certificate-identity", fingerprint: stableFingerprint(fallbackIdentity) }
    : null;
}

function getCdn(result: ComparableScanResult) {
  if (typeof result.cdn === "object" && result.cdn) {
    return {
      enabled: result.cdn.enabled ?? null,
      name: result.cdn.name ?? null,
      type: result.cdn.type ?? null,
    };
  }

  if (typeof result.cdn !== "boolean" && !asComparableString(result.cdnName) && !asComparableString(result.cdnType)) {
    return null;
  }

  return { enabled: result.cdn ?? null, name: result.cdnName ?? null, type: result.cdnType ?? null };
}

function getCapabilities(result: ComparableScanResult) {
  if (result.capabilities) {
    return result.capabilities;
  }

  if ([result.http2, result.pipeline, result.websocket, result.vhost].every((value) => typeof value !== "boolean")) {
    return null;
  }

  return {
    http2: result.http2 ?? null,
    pipeline: result.pipeline ?? null,
    websocket: result.websocket ?? null,
    vhost: result.vhost ?? null,
  };
}

function getARecords(result: ComparableScanResult) {
  return result.dnsARecords ?? result.dns?.a;
}

function getAaaaRecords(result: ComparableScanResult) {
  return result.dnsAaaaRecords ?? result.dns?.aaaa;
}

function getCnameRecords(result: ComparableScanResult) {
  return result.dnsCnameRecords ?? result.dns?.cname;
}

function normalizeNetworkOwner(value: string | null | undefined) {
  return value
    ?.normalize("NFKD")
    .toLowerCase()
    .replace(/\b(?:incorporated|corporation|company|limited|international|inc|corp|llc|ltd|b\.?v\.?)\b/g, " ")
    .replace(/[^a-z\d]+/g, " ")
    .trim()
    .replace(/\s+/g, " ") || null;
}

function networkOwnerCandidates(identity: ComparableIpNetworkIdentity) {
  return new Set([
    normalizeNetworkOwner(identity.providerName),
    normalizeNetworkOwner(identity.registrantName),
    normalizeNetworkOwner(identity.registrantId),
  ].flatMap((value) => value ? [value] : []));
}

function networkIdentitiesMatch(
  before: ComparableIpNetworkIdentity,
  after: ComparableIpNetworkIdentity,
) {
  if (before.originAsn.trim().toUpperCase() !== after.originAsn.trim().toUpperCase()) {
    return false;
  }

  const afterOwners = networkOwnerCandidates(after);
  return [...networkOwnerCandidates(before)].some((owner) => afterOwners.has(owner));
}

function networkIdentityEvidence(
  addresses: readonly string[],
  identities: ReadonlyMap<string, ComparableIpNetworkIdentity> | undefined,
) {
  if (!identities || addresses.length === 0) {
    return null;
  }

  const known = addresses.flatMap((address) => {
    const identity = identities.get(address.trim());
    return identity ? [identity] : [];
  });
  const missingCount = addresses.length - known.length;
  const hasEnoughCoverage = known.length > 0
    && missingCount <= 2
    && known.length >= Math.ceil(addresses.length / 2);

  return hasEnoughCoverage ? known : null;
}

function networkIdentitySetsMatch(
  before: readonly ComparableIpNetworkIdentity[],
  after: readonly ComparableIpNetworkIdentity[],
) {
  return before.every((identity) => after.some((candidate) => networkIdentitiesMatch(identity, candidate)))
    && after.every((identity) => before.some((candidate) => networkIdentitiesMatch(identity, candidate)));
}

function serviceIdentityStayedStable(before: ComparableScanResult, after: ComparableScanResult) {
  if (before.statusCode === null || before.statusCode === undefined || before.statusCode !== after.statusCode) {
    return false;
  }

  const beforeRedirect = getRedirectEvidence(before);
  const afterRedirect = getRedirectEvidence(after);
  const beforeCertificate = certificateIdentity(before);
  const afterCertificate = certificateIdentity(after);
  const beforeCdn = getCdn(before);
  const afterCdn = getCdn(after);
  const beforeServer = asComparableString(before.webServer ?? before.server);
  const afterServer = asComparableString(after.webServer ?? after.server);

  return knownStringSetsMatch(getCnameRecords(before), getCnameRecords(after))
    && beforeRedirect !== null
    && afterRedirect !== null
    && stableFingerprint(beforeRedirect) === stableFingerprint(afterRedirect)
    && beforeCertificate !== null
    && afterCertificate !== null
    && stableFingerprint(beforeCertificate) === stableFingerprint(afterCertificate)
    && (beforeCdn === null && afterCdn === null
      || beforeCdn !== null && afterCdn !== null && stableFingerprint(beforeCdn) === stableFingerprint(afterCdn))
    && (!beforeServer || !afterServer || beforeServer === afterServer);
}

function isRoutineIpRecordRotation(
  before: ComparableScanResult,
  after: ComparableScanResult,
  beforeAddresses: readonly string[] | null | undefined,
  afterAddresses: readonly string[] | null | undefined,
  identities: ReadonlyMap<string, ComparableIpNetworkIdentity> | undefined,
) {
  if (!beforeAddresses || !afterAddresses || beforeAddresses.length === 0 || afterAddresses.length === 0) {
    return false;
  }

  const beforeIdentities = networkIdentityEvidence(beforeAddresses, identities);
  const afterIdentities = networkIdentityEvidence(afterAddresses, identities);

  return Boolean(
    beforeIdentities
    && afterIdentities
    && networkIdentitySetsMatch(beforeIdentities, afterIdentities)
    && serviceIdentityStayedStable(before, after)
  );
}

function compareEndpoint(
  before: ComparableScanResult,
  after: ComparableScanResult,
  add: (item: ItemInput) => void,
  ipNetworkIdentities?: ReadonlyMap<string, ComparableIpNetworkIdentity>,
) {
  if (compareKnownScalar(before.statusCode, after.statusCode)) {
    add({
      category: "availability",
      type: "status.changed",
      confidence: "high",
      alertEligible: true,
      before: before.statusCode,
      after: after.statusCode,
    });
  }

  const beforeRedirect = getRedirectEvidence(before);
  const afterRedirect = getRedirectEvidence(after);
  if (beforeRedirect && afterRedirect && stableFingerprint(beforeRedirect) !== stableFingerprint(afterRedirect)) {
    add({ category: "delivery", type: "redirect.changed", confidence: "high", alertEligible: true, before: beforeRedirect, after: afterRedirect });
  }

  const bodyHashes = selectBodyHashPair(before, after);
  if (bodyHashes?.materiallyChanged) {
    add({
      category: "content",
      type: "body_fingerprint.changed",
      confidence: "high",
      alertEligible: true,
      before: { algorithm: bodyHashes.algorithm, hashes: bodyHashes.beforeHashes },
      after: { algorithm: bodyHashes.algorithm, hashes: bodyHashes.afterHashes },
    });
  }

  const beforeHeaders = before.responseHeadersJson ?? before.responseHeaders;
  const afterHeaders = after.responseHeadersJson ?? after.responseHeaders;
  if (beforeHeaders && afterHeaders) {
    const beforeViews = canonicalizeResponseHeaders(beforeHeaders);
    const afterViews = canonicalizeResponseHeaders(afterHeaders);
    const strictChanged = beforeViews.strict.fingerprint !== afterViews.strict.fingerprint;

    if (strictChanged) {
      const changesByDisposition = classifyHeaderChanges(
        beforeViews,
        afterViews,
        before,
        after,
        beforeHeaders,
        afterHeaders,
      );
      const meaningful = changesByDisposition.meaningful;
      add({
        category: "content",
        type: "response_headers.changed",
        confidence: "high",
        alertEligible: hasAlertEligibleHeaderChanges(meaningful),
        before: {
          strictFingerprint: beforeViews.strict.fingerprint,
          semanticFingerprint: beforeViews.semantic.fingerprint,
          names: beforeViews.semantic.names,
          fingerprintsByName: beforeViews.semantic.fingerprintsByName,
          strictNames: beforeViews.strict.names,
          strictFingerprintsByName: beforeViews.strict.fingerprintsByName,
          mode: "classified",
        },
        after: {
          strictFingerprint: afterViews.strict.fingerprint,
          semanticFingerprint: afterViews.semantic.fingerprint,
          names: afterViews.semantic.names,
          fingerprintsByName: afterViews.semantic.fingerprintsByName,
          strictNames: afterViews.strict.names,
          strictFingerprintsByName: afterViews.strict.fingerprintsByName,
          mode: "classified",
          added: meaningful.added,
          removed: meaningful.removed,
          changed: meaningful.changed,
          changesByDisposition,
        },
      });
    }
  }

  const beforeFavicon = getFavicon(before);
  const afterFavicon = getFavicon(after);
  const faviconAlgorithm = beforeFavicon.md5 && afterFavicon.md5 ? "md5" : beforeFavicon.mmh3 && afterFavicon.mmh3 ? "mmh3" : null;
  const faviconBefore = faviconAlgorithm ? beforeFavicon[faviconAlgorithm] : null;
  const faviconAfter = faviconAlgorithm ? afterFavicon[faviconAlgorithm] : null;
  const beforeFaviconLocation = beforeFavicon.url ?? beforeFavicon.path;
  const afterFaviconLocation = afterFavicon.url ?? afterFavicon.path;
  const comparableFaviconHashes = Object.fromEntries(
    (["md5", "mmh3"] as const).flatMap((algorithm) => (
      beforeFavicon[algorithm] && afterFavicon[algorithm]
        ? [[algorithm, { before: beforeFavicon[algorithm], after: afterFavicon[algorithm] }]]
        : []
    )),
  );
  if (faviconAlgorithm && faviconBefore !== faviconAfter) {
    add({
      category: "content",
      type: "favicon.changed",
      confidence: "high",
      alertEligible: true,
      before: {
        algorithm: faviconAlgorithm,
        value: faviconBefore,
        hashes: Object.fromEntries(Object.entries(comparableFaviconHashes).map(([algorithm, hashes]) => [algorithm, hashes.before])),
        location: beforeFaviconLocation,
      },
      after: {
        algorithm: faviconAlgorithm,
        value: faviconAfter,
        hashes: Object.fromEntries(Object.entries(comparableFaviconHashes).map(([algorithm, hashes]) => [algorithm, hashes.after])),
        location: afterFaviconLocation,
      },
    });
  } else if (faviconAlgorithm && faviconBefore === faviconAfter) {
    if (compareKnownScalar(beforeFaviconLocation, afterFaviconLocation)) {
      add({ category: "content", type: "favicon_location.changed", confidence: "high", alertEligible: false, before: beforeFaviconLocation, after: afterFaviconLocation });
    }
  }

  const beforeARecords = getARecords(before);
  const afterARecords = getARecords(after);
  const aRecordDifference = compareStringSets(beforeARecords, afterARecords);
  const routineARecordRotation = Boolean(
    aRecordDifference
    && aRecordDifference.removed.length > 0
  )
    && isRoutineIpRecordRotation(before, after, beforeARecords, afterARecords, ipNetworkIdentities);
  const beforeAaaaRecords = getAaaaRecords(before);
  const afterAaaaRecords = getAaaaRecords(after);
  const aaaaRecordDifference = compareStringSets(beforeAaaaRecords, afterAaaaRecords);
  const routineAaaaRecordRotation = Boolean(
    aaaaRecordDifference
    && aaaaRecordDifference.removed.length > 0
  )
    && isRoutineIpRecordRotation(before, after, beforeAaaaRecords, afterAaaaRecords, ipNetworkIdentities);
  const beforeHostIp = before.hostIp ?? before.dns?.hostIp;
  const afterHostIp = after.hostIp ?? after.dns?.hostIp;
  const hostIpIsResolvedSelection = Boolean(
    beforeHostIp
    && afterHostIp
    && beforeARecords?.includes(beforeHostIp)
    && afterARecords?.includes(afterHostIp),
  );
  const aRecordsStayedExact = knownStringSetsMatch(beforeARecords, afterARecords);
  if (
    compareKnownScalar(beforeHostIp, afterHostIp)
    && !(hostIpIsResolvedSelection && (aRecordsStayedExact || routineARecordRotation))
  ) {
    add({ category: "dns", type: "dns.host_ip_changed", confidence: "high", alertEligible: true, before: beforeHostIp, after: afterHostIp });
  }

  for (const [type, beforeValues, afterValues] of [
    ["dns.a_changed", beforeARecords, afterARecords],
    ["dns.aaaa_changed", beforeAaaaRecords, afterAaaaRecords],
    ["dns.cname_changed", before.dnsCnameRecords ?? before.dns?.cname, after.dnsCnameRecords ?? after.dns?.cname],
  ] as const) {
    const difference = compareStringSets(beforeValues, afterValues);
    const isRoutineRotation = type === "dns.a_changed"
      ? routineARecordRotation
      : type === "dns.aaaa_changed" && routineAaaaRecordRotation;

    if (difference) {
      add({ category: "dns", type, confidence: "high", alertEligible: !isRoutineRotation, before: { removed: difference.removed }, after: { added: difference.added } });
    }
  }

  const beforeJarm = before.jarmHash ?? before.tls?.jarmHash;
  const afterJarm = after.jarmHash ?? after.tls?.jarmHash;
  if (compareKnownScalar(beforeJarm, afterJarm)) {
    add({ category: "tls", type: "tls.jarm_changed", confidence: "high", alertEligible: true, before: beforeJarm, after: afterJarm });
  }

  const beforeCertificate = certificateIdentity(before);
  const afterCertificate = certificateIdentity(after);
  if (beforeCertificate && afterCertificate && stableFingerprint(beforeCertificate) !== stableFingerprint(afterCertificate)) {
    add({ category: "tls", type: "tls.certificate_changed", confidence: "high", alertEligible: true, before: { fingerprint: beforeCertificate.fingerprint }, after: { fingerprint: afterCertificate.fingerprint } });
  }

  const beforeTechnologies = getTechnologySet(before);
  const afterTechnologies = getTechnologySet(after);
  const technologyDifference = compareStringSets(beforeTechnologies, afterTechnologies);
  if (technologyDifference) {
    add({ category: "technology", type: "technology.changed", confidence: "high", alertEligible: true, before: { removed: technologyDifference.removed }, after: { added: technologyDifference.added } });
  }

  const cpeDifference = compareStringSets(getCpeSet(before), getCpeSet(after));
  if (cpeDifference) {
    add({ category: "technology", type: "cpe.changed", confidence: "high", alertEligible: true, before: { removed: cpeDifference.removed }, after: { added: cpeDifference.added } });
  }

  for (const [type, beforeValue, afterValue] of [
    ["metadata.title_changed", before.title, after.title],
    ["metadata.server_changed", before.webServer ?? before.server, after.webServer ?? after.server],
    ["metadata.content_type_changed", before.contentType, after.contentType],
  ] as const) {
    if (compareKnownScalar(beforeValue, afterValue)) {
      add({ category: "content", type, confidence: "high", alertEligible: false, before: beforeValue, after: afterValue });
    }
  }

  const beforeCdn = getCdn(before);
  const afterCdn = getCdn(after);
  if (beforeCdn && afterCdn && stableFingerprint(beforeCdn) !== stableFingerprint(afterCdn)) {
    add({ category: "delivery", type: "metadata.cdn_changed", confidence: "high", alertEligible: true, before: beforeCdn, after: afterCdn });
  }

  const beforeCapabilities = getCapabilities(before);
  const afterCapabilities = getCapabilities(after);
  if (beforeCapabilities && afterCapabilities && stableFingerprint(beforeCapabilities) !== stableFingerprint(afterCapabilities)) {
    add({ category: "delivery", type: "metadata.capabilities_changed", confidence: "high", alertEligible: false, before: beforeCapabilities, after: afterCapabilities });
  }
}

function indexResults(results: readonly ComparableScanResult[]) {
  const indexed = new Map<string, ComparableScanResult>();
  const counts = new Map<string, number>();
  let unidentifiableResultCount = 0;

  for (const result of results) {
    const endpointKey = canonicalizeEndpoint(result);

    if (!endpointKey) {
      unidentifiableResultCount += 1;
      continue;
    }

    const count = (counts.get(endpointKey) ?? 0) + 1;
    counts.set(endpointKey, count);

    if (count === 1) {
      indexed.set(endpointKey, result);
    } else {
      // Comparing an arbitrary row would manufacture changes. Suppress the whole
      // ambiguous endpoint until the caller supplies a unique endpoint inventory.
      indexed.delete(endpointKey);
    }
  }

  const ambiguousEndpointKeys = new Set(
    [...counts.entries()].flatMap(([endpointKey, count]) => (count > 1 ? [endpointKey] : [])),
  );
  return { indexed, ambiguousEndpointKeys, counts, unidentifiableResultCount };
}

export function collectChangedIpRecordAddresses(
  baseline: ComparableScanSnapshot,
  current: ComparableScanSnapshot,
) {
  const baselineIndex = indexResults(baseline.results);
  const currentIndex = indexResults(current.results);
  const addresses = new Set<string>();

  for (const [endpointKey, before] of baselineIndex.indexed) {
    if (baselineIndex.ambiguousEndpointKeys.has(endpointKey) || currentIndex.ambiguousEndpointKeys.has(endpointKey)) {
      continue;
    }

    const after = currentIndex.indexed.get(endpointKey);

    if (!after) {
      continue;
    }

    for (const [beforeAddresses, afterAddresses] of [
      [getARecords(before), getARecords(after)],
      [getAaaaRecords(before), getAaaaRecords(after)],
    ] as const) {
      if (!compareStringSets(beforeAddresses, afterAddresses)) {
        continue;
      }

      for (const address of [...(beforeAddresses ?? []), ...(afterAddresses ?? [])]) {
        const normalized = address.trim();
        if (normalized) addresses.add(normalized);
      }
    }
  }

  return [...addresses].toSorted();
}

export function compareScanResults(input: CompareScanResultsInput): ScanComparisonOutput {
  const maxEndpoints = input.maxEndpoints ?? DEFAULT_MAX_COMPARISON_ENDPOINTS;
  const maxChangeItems = input.maxChangeItems ?? DEFAULT_MAX_CHANGE_ITEMS;

  if (!Number.isSafeInteger(maxEndpoints) || maxEndpoints <= 0 || !Number.isSafeInteger(maxChangeItems) || maxChangeItems <= 0) {
    throw new RangeError("Comparison limits must be positive safe integers.");
  }

  if (input.baseline.results.length > maxEndpoints || input.current.results.length > maxEndpoints) {
    throw new RangeError(`Scan comparison exceeds the ${maxEndpoints} endpoint limit.`);
  }

  const baselineIndex = indexResults(input.baseline.results);
  const currentIndex = indexResults(input.current.results);
  const baseline = baselineIndex.indexed;
  const current = currentIndex.indexed;
  const ambiguousEndpointKeys = new Set([
    ...baselineIndex.ambiguousEndpointKeys,
    ...currentIndex.ambiguousEndpointKeys,
  ]);
  const endpointKeys = [...new Set([...baseline.keys(), ...current.keys()])]
    .filter((endpointKey) => !ambiguousEndpointKeys.has(endpointKey))
    .toSorted();
  const skippedResultCount =
    baselineIndex.unidentifiableResultCount +
    currentIndex.unidentifiableResultCount +
    [...ambiguousEndpointKeys].reduce(
      (total, endpointKey) =>
        total + (baselineIndex.counts.get(endpointKey) ?? 0) + (currentIndex.counts.get(endpointKey) ?? 0),
      0,
    );
  const items: ScanChangeItem[] = [];
  let totalChangeCount = 0;
  let comparedEndpointCount = 0;

  for (const endpointKey of endpointKeys) {
    const before = baseline.get(endpointKey);
    const after = current.get(endpointKey);
    const add = (item: ItemInput) => {
      totalChangeCount += 1;
      if (items.length < maxChangeItems) {
        items.push({ ...item, before: boundEvidence(item.before), after: boundEvidence(item.after), algorithmVersion: SCAN_COMPARISON_ALGORITHM_VERSION, endpointKey });
      }
    };

    if (!before || !after) {
      continue;
    }

    comparedEndpointCount += 1;
    compareEndpoint(before, after, add, input.ipNetworkIdentities);
  }

  return {
    algorithmVersion: SCAN_COMPARISON_ALGORITHM_VERSION,
    items,
    comparedEndpointCount,
    totalChangeCount,
    omittedChangeCount: totalChangeCount - items.length,
    skippedResultCount,
    truncated: totalChangeCount > items.length,
  };
}
