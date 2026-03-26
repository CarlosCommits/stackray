type CpeEntry = {
  cpe: string;
  vendor: string | null;
  product: string | null;
};

type WordPressDetails = {
  plugins?: readonly string[] | null;
  themes?: readonly string[] | null;
} | null;

type TechnologyDisplayInput = {
  technologies: readonly string[];
  wordpress?: WordPressDetails;
  cpe?: readonly CpeEntry[];
};

export type TechnologyDisplayModel = {
  orderedTechnologyItems: TechnologyDisplayItem[];
  orderedTechnologies: string[];
  primaryTechnologyItems: TechnologyDisplayItem[];
  primaryTechnologies: string[];
  additionalFindingItems: TechnologyDisplayItem[];
  additionalFindings: string[];
  wordpress: {
    pluginItems: TechnologyDisplayItem[];
    plugins: string[];
    themeItems: TechnologyDisplayItem[];
    themes: string[];
  };
};

export type TechnologyDisplayItem = {
  name: string;
  inferred: boolean;
};

const coreTechnologyPriorities = new Map<string, number>([
  ["wordpress", 100],
  ["woocommerce", 95],
  ["shopify", 95],
  ["magento", 95],
  ["drupal", 95],
  ["joomla", 95],
  ["joomla!", 95],
  ["bigcommerce", 95],
  ["ghost", 95],
  ["webflow", 95],
  ["wix", 95],
  ["squarespace", 95],
  ["next.js", 90],
  ["nuxt.js", 90],
  ["gatsby", 90],
  ["astro", 90],
  ["react", 80],
  ["angular", 80],
  ["vue.js", 80],
  ["sveltekit", 80],
]);

const inferredWordPressPluginPatterns: Array<{ pattern: RegExp; label?: string }> = [
  { pattern: /^cookieyes$/i },
  { pattern: /^yoast seo(?: premium)?$/i },
  { pattern: /^jetpack$/i },
  { pattern: /^modern image formats$/i },
  { pattern: /^performance lab$/i },
  { pattern: /^smash balloon instagram feed$/i },
  { pattern: /^contentviews$/i, label: "ContentViews" },
  { pattern: /for wordpress$/i },
];

const wordPressIndicators = new Set(["wordpress", "woocommerce"]);

function stripVersionSuffix(value: string) {
  return value.replace(/:\d[\w.-]*$/u, "").trim();
}

function normalizeTechnologyName(value: string) {
  return stripVersionSuffix(value).trim().toLowerCase();
}

function normalizeLoose(value: string) {
  return normalizeTechnologyName(value).replace(/[^a-z0-9]+/g, "");
}

function toTitleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => {
      const normalized = part.toLowerCase();

      if (normalized === "seo") {
        return "SEO";
      }

      if (normalized === "woocommerce") {
        return "WooCommerce";
      }

      if (normalized === "wordpress") {
        return "WordPress";
      }

      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(" ");
}

function appendUniqueItems(values: TechnologyDisplayItem[], seen: Set<string>, nextValues: readonly TechnologyDisplayItem[]) {
  for (const value of nextValues) {
    const normalized = normalizeTechnologyName(value.name);

    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    values.push(value);
  }
}

function formatWordPressPluginSlug(pluginSlug: string) {
  return toTitleCase(pluginSlug);
}

function hasWordPressCpe(cpeEntries: readonly CpeEntry[]) {
  return cpeEntries.some((entry) => entry.vendor?.toLowerCase() === "wordpress" && entry.product?.toLowerCase() === "wordpress");
}

function isCoreTechnology(technologyName: string) {
  return coreTechnologyPriorities.has(normalizeTechnologyName(technologyName));
}

function inferWordPressPluginNames(technologies: readonly string[], existingPluginNames: readonly string[]) {
  const normalizedExistingPlugins = existingPluginNames.map(normalizeLoose);
  const inferredPlugins: string[] = [];
  const seen = new Set<string>();

  for (const technology of technologies) {
    const cleanedTechnology = stripVersionSuffix(technology);
    const normalizedTechnology = normalizeTechnologyName(technology);
    const normalizedLooseTechnology = normalizeLoose(technology);

    const matchesExistingPlugin = normalizedExistingPlugins.some((pluginName) => {
      return pluginName.length > 0 && (normalizedLooseTechnology.includes(pluginName) || pluginName.includes(normalizedLooseTechnology));
    });

    const inferredPattern = inferredWordPressPluginPatterns.find(({ pattern }) => pattern.test(cleanedTechnology));

    if (!matchesExistingPlugin && !inferredPattern) {
      continue;
    }

    if (seen.has(normalizedTechnology)) {
      continue;
    }

    seen.add(normalizedTechnology);
    inferredPlugins.push(inferredPattern?.label ?? cleanedTechnology);
  }

  return inferredPlugins;
}

function sortPrimaryTechnologies(technologies: readonly string[]) {
  return [...technologies].sort((left, right) => {
    const leftPriority = coreTechnologyPriorities.get(normalizeTechnologyName(left)) ?? 0;
    const rightPriority = coreTechnologyPriorities.get(normalizeTechnologyName(right)) ?? 0;

    return rightPriority - leftPriority;
  });
}

export function buildTechnologyDisplayModel({ technologies, wordpress, cpe = [] }: TechnologyDisplayInput): TechnologyDisplayModel {
  const formattedWordPressPlugins = (wordpress?.plugins ?? [])
    .filter((plugin): plugin is string => typeof plugin === "string" && plugin.length > 0)
    .map(formatWordPressPluginSlug);
  const wordPressThemes = (wordpress?.themes ?? []).filter((theme): theme is string => typeof theme === "string" && theme.length > 0);

  const inferredPlugins = inferWordPressPluginNames(technologies, formattedWordPressPlugins);
  const hasWordPressContext =
    technologies.some((technology) => wordPressIndicators.has(normalizeTechnologyName(technology))) ||
    formattedWordPressPlugins.length > 0 ||
    wordPressThemes.length > 0 ||
    inferredPlugins.length > 0 ||
    hasWordPressCpe(cpe);

  const wordpressPluginItems = (() => {
    const plugins: TechnologyDisplayItem[] = [];
    const seen = new Set<string>();

    appendUniqueItems(
      plugins,
      seen,
      formattedWordPressPlugins.map((name) => ({ name, inferred: false })),
    );
    appendUniqueItems(
      plugins,
      seen,
      inferredPlugins.map((name) => ({ name, inferred: true })),
    );

    return plugins;
  })();

  const wordpressPlugins = wordpressPluginItems.map((item) => item.name);

  const hiddenWordPressPluginNames = new Set(wordpressPlugins.map(normalizeLoose));
  const visibleTechnologies = technologies.filter((technology) => {
    if (hasWordPressContext && hiddenWordPressPluginNames.has(normalizeLoose(technology))) {
      return false;
    }

    if (hasWordPressContext && normalizeTechnologyName(technology) === "wordpress block editor") {
      return false;
    }

    return true;
  });

  const orderedTechnologyItems = (() => {
    const values: TechnologyDisplayItem[] = [];
    const seen = new Set<string>();

    appendUniqueItems(
      values,
      seen,
      visibleTechnologies.map((name) => ({ name, inferred: false })),
    );

    if (hasWordPressContext && !seen.has("wordpress")) {
      appendUniqueItems(values, seen, [{ name: "WordPress", inferred: true }]);
    }

    return values;
  })();

  const orderedTechnologies = orderedTechnologyItems.map((item) => item.name);

  const primaryCandidates = sortPrimaryTechnologies(orderedTechnologies.filter(isCoreTechnology));
  const primaryTechnologies = primaryCandidates.length > 0 ? primaryCandidates.slice(0, 2) : orderedTechnologies.slice(0, 2);
  const primarySet = new Set(primaryTechnologies.map(normalizeTechnologyName));
  const additionalFindings = orderedTechnologies.filter((technology) => !primarySet.has(normalizeTechnologyName(technology)));
  const primaryTechnologyItems = orderedTechnologyItems.filter((item) => primarySet.has(normalizeTechnologyName(item.name)));
  const additionalFindingItems = orderedTechnologyItems.filter((item) => !primarySet.has(normalizeTechnologyName(item.name)));
  const themeItems = wordPressThemes.map((name) => ({ name, inferred: false }));

  return {
    orderedTechnologyItems,
    orderedTechnologies: [...primaryTechnologies, ...additionalFindings],
    primaryTechnologyItems,
    primaryTechnologies,
    additionalFindingItems,
    additionalFindings,
    wordpress: {
      pluginItems: wordpressPluginItems,
      plugins: wordpressPlugins,
      themeItems,
      themes: wordPressThemes,
    },
  };
}
