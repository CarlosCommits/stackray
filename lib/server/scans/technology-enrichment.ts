import {
  buildStructuredTechnologyDetection,
  canonicalizeTechnologyLabel,
  normalizeTechnologyKey,
  type StructuredTechnologyDetection,
  type TechnologyDetectionSource,
} from "./technology-metadata-catalog.ts";

type CpeEntry = {
  cpe: string;
  vendor: string | null;
  product: string | null;
};

export type TechnologyEvidenceItem = {
  name: string;
  version: string | null;
  source: TechnologyDetectionSource;
};

type TechnologyEvidenceInput = {
  persistedTechnologies: readonly string[];
  additionalTechnologies?: readonly string[];
  cpeEntries: readonly CpeEntry[];
  cspJson: Record<string, unknown>;
  bodyDomains: readonly string[];
  bodyFqdns: readonly string[];
};

type DomainTechnologyRule = {
  technologyName: string;
  domains: readonly string[];
};

type NucleiServiceTechnologyMatch = {
  findingKind: string | null;
  matcherName: string | null;
};

const promotedCpeTechnologyNames = new Map<string, string>([
  ["vercel:next.js", "Next.js"],
  ["zeit:next.js", "Next.js"],
  ["wordpress:wordpress", "WordPress"],
  ["woocommerce:woocommerce", "WooCommerce"],
  ["drupal:drupal", "Drupal"],
  ["joomla:joomla\!", "Joomla!"],
  ["magento:magento", "Magento"],
  ["shopify:shopify", "Shopify"],
]);

const titleCaseAcronyms = new Map<string, string>([
  ["ai", "AI"],
  ["api", "API"],
  ["cdn", "CDN"],
  ["ci", "CI"],
  ["crm", "CRM"],
  ["dns", "DNS"],
  ["sso", "SSO"],
  ["ssl", "SSL"],
  ["tls", "TLS"],
]);

const derivedTechnologyDomainRules: DomainTechnologyRule[] = [
  {
    technologyName: "Contentful",
    domains: ["contentful.com", "ctfassets.net", "ctfapps.net"],
  },
  {
    technologyName: "Google Analytics",
    domains: ["google-analytics.com", "tags.example.test"],
  },
  {
    technologyName: "Salesforce",
    domains: ["salesforce.com", "force.com", "pardot.com", "exacttarget.com", "salesforceliveagent.com"],
  },
  {
    technologyName: "Segment",
    domains: ["segment.com"],
  },
  {
    technologyName: "Marketo",
    domains: ["marketo.net"],
  },
  {
    technologyName: "Intercom",
    domains: ["intercom.io", "intercomcdn.com"],
  },
  {
    technologyName: "Plausible Analytics",
    domains: ["plausible.io"],
  },
  {
    technologyName: "Sentry",
    domains: ["sentry.io"],
  },
  {
    technologyName: "Userflow",
    domains: ["userflow.com"],
  },
  {
    technologyName: "hCaptcha",
    domains: ["hcaptcha.com"],
  },
  {
    technologyName: "Pusher",
    domains: ["pusher.com"],
  },
];

function normalizeTechnologyName(value: string) {
  return canonicalizeTechnologyLabel(value).name.trim().toLowerCase();
}

function toTechnologyTitleCase(value: string) {
  return value
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((part) => {
      const normalized = part.toLowerCase();

      return titleCaseAcronyms.get(normalized) ?? normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(" ");
}

function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function appendUnique(technologyNames: string[], seen: Set<string>, nextTechnologyNames: readonly string[]) {
  for (const technologyName of nextTechnologyNames) {
    const normalizedTechnologyName = normalizeTechnologyName(technologyName);

    if (normalizedTechnologyName.length === 0 || seen.has(normalizedTechnologyName)) {
      continue;
    }

    seen.add(normalizedTechnologyName);
    technologyNames.push(technologyName);
  }
}

function getCpeTechnologyKey(entry: CpeEntry) {
  const vendor = entry.vendor?.trim().toLowerCase();
  const product = entry.product?.trim().toLowerCase();

  if (!vendor || !product) {
    return null;
  }

  return `${vendor}:${product}`;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function collectEvidenceDomains({ cspJson, bodyDomains, bodyFqdns }: Omit<TechnologyEvidenceInput, "persistedTechnologies" | "cpeEntries">) {
  const domains = new Set<string>();

  for (const domain of bodyDomains) {
    const normalized = normalizeDomain(domain);

    if (normalized.length > 0) {
      domains.add(normalized);
    }
  }

  for (const fqdn of bodyFqdns) {
    const normalized = normalizeDomain(fqdn);

    if (normalized.length > 0) {
      domains.add(normalized);
    }
  }

  for (const domain of readStringArray(cspJson.domains)) {
    const normalized = normalizeDomain(domain);

    if (normalized.length > 0) {
      domains.add(normalized);
    }
  }

  for (const fqdn of readStringArray(cspJson.fqdn)) {
    const normalized = normalizeDomain(fqdn);

    if (normalized.length > 0) {
      domains.add(normalized);
    }
  }

  return [...domains];
}

export function promoteTechnologiesFromCpe(cpeEntries: readonly CpeEntry[]) {
  const promotedTechnologyNames: string[] = [];
  const seen = new Set<string>();

  for (const cpeEntry of cpeEntries) {
    const key = getCpeTechnologyKey(cpeEntry);

    if (!key) {
      continue;
    }

    const technologyName = promotedCpeTechnologyNames.get(key);

    if (!technologyName) {
      continue;
    }

    appendUnique(promotedTechnologyNames, seen, [technologyName]);
  }

  return promotedTechnologyNames;
}

export function getNucleiDnsServiceTechnologyName(match: NucleiServiceTechnologyMatch) {
  if (match.findingKind !== "dns_service") {
    return null;
  }

  const matcherName = match.matcherName?.trim();

  if (!matcherName) {
    return null;
  }

  const canonicalName = canonicalizeTechnologyLabel(matcherName).name;

  if (canonicalName !== matcherName) {
    return canonicalName;
  }

  return canonicalizeTechnologyLabel(toTechnologyTitleCase(matcherName)).name;
}

export function deriveTechnologiesFromEvidence({
  cspJson,
  bodyDomains,
  bodyFqdns,
}: Omit<TechnologyEvidenceInput, "persistedTechnologies" | "cpeEntries">) {
  const evidenceDomains = collectEvidenceDomains({ cspJson, bodyDomains, bodyFqdns });
  const derivedTechnologyNames: string[] = [];
  const seen = new Set<string>();

  for (const rule of derivedTechnologyDomainRules) {
    const matchesRule = evidenceDomains.some((evidenceDomain) => {
      return rule.domains.some((domain) => evidenceDomain === domain || evidenceDomain.endsWith(`.${domain}`));
    });

    if (matchesRule) {
      appendUnique(derivedTechnologyNames, seen, [rule.technologyName]);
    }
  }

  return derivedTechnologyNames;
}

export function buildEnrichedTechnologies({
  persistedTechnologies,
  additionalTechnologies = [],
  cpeEntries,
  cspJson,
  bodyDomains,
  bodyFqdns,
}: TechnologyEvidenceInput) {
  return buildEnrichedTechnologyDetections({
    persistedTechnologies: persistedTechnologies.map((name) => ({
      ...canonicalizeTechnologyLabel(name),
      source: "wappalyzer" as const,
    })),
    additionalTechnologies: additionalTechnologies.map((name) => ({
      ...canonicalizeTechnologyLabel(name),
      source: "nuclei" as const,
    })),
    cpeEntries,
    cspJson,
    bodyDomains,
    bodyFqdns,
  }).map((technology) => technology.name);
}

export function buildEnrichedTechnologyDetections({
  persistedTechnologies,
  additionalTechnologies = [],
  cpeEntries,
  cspJson,
  bodyDomains,
  bodyFqdns,
}: {
  persistedTechnologies: readonly TechnologyEvidenceItem[];
  additionalTechnologies?: readonly TechnologyEvidenceItem[];
  cpeEntries: readonly CpeEntry[];
  cspJson: Record<string, unknown>;
  bodyDomains: readonly string[];
  bodyFqdns: readonly string[];
}) {
  const detectionOrder: string[] = [];
  const detectionMap = new Map<string, {
    name: string;
    version: string | null;
    sources: Set<TechnologyDetectionSource>;
  }>();

  const appendEvidence = (evidence: TechnologyEvidenceItem) => {
    const canonical = {
      name: canonicalizeTechnologyLabel(evidence.name).name,
      version: evidence.version,
    };
    const key = normalizeTechnologyKey(canonical.name);

    if (!key) {
      return;
    }

    if (!detectionMap.has(key)) {
      detectionOrder.push(key);
      detectionMap.set(key, {
        name: canonical.name,
        version: canonical.version,
        sources: new Set([evidence.source]),
      });
      return;
    }

    const existing = detectionMap.get(key);

    if (!existing) {
      return;
    }

    existing.sources.add(evidence.source);

    if (!existing.version && canonical.version) {
      existing.version = canonical.version;
    }
  };

  for (const technology of persistedTechnologies) {
    appendEvidence(technology);
  }

  for (const technology of additionalTechnologies) {
    appendEvidence(technology);
  }

  for (const technologyName of promoteTechnologiesFromCpe(cpeEntries)) {
    appendEvidence({
      ...canonicalizeTechnologyLabel(technologyName),
      source: "cpe",
    });
  }

  for (const technologyName of deriveTechnologiesFromEvidence({
    cspJson,
    bodyDomains,
    bodyFqdns,
  })) {
    appendEvidence({
      ...canonicalizeTechnologyLabel(technologyName),
      source: "derived",
    });
  }

  return detectionOrder.flatMap((key): StructuredTechnologyDetection[] => {
    const detection = detectionMap.get(key);

    if (!detection) {
      return [];
    }

    const sources = [...detection.sources];
    const inferred = sources.some((source) => source !== "wappalyzer" && source !== "wordpress");

    return [
      buildStructuredTechnologyDetection({
        name: detection.name,
        version: detection.version,
        sources,
        inferred,
      }),
    ];
  });
}
