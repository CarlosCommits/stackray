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
  version?: string | null;
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
};

type NucleiServiceTechnologyMatch = {
  templateId?: string | null;
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

const nucleiDnsServiceTechnologyNameOverrides = new Map<string, string>([
  ["txt-service-detect:google-workspace", "Google Site Verification"],
  ["txt-service-detect:yandex", "Yandex Site Verification"],
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

function getNucleiDnsServiceTechnologyNameOverride(match: NucleiServiceTechnologyMatch, matcherName: string) {
  const templateId = match.templateId?.trim();

  if (!templateId) {
    return null;
  }

  return nucleiDnsServiceTechnologyNameOverrides.get(`${templateId}:${matcherName}`) ?? null;
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

  const overrideTechnologyName = getNucleiDnsServiceTechnologyNameOverride(match, matcherName);

  if (overrideTechnologyName) {
    return overrideTechnologyName;
  }

  const canonicalName = canonicalizeTechnologyLabel(matcherName).name;

  if (canonicalName !== matcherName) {
    return canonicalName;
  }

  return canonicalizeTechnologyLabel(toTechnologyTitleCase(matcherName)).name;
}

export function buildEnrichedTechnologies({
  persistedTechnologies,
  additionalTechnologies = [],
  cpeEntries,
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
  }).map((technology) => technology.name);
}

export function buildEnrichedTechnologyDetections({
  persistedTechnologies,
  additionalTechnologies = [],
  cpeEntries,
}: {
  persistedTechnologies: readonly TechnologyEvidenceItem[];
  additionalTechnologies?: readonly TechnologyEvidenceItem[];
  cpeEntries: readonly CpeEntry[];
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
