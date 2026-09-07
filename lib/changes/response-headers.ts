export type ResponseHeaderFamily =
  | "access-control"
  | "authentication"
  | "cache-policy"
  | "content"
  | "cookie"
  | "operations"
  | "reporting"
  | "representation"
  | "security"
  | "transport"
  | "unknown";

export type ResponseHeaderComparator =
  | "alt-svc"
  | "cache-control"
  | "content-language"
  | "content-disposition"
  | "content-security-policy"
  | "content-type"
  | "directive-set"
  | "exact"
  | "expires"
  | "json"
  | "report-to"
  | "reporting-endpoints"
  | "set-cookie"
  | "token-set";

export type ResponseHeaderDisposition =
  | "meaningful"
  | "routine"
  | "representation"
  | "unknown";

export type ResponseHeaderAlertBehavior = "semantic" | "never";

export type ResponseHeaderRule = {
  family: ResponseHeaderFamily;
  comparator: ResponseHeaderComparator;
  disposition: ResponseHeaderDisposition;
  alertBehavior: ResponseHeaderAlertBehavior;
};

type NamedResponseHeaderRule = ResponseHeaderRule & {
  names: readonly string[];
};

export function normalizeResponseHeaderName(name: string) {
  return name.trim().toLowerCase().replaceAll("_", "-");
}

const MEANINGFUL_RESPONSE_HEADER_RULES = [
  {
    names: ["content-security-policy"],
    family: "security",
    comparator: "content-security-policy",
    disposition: "meaningful",
    alertBehavior: "semantic",
  },
  {
    names: ["content-security-policy-report-only"],
    family: "security",
    comparator: "content-security-policy",
    disposition: "meaningful",
    alertBehavior: "never",
  },
  {
    names: ["strict-transport-security"],
    family: "security",
    comparator: "directive-set",
    disposition: "meaningful",
    alertBehavior: "semantic",
  },
  {
    names: [
      "cross-origin-embedder-policy",
      "cross-origin-embedder-policy-report-only",
      "cross-origin-opener-policy",
      "cross-origin-opener-policy-report-only",
      "cross-origin-resource-policy",
      "document-policy",
      "document-policy-report-only",
      "feature-policy",
      "origin-agent-cluster",
      "permissions-policy",
      "referrer-policy",
      "x-content-security-policy",
      "x-content-type-options",
      "x-frame-options",
      "x-permitted-cross-domain-policies",
      "x-webkit-csp",
      "x-xss-protection",
    ],
    family: "security",
    comparator: "exact",
    disposition: "meaningful",
    alertBehavior: "semantic",
  },
  {
    names: [
      "access-control-allow-headers",
      "access-control-allow-methods",
      "access-control-expose-headers",
      "timing-allow-origin",
    ],
    family: "access-control",
    comparator: "token-set",
    disposition: "meaningful",
    alertBehavior: "semantic",
  },
  {
    names: [
      "access-control-allow-credentials",
      "access-control-allow-origin",
      "access-control-allow-private-network",
      "access-control-max-age",
    ],
    family: "access-control",
    comparator: "exact",
    disposition: "meaningful",
    alertBehavior: "semantic",
  },
  {
    names: ["set-cookie"],
    family: "cookie",
    comparator: "set-cookie",
    disposition: "meaningful",
    alertBehavior: "semantic",
  },
  {
    names: ["authentication-info", "proxy-authenticate", "www-authenticate"],
    family: "authentication",
    comparator: "exact",
    disposition: "meaningful",
    alertBehavior: "semantic",
  },
  {
    names: ["cache-control", "cdn-cache-control", "surrogate-control"],
    family: "cache-policy",
    comparator: "cache-control",
    disposition: "meaningful",
    alertBehavior: "semantic",
  },
  {
    names: ["vary"],
    family: "cache-policy",
    comparator: "token-set",
    disposition: "meaningful",
    alertBehavior: "semantic",
  },
  {
    names: ["expires"],
    family: "cache-policy",
    comparator: "expires",
    disposition: "meaningful",
    alertBehavior: "semantic",
  },
  {
    names: ["pragma"],
    family: "cache-policy",
    comparator: "directive-set",
    disposition: "meaningful",
    alertBehavior: "semantic",
  },
  {
    names: ["accept-ch", "x-robots-tag"],
    family: "content",
    comparator: "token-set",
    disposition: "meaningful",
    alertBehavior: "semantic",
  },
  {
    names: ["content-language"],
    family: "content",
    comparator: "content-language",
    disposition: "meaningful",
    alertBehavior: "semantic",
  },
  {
    names: ["content-disposition"],
    family: "content",
    comparator: "content-disposition",
    disposition: "meaningful",
    alertBehavior: "semantic",
  },
  {
    names: ["content-location", "refresh"],
    family: "content",
    comparator: "exact",
    disposition: "meaningful",
    alertBehavior: "semantic",
  },
  {
    names: ["report-to"],
    family: "reporting",
    comparator: "report-to",
    disposition: "meaningful",
    alertBehavior: "never",
  },
  {
    names: ["reporting-endpoints"],
    family: "reporting",
    comparator: "reporting-endpoints",
    disposition: "meaningful",
    alertBehavior: "never",
  },
  {
    names: ["nel"],
    family: "reporting",
    comparator: "json",
    disposition: "meaningful",
    alertBehavior: "never",
  },
  {
    names: ["alt-svc"],
    family: "transport",
    comparator: "alt-svc",
    disposition: "meaningful",
    alertBehavior: "semantic",
  },
] as const satisfies readonly NamedResponseHeaderRule[];

const ROUTINE_RESPONSE_HEADER_NAMES = [
  "age",
  "akamai-grn",
  "build-timestamp",
  "cache-status",
  "cf-cache-status",
  "cf-ray",
  "connection",
  "date",
  "fly-request-id",
  "keep-alive",
  "origin-cf-ray",
  "proxy-connection",
  "server-timing",
  "shopify-complexity-score",
  "shopify-complexity-score-v2",
  "traceparent",
  "tracestate",
  "transfer-encoding",
  "via",
  "x-amz-cf-id",
  "x-amz-cf-pop",
  "x-amzn-trace-id",
  "x-b3-flags",
  "x-b3-sampled",
  "x-b3-spanid",
  "x-b3-traceid",
  "x-cache",
  "x-cache-hits",
  "x-cloud-trace-context",
  "x-cm-cache-status",
  "x-contextid",
  "x-envoy-upstream-service-time",
  "x-fb-connection-quality",
  "x-fb-debug",
  "x-hikari-trace",
  "x-matched-path",
  "x-nf-request-id",
  "x-nyt-data-last-modified",
  "x-origin-time",
  "x-railway-request-id",
  "x-request-id",
  "x-response-time",
  "x-runtime",
  "x-served-by",
  "x-slack-unique-id",
  "x-stripe-server-rpc-duration-micros",
  "x-timer",
  "x-transaction-id",
  "x-uber-edge",
  "x-vercel-cache",
  "x-vercel-challenge-token",
  "x-vercel-id",
  "x-vercel-proxy-signature",
  "x-vercel-proxy-signature-ts",
] as const;

const REPRESENTATION_RESPONSE_HEADER_NAMES = [
  "content-digest",
  "content-encoding",
  "content-length",
  "content-md5",
  "content-type",
  "digest",
  "etag",
  "last-modified",
  "link",
  "location",
  "repr-digest",
  "server",
  "x-server",
  "x-aspnet-version",
  "x-generator",
  "x-powered-by",
] as const;

const ROUTINE_RESPONSE_HEADER_PATTERNS = [
  /(?:^|-)correlation-id$/,
  /(?:^|-)request-id$/,
  /(?:^|-)trace-id$/,
  /(?:^|-)transaction-id$/,
  /(?:^|-)ray$/,
] as const;

const ruleByName = new Map<string, ResponseHeaderRule>();

function registerResponseHeaderRule(name: string, rule: ResponseHeaderRule) {
  const normalizedName = normalizeResponseHeaderName(name);
  if (ruleByName.has(normalizedName)) {
    throw new Error(`Duplicate response header rule for ${normalizedName}.`);
  }
  ruleByName.set(normalizedName, rule);
}

for (const rule of MEANINGFUL_RESPONSE_HEADER_RULES) {
  for (const name of rule.names) {
    registerResponseHeaderRule(name, {
      family: rule.family,
      comparator: rule.comparator,
      disposition: rule.disposition,
      alertBehavior: rule.alertBehavior,
    });
  }
}

for (const name of ROUTINE_RESPONSE_HEADER_NAMES) {
  registerResponseHeaderRule(name, {
    family: "operations",
    comparator: "exact",
    disposition: "routine",
    alertBehavior: "never",
  });
}

for (const name of REPRESENTATION_RESPONSE_HEADER_NAMES) {
  registerResponseHeaderRule(name, {
    family: "representation",
    comparator: name === "content-type" ? "content-type" : "exact",
    disposition: "representation",
    alertBehavior: "never",
  });
}

const UNKNOWN_RESPONSE_HEADER_RULE: ResponseHeaderRule = {
  family: "unknown",
  comparator: "exact",
  disposition: "unknown",
  alertBehavior: "never",
};

export function getResponseHeaderRule(name: string): ResponseHeaderRule {
  const normalizedName = normalizeResponseHeaderName(name);
  const registered = ruleByName.get(normalizedName);

  if (registered) {
    return registered;
  }

  if (ROUTINE_RESPONSE_HEADER_PATTERNS.some((pattern) => pattern.test(normalizedName))) {
    return {
      family: "operations",
      comparator: "exact",
      disposition: "routine",
      alertBehavior: "never",
    };
  }

  return UNKNOWN_RESPONSE_HEADER_RULE;
}

export function isVolatileResponseHeader(name: string) {
  return getResponseHeaderRule(name).disposition === "routine";
}

// Retained for historical comparisons whose evidence predates classified
// header changes. New comparisons preserve these values as non-alerting evidence.
export function isIgnoredResponseHeader(name: string) {
  const disposition = getResponseHeaderRule(name).disposition;
  return disposition === "routine" || disposition === "representation";
}
