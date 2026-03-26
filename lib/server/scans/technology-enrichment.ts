type CpeEntry = {
  cpe: string;
  vendor: string | null;
  product: string | null;
};

type TechnologyEvidenceInput = {
  persistedTechnologies: readonly string[];
  cpeEntries: readonly CpeEntry[];
  cspJson: Record<string, unknown>;
  bodyDomains: readonly string[];
  bodyFqdns: readonly string[];
};

type DomainTechnologyRule = {
  technologyName: string;
  domains: readonly string[];
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

const derivedTechnologyDomainRules: DomainTechnologyRule[] = [
  {
    technologyName: "Contentful",
    domains: ["contentful.com", "ctfassets.net", "ctfapps.net"],
  },
  {
    technologyName: "Google Analytics",
    domains: ["google-analytics.com", "googletagmanager.com"],
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
  return value.trim().toLowerCase();
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
  cpeEntries,
  cspJson,
  bodyDomains,
  bodyFqdns,
}: TechnologyEvidenceInput) {
  const technologyNames: string[] = [];
  const seen = new Set<string>();

  appendUnique(technologyNames, seen, persistedTechnologies);
  appendUnique(technologyNames, seen, promoteTechnologiesFromCpe(cpeEntries));
  appendUnique(
    technologyNames,
    seen,
    deriveTechnologiesFromEvidence({
      cspJson,
      bodyDomains,
      bodyFqdns,
    }),
  );

  return technologyNames;
}
