import { createHash } from "node:crypto";

import {
  getResponseHeaderRule,
  normalizeResponseHeaderName,
} from "../../changes/response-headers.ts";
import {
  canonicalizeSetCookieForComparison,
  splitCombinedSetCookieHeader,
} from "../../changes/set-cookie.ts";

export const HEADER_CANONICALIZATION_VERSION = "12";

const EPHEMERAL_REPORTING_TOKEN_PARAMETERS = new Set([
  "auth",
  "sig",
  "signature",
  "t",
  "token",
]);
const EPHEMERAL_REPORTING_TIME_PARAMETERS = new Set([
  "exp",
  "expires",
  "expiry",
  "timestamp",
  "ts",
]);
const REPORTING_URL_BASE = "https://stackray.invalid";

export interface EndpointIdentityInput {
  url?: string | null;
  input?: string | null;
  finalUrl?: string | null;
  scheme?: string | null;
  host?: string | null;
  port?: string | number | null;
  path?: string | null;
}

export interface CanonicalHeaders {
  fingerprint: string;
  names: string[];
  fingerprintsByName: Record<string, string>;
}

export interface CanonicalHeaderViews {
  version: string;
  strict: CanonicalHeaders;
  semantic: CanonicalHeaders;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePathname(pathname: string) {
  const path = pathname.trim();

  if (!path) {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function tryParseUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function canonicalizeEndpoint(input: EndpointIdentityInput): string | null {
  // The probed URL is authoritative. The final URL represents routing evidence and
  // must not collapse two distinct probed endpoints that redirect to one location.
  const parsed = tryParseUrl(input.url) ?? tryParseUrl(input.input);
  const scheme = (parsed?.protocol.replace(/:$/, "") ?? input.scheme ?? "").trim().toLowerCase();
  const host = (parsed?.hostname ?? input.host ?? "").trim().toLowerCase().replace(/\.$/, "");

  if (!scheme || !host) {
    // A final URL is still preferable to dropping a legacy row with no probed URL.
    const finalUrl = tryParseUrl(input.finalUrl);

    if (!finalUrl) {
      return null;
    }

    return canonicalizeEndpoint({ url: finalUrl.href });
  }

  const rawPort = String(parsed?.port ?? input.port ?? "").trim();
  const defaultPort = (scheme === "http" && rawPort === "80") || (scheme === "https" && rawPort === "443");
  const port = rawPort && !defaultPort ? `:${rawPort}` : "";
  const path = normalizePathname(parsed?.pathname ?? input.path ?? "/");

  return `${scheme}://${host}${port}${path}`;
}

function normalizeHeaderValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(normalizeHeaderValue);
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value).trim().replace(/\s+/g, " ")];
  }

  if (value === null) {
    return [""];
  }

  return [];
}

function isEphemeralReportingQueryValue(name: string, value: string) {
  const normalizedName = name.trim().toLowerCase();

  if (EPHEMERAL_REPORTING_TIME_PARAMETERS.has(normalizedName)) {
    return /^\d{9,}$/.test(value) || /^\d{4}-\d{2}-\d{2}t/i.test(value);
  }

  if (EPHEMERAL_REPORTING_TOKEN_PARAMETERS.has(normalizedName)) {
    // Reporting collectors commonly use signed, opaque query values that rotate
    // without changing the collector itself. Keep short routing values intact.
    return value.length >= 24 && /^[A-Za-z0-9._~+/%=-]+$/.test(value);
  }

  // Providers also put rotating values behind generic names such as `q`, `s`,
  // `brsid`, and `st`. Restrict shape-based matching to long numeric IDs or
  // opaque mixed-character values so ordinary routing parameters remain exact.
  if (/^\d{13,}$/.test(value)) {
    return true;
  }

  return value.length >= 24
    && /^[A-Za-z0-9._~+/%=-]+$/.test(value)
    && /[A-Za-z]/.test(value)
    && /\d/.test(value)
    && (/[A-Z]/.test(value) || /[._~+/%=-]/.test(value));
}

function isCloudflareNelToken(url: URL, name: string, value: string) {
  return name.trim().toLowerCase() === "s"
    && url.hostname === "a.nel.cloudflare.com"
    && url.pathname === "/report/v4"
    && value.length >= 24
    && /^[A-Za-z0-9._~+/%=-]+$/.test(value);
}

function canonicalizeReportingUrl(value: string) {
  const trimmed = value.trim();

  try {
    const absolute = /^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(trimmed);
    const url = new URL(trimmed, REPORTING_URL_BASE);
    const normalizedParameters = new URLSearchParams();

    for (const [name, parameterValue] of url.searchParams) {
      normalizedParameters.append(
        name,
        isEphemeralReportingQueryValue(name, parameterValue)
          || isCloudflareNelToken(url, name, parameterValue)
          ? "<ephemeral>"
          : parameterValue,
      );
    }

    url.search = normalizedParameters.size > 0 ? `?${normalizedParameters.toString()}` : "";

    if (absolute) {
      return url.href;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return trimmed;
  }
}

function isOpaqueReportingValuePair(before: string, after: string) {
  if (before === after || before.length !== after.length) {
    return false;
  }

  return /^[a-f\d]{8,}$/i.test(before) && /^[a-f\d]{8,}$/i.test(after)
    || /^\d{10,}$/.test(before) && /^\d{10,}$/.test(after)
    || before.length >= 12
      && /^[A-Za-z\d._~+/=-]+$/.test(before)
      && /^[A-Za-z\d._~+/=-]+$/.test(after)
      && /[A-Za-z]/.test(before)
      && /\d/.test(before)
      && /[A-Za-z]/.test(after)
      && /\d/.test(after);
}

function reportingUrlsDifferOnlyByOpaqueValues(before: string, after: string) {
  try {
    const beforeAbsolute = /^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(before);
    const afterAbsolute = /^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(after);

    if (beforeAbsolute !== afterAbsolute) {
      return false;
    }

    const beforeUrl = new URL(before, REPORTING_URL_BASE);
    const afterUrl = new URL(after, REPORTING_URL_BASE);
    if (
      beforeUrl.origin !== afterUrl.origin
      || beforeUrl.pathname !== afterUrl.pathname
      || beforeUrl.hash !== afterUrl.hash
    ) {
      return false;
    }

    const beforeParameters = [...beforeUrl.searchParams].toSorted(([leftName, leftValue], [rightName, rightValue]) =>
      leftName.localeCompare(rightName) || leftValue.localeCompare(rightValue),
    );
    const afterParameters = [...afterUrl.searchParams].toSorted(([leftName, leftValue], [rightName, rightValue]) =>
      leftName.localeCompare(rightName) || leftValue.localeCompare(rightValue),
    );

    return beforeParameters.length === afterParameters.length
      && beforeParameters.every(([beforeName, beforeValue], index) => {
        const [afterName, afterValue] = afterParameters[index] ?? [];
        return beforeName === afterName
          && (beforeValue === afterValue || isOpaqueReportingValuePair(beforeValue, afterValue));
      });
  } catch {
    return false;
  }
}

function canonicalizeReportToValue(value: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    try {
      // The legacy header permits multiple JSON objects separated by commas.
      parsed = JSON.parse(`[${value}]`);
    } catch {
      return value;
    }
  }

  function normalizeUrls(entry: unknown): unknown {
    if (Array.isArray(entry)) {
      return entry
        .map(normalizeUrls)
        .toSorted((left, right) => stableSerialize(left).localeCompare(stableSerialize(right)));
    }

    if (entry === null || typeof entry !== "object") {
      return entry;
    }

    return Object.fromEntries(
      Object.entries(entry as Record<string, unknown>).map(([key, item]) => [
        key,
        key.toLowerCase() === "url" && typeof item === "string"
          ? canonicalizeReportingUrl(item)
          : normalizeUrls(item),
      ]),
    );
  }

  return stableSerialize(normalizeUrls(parsed));
}

function splitOutsideQuotes(value: string, delimiter = ",") {
  const parts: string[] = [];
  let start = 0;
  let quoted = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (quoted && character === "\\") {
      escaped = true;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === delimiter && !quoted) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  if (quoted || escaped) {
    return null;
  }

  parts.push(value.slice(start).trim());
  return parts;
}

function canonicalizeReportingEndpointsValue(value: string) {
  const members = splitOutsideQuotes(value);

  if (!members || members.some((member) => member.length === 0)) {
    return value;
  }

  const parsedMembers = members.map((member) => {
    const match = /^([A-Za-z*][A-Za-z\d_.*-]*)\s*=\s*"((?:\\["\\]|[^"\\])*)"(.*)$/.exec(member);

    if (!match) {
      return null;
    }

    const [, name, quotedUrl, rawParameters] = match;
    const url = quotedUrl.replace(/\\(["\\])/g, "$1");
    const parameters = rawParameters.trim().replace(/\s+/g, " ");

    return {
      name: name.toLowerCase(),
      value: `${name.toLowerCase()}=${JSON.stringify(canonicalizeReportingUrl(url))}${parameters}`,
    };
  });

  if (parsedMembers.some((member) => member === null)) {
    return value;
  }

  return parsedMembers
    .filter((member): member is NonNullable<typeof member> => member !== null)
    .toSorted((left, right) => left.name.localeCompare(right.name))
    .map((member) => member.value)
    .join(",");
}

function canonicalizeCspHashSource(value: string) {
  const match = /^'(sha256|sha384|sha512)-([A-Za-z\d+/_-]+={0,2})'$/i.exec(value);

  if (!match) {
    return null;
  }

  const [, rawAlgorithm, rawDigest] = match;
  const algorithm = rawAlgorithm.toLowerCase();
  const digestLength = rawDigest.replace(/=+$/, "").length;
  const expectedDigestLength = algorithm === "sha256" ? 43 : algorithm === "sha384" ? 64 : 86;

  return digestLength === expectedDigestLength ? `'${algorithm}-<digest>'` : null;
}

const CONTENT_SECURITY_POLICY_DIRECTIVES = new Set([
  "base-uri",
  "block-all-mixed-content",
  "child-src",
  "connect-src",
  "default-src",
  "fenced-frame-src",
  "font-src",
  "form-action",
  "frame-ancestors",
  "frame-src",
  "img-src",
  "manifest-src",
  "media-src",
  "navigate-to",
  "object-src",
  "plugin-types",
  "prefetch-src",
  "report-to",
  "report-uri",
  "require-sri-for",
  "require-trusted-types-for",
  "sandbox",
  "script-src",
  "script-src-attr",
  "script-src-elem",
  "style-src",
  "style-src-attr",
  "style-src-elem",
  "trusted-types",
  "upgrade-insecure-requests",
  "worker-src",
]);

function splitCombinedContentSecurityPolicyHeader(value: string) {
  const policies: string[] = [];
  let start = 0;
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (quote && character === "\\") {
      escaped = true;
      continue;
    }

    if (character === "'" || character === '"') {
      quote = quote === character ? null : quote ?? character;
      continue;
    }

    if (character !== "," || quote) {
      continue;
    }

    const remainder = value.slice(index + 1).trimStart();
    const nextToken = /^([a-z][a-z\d-]*)\b/i.exec(remainder)?.[1]?.toLowerCase();
    if (!nextToken || !CONTENT_SECURITY_POLICY_DIRECTIVES.has(nextToken)) {
      continue;
    }

    policies.push(value.slice(start, index).trim());
    start = index + 1;
  }

  policies.push(value.slice(start).trim());
  return policies.filter(Boolean);
}

function canonicalizeSingleContentSecurityPolicyValue(value: string) {
  const directives = new Map<string, string>();

  for (const rawDirective of value.split(";")) {
    const [rawName, ...rawValues] = rawDirective.trim().split(/\s+/);
    const name = rawName?.toLowerCase();

    if (!name || directives.has(name)) {
      continue;
    }

    const values = rawValues.map((entry) => {
      if (name === "report-uri") {
        return canonicalizeReportingUrl(entry);
      }

      if (/^'nonce-[^']+'$/i.test(entry)) {
        return "'nonce-<ephemeral>'";
      }

      return canonicalizeCspHashSource(entry) ?? entry;
    });

    directives.set(name, [name, ...values.toSorted()].join(" "));
  }

  return [...directives.entries()]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([, directive]) => directive)
    .join(";");
}

function canonicalizeContentSecurityPolicyValue(value: string) {
  return stableSerialize(
    splitCombinedContentSecurityPolicyHeader(value)
      .map(canonicalizeSingleContentSecurityPolicyValue)
      .toSorted(),
  );
}

function parseComparableContentSecurityPolicy(value: string) {
  const directives = new Map<string, string[]>();

  for (const rawDirective of value.split(";")) {
    const [rawName, ...rawValues] = rawDirective.trim().split(/\s+/);
    const name = rawName?.toLowerCase();

    if (!name || directives.has(name)) {
      continue;
    }

    directives.set(name, rawValues.map((entry) => {
      if (name === "report-uri") {
        return entry;
      }

      if (/^'nonce-[^']+'$/i.test(entry)) {
        return "'nonce-<ephemeral>'";
      }

      return canonicalizeCspHashSource(entry) ?? entry;
    }).toSorted());
  }

  return directives;
}

function reportingUrlSetsMatch(before: readonly string[], after: readonly string[]) {
  if (before.length !== after.length) {
    return false;
  }

  const unmatched = new Set(after.map((_, index) => index));
  for (const beforeUrl of before) {
    const match = [...unmatched].find((index) => {
      const afterUrl = after[index];
      return afterUrl !== undefined
        && (canonicalizeReportingUrl(beforeUrl) === canonicalizeReportingUrl(afterUrl)
          || reportingUrlsDifferOnlyByOpaqueValues(beforeUrl, afterUrl));
    });

    if (match === undefined) {
      return false;
    }

    unmatched.delete(match);
  }

  return true;
}

function contentSecurityPolicyValuesMatch(before: string, after: string) {
  const beforeDirectives = parseComparableContentSecurityPolicy(before);
  const afterDirectives = parseComparableContentSecurityPolicy(after);

  if (beforeDirectives.size !== afterDirectives.size) {
    return false;
  }

  for (const [name, beforeValues] of beforeDirectives) {
    const afterValues = afterDirectives.get(name);
    if (!afterValues) {
      return false;
    }

    if (name === "report-uri") {
      if (!reportingUrlSetsMatch(beforeValues, afterValues)) {
        return false;
      }
      continue;
    }

    if (stableSerialize(beforeValues) !== stableSerialize(afterValues)) {
      return false;
    }
  }

  return true;
}

export function contentSecurityPolicyHeaderValuesMatch(
  before: readonly string[],
  after: readonly string[],
) {
  const beforePolicies = before.flatMap(splitCombinedContentSecurityPolicyHeader);
  const afterPolicies = after.flatMap(splitCombinedContentSecurityPolicyHeader);

  if (beforePolicies.length !== afterPolicies.length) {
    return false;
  }

  const unmatched = new Set(afterPolicies.map((_, index) => index));
  for (const beforeValue of beforePolicies) {
    const match = [...unmatched].find((index) => {
      const afterValue = afterPolicies[index];
      return afterValue !== undefined && contentSecurityPolicyValuesMatch(beforeValue, afterValue);
    });

    if (match === undefined) {
      return false;
    }

    unmatched.delete(match);
  }

  return true;
}

function canonicalizeTokenSet(value: string) {
  const members = splitOutsideQuotes(value);

  if (!members) {
    return value;
  }

  return members
    .map((member) => member.trim().toLowerCase())
    .filter(Boolean)
    .toSorted()
    .join(",");
}

function canonicalizeContentLanguage(value: string) {
  const languages = splitOutsideQuotes(value);

  if (!languages) {
    return value;
  }

  return [...new Set(languages.map((language) => {
    const normalized = language.trim().toLowerCase();
    const primaryLanguage = /^([a-z]{2,8})(?:-[a-z0-9]{1,8})*$/.exec(normalized)?.[1];
    return primaryLanguage ?? normalized;
  }).filter(Boolean))]
    .toSorted()
    .join(",");
}

function canonicalizeDirectiveSet(value: string, delimiter = ";") {
  const directives = splitOutsideQuotes(value, delimiter);

  if (!directives) {
    return value;
  }

  return directives
    .map((directive) => {
      const [rawName, ...rawValue] = directive.trim().split("=");
      const name = rawName?.trim().toLowerCase();
      const normalizedValue = rawValue.join("=").trim();
      return normalizedValue ? `${name}=${normalizedValue}` : name;
    })
    .filter(Boolean)
    .toSorted()
    .join(delimiter);
}

function canonicalizeCacheControl(value: string) {
  const directives = splitOutsideQuotes(value);

  if (!directives) {
    return value;
  }

  return directives
    .map((directive) => {
      const [rawName, ...rawValue] = directive.trim().split("=");
      const name = rawName?.trim().toLowerCase();
      const normalizedValue = rawValue.join("=").trim();

      if (!name) {
        return "";
      }

      if ((name === "max-age" || name === "s-maxage") && normalizedValue) {
        const numericValue = normalizedValue.replace(/^"|"$/g, "");
        if (/^\d+$/.test(numericValue) && Number(numericValue) > 0) {
          return `${name}=<positive>`;
        }
      }

      return normalizedValue ? `${name}=${normalizedValue}` : name;
    })
    .filter(Boolean)
    .toSorted()
    .join(",");
}

function canonicalizeJson(value: string) {
  try {
    return stableSerialize(JSON.parse(value));
  } catch {
    return value;
  }
}

function canonicalizeContentType(value: string) {
  const [rawMediaType, ...rawParameters] = value.split(";");
  const mediaType = rawMediaType?.trim().toLowerCase();

  if (!mediaType) {
    return value;
  }

  const parameters = rawParameters
    .map((parameter) => {
      const [rawName, ...rawValue] = parameter.split("=");
      const name = rawName?.trim().toLowerCase();
      const parameterValue = rawValue.join("=").trim();
      return name ? `${name}=${name === "charset" ? parameterValue.toLowerCase() : parameterValue}` : "";
    })
    .filter(Boolean)
    .toSorted();

  return [mediaType, ...parameters].join(";");
}

function canonicalizeContentDisposition(value: string) {
  return value.trim().toLowerCase() === "inline" ? null : value;
}

function cacheControlOverridesExpires(valuesByName: ReadonlyMap<string, readonly string[]>) {
  return (valuesByName.get("cache-control") ?? []).some((value) => (
    /(?:^|,)\s*(?:s-maxage|max-age)\s*=/i.test(value)
  ));
}

function canonicalizeExpires(value: string, valuesByName: ReadonlyMap<string, readonly string[]>) {
  if (cacheControlOverridesExpires(valuesByName)) {
    return null;
  }

  const dateValue = valuesByName.get("date")?.[0];
  const expiresAt = Date.parse(value);
  const responseAt = dateValue ? Date.parse(dateValue) : Number.NaN;

  if (Number.isFinite(expiresAt) && Number.isFinite(responseAt)) {
    return `ttl=${Math.round((expiresAt - responseAt) / 1_000)}`;
  }

  return value;
}

function canonicalizeAltSvc(value: string) {
  const alternatives = splitOutsideQuotes(value);

  if (!alternatives) {
    return value;
  }

  const canonicalAlternatives = alternatives
    .map((alternative) => {
      const parts = splitOutsideQuotes(alternative, ";");

      if (!parts || parts.length === 0) {
        return alternative;
      }

      const [rawService, ...parameters] = parts;
      const service = rawService.trim().replace(/\s*=\s*/, "=").replace(/^h3-\d+=/i, "h3=");
      const stableParameters = parameters
        .filter((parameter) => !/^\s*ma\s*=/i.test(parameter))
        .map((parameter) => parameter.trim().replace(/\s+/g, " "))
        .toSorted();

      return [service, ...stableParameters].join(";");
    })
  return [...new Set(canonicalAlternatives)]
    .toSorted()
    .join(",");
}

function canonicalizeSemanticHeaderValue(
  name: string,
  value: string,
  valuesByName: ReadonlyMap<string, readonly string[]>,
) {
  switch (getResponseHeaderRule(name).comparator) {
    case "alt-svc":
      return canonicalizeAltSvc(value);
    case "cache-control":
      return canonicalizeCacheControl(value);
    case "content-language":
      return canonicalizeContentLanguage(value);
    case "content-disposition":
      return canonicalizeContentDisposition(value);
    case "content-security-policy":
      return canonicalizeContentSecurityPolicyValue(value);
    case "content-type":
      return canonicalizeContentType(value);
    case "directive-set":
      return canonicalizeDirectiveSet(value);
    case "expires":
      return canonicalizeExpires(value, valuesByName);
    case "json":
      return canonicalizeJson(value);
    case "report-to":
      return canonicalizeReportToValue(value);
    case "reporting-endpoints":
      return canonicalizeReportingEndpointsValue(value);
    case "set-cookie":
      return value;
    case "token-set":
      return canonicalizeTokenSet(value);
    case "exact":
      return value;
  }
}

function buildCanonicalHeaders(headers: Record<string, unknown>, semantic: boolean): CanonicalHeaders {
  const merged = new Map<string, string[]>();

  for (const [rawName, rawValue] of Object.entries(headers)) {
    const name = normalizeResponseHeaderName(rawName);

    if (!name) {
      continue;
    }

    const normalizedValues = normalizeHeaderValue(rawValue);
    if (normalizedValues.length === 0) {
      continue;
    }

    merged.set(name, [...(merged.get(name) ?? []), ...normalizedValues]);
  }

  const canonicalized = new Map<string, string[]>();

  for (const [name, values] of merged) {
    if (semantic && getResponseHeaderRule(name).disposition !== "meaningful") {
      continue;
    }

    const nextValues = semantic
      ? name === "set-cookie"
        ? values.flatMap(splitCombinedSetCookieHeader).map(canonicalizeSetCookieForComparison)
        : values.flatMap((value) => {
          const canonical = canonicalizeSemanticHeaderValue(name, value, merged);
          return canonical === null ? [] : [canonical];
        })
      : values;

    if (nextValues.length > 0) {
      canonicalized.set(name, nextValues);
    }
  }

  const entries = [...canonicalized.entries()]
    .map(([name, values]) => [name, values.toSorted()] as const)
    .toSorted(([left], [right]) => left.localeCompare(right));
  const serialized = JSON.stringify(entries);

  return {
    fingerprint: sha256(serialized),
    names: entries.map(([name]) => name),
    fingerprintsByName: Object.fromEntries(entries.map(([name, values]) => [name, sha256(JSON.stringify(values))])),
  };
}

export function canonicalizeResponseHeaders(headers: Record<string, unknown>): CanonicalHeaderViews {
  return {
    version: HEADER_CANONICALIZATION_VERSION,
    strict: buildCanonicalHeaders(headers, false),
    semantic: buildCanonicalHeaders(headers, true),
  };
}

export function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .toSorted(([left], [right]) => left.localeCompare(right));

  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(",")}}`;
}

export function stableFingerprint(value: unknown) {
  return sha256(stableSerialize(value));
}
