export const CHANGE_TYPE_DEFINITIONS = [
  {
    type: "status.changed",
    label: "HTTP status changed",
    category: "availability",
    description: "The endpoint returned a different HTTP status than it did in the baseline scan.",
  },
  {
    type: "redirect.changed",
    label: "Redirect behavior changed",
    category: "availability",
    description: "The redirect destination or redirect chain changed between scans.",
  },
  {
    type: "body_fingerprint.changed",
    label: "Response body changed",
    category: "content",
    description: "The response body's similarity fingerprint changed. Stackray stores fingerprints, not the response body.",
  },
  {
    type: "response_headers.changed",
    label: "Response headers changed",
    category: "content",
    description: "Stored response-header values differ from the baseline. Only meaningful policy changes trigger alerts.",
  },
  {
    type: "favicon.changed",
    label: "Favicon changed",
    category: "content",
    description: "The favicon fingerprint changed, indicating that the served icon asset is different.",
  },
  {
    type: "favicon_location.changed",
    label: "Favicon location changed",
    category: "content",
    description: "The favicon stayed the same, but its served location changed.",
  },
  {
    type: "dns.host_ip_changed",
    label: "Resolved IP changed",
    category: "infrastructure",
    description: "The primary resolved IP address differs from the baseline scan.",
  },
  {
    type: "dns.a_changed",
    label: "IPv4 DNS records changed",
    category: "infrastructure",
    description: "The target's IPv4 DNS record set changed.",
  },
  {
    type: "dns.aaaa_changed",
    label: "IPv6 DNS records changed",
    category: "infrastructure",
    description: "The target's IPv6 DNS record set changed.",
  },
  {
    type: "dns.cname_changed",
    label: "CNAME records changed",
    category: "infrastructure",
    description: "The target now points to a different canonical hostname.",
  },
  {
    type: "tls.certificate_changed",
    label: "TLS certificate changed",
    category: "tls",
    description: "The stored TLS certificate fingerprint differs from the baseline scan.",
  },
  {
    type: "tls.jarm_changed",
    label: "JARM fingerprint changed",
    category: "tls",
    description: "The endpoint's JARM TLS fingerprint differs from the baseline scan.",
  },
  {
    type: "technology.changed",
    label: "Detected technologies changed",
    category: "technology",
    description: "The set of detected technologies changed between scans.",
  },
  {
    type: "cpe.changed",
    label: "Detected CPE identifiers changed",
    category: "technology",
    description: "The set of detected Common Platform Enumeration identifiers changed.",
  },
  {
    type: "metadata.title_changed",
    label: "Page title changed",
    category: "content",
    description: "The page title returned by the endpoint changed.",
  },
  {
    type: "metadata.server_changed",
    label: "Web server identity changed",
    category: "content",
    description: "The endpoint reported a different web-server identity.",
  },
  {
    type: "metadata.content_type_changed",
    label: "Content type changed",
    category: "content",
    description: "The endpoint returned a different content type.",
  },
  {
    type: "metadata.cdn_changed",
    label: "CDN or WAF identity changed",
    category: "availability",
    description: "The detected CDN or web application firewall identity changed.",
  },
  {
    type: "metadata.capabilities_changed",
    label: "HTTP capabilities changed",
    category: "availability",
    description: "The endpoint's detected HTTP protocol capabilities changed.",
  },
] as const;

type ChangeTypeCategoryDefinition = {
  key: string;
  label: string;
  description: string;
  definitionCategories: readonly string[];
};

export const CHANGE_TYPE_CATEGORY_DEFINITIONS: readonly ChangeTypeCategoryDefinition[] = [
  {
    key: "availability",
    label: "Availability",
    description: "Response behavior and reachability.",
    definitionCategories: ["availability"],
  },
  {
    key: "content",
    label: "Content",
    description: "Content, headers, and site identity.",
    definitionCategories: ["content"],
  },
  {
    key: "infrastructure",
    label: "Infrastructure",
    description: "DNS, network, and TLS changes.",
    definitionCategories: ["infrastructure", "tls"],
  },
  {
    key: "technology",
    label: "Technology",
    description: "Detected software and capabilities.",
    definitionCategories: ["technology"],
  },
] as const;

export type KnownChangeType = (typeof CHANGE_TYPE_DEFINITIONS)[number]["type"];

export const RETIRED_CHANGE_TYPES = ["endpoint.added", "endpoint.removed"] satisfies string[];

export function isRetiredChangeType(changeType: string) {
  return RETIRED_CHANGE_TYPES.includes(changeType);
}

const definitionByType = new Map<string, (typeof CHANGE_TYPE_DEFINITIONS)[number]>(
  CHANGE_TYPE_DEFINITIONS.map((definition) => [definition.type, definition]),
);

export function getChangeTypeDefinition(changeType: string) {
  return definitionByType.get(changeType) ?? null;
}
