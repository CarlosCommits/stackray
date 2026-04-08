import {
  buildStructuredTechnologyDetection,
  normalizeTechnologyKey,
  type StructuredTechnologyDetection,
  type TechnologyBucketId,
} from "@/lib/server/scans/technology-catalog";

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
  detections: readonly StructuredTechnologyDetection[];
  wordpress?: WordPressDetails;
  cpe?: readonly CpeEntry[];
};

export type TechnologyDisplayItem = StructuredTechnologyDetection;

export type TechnologyDisplayBucket = {
  id: TechnologyBucketId;
  label: string;
  items: TechnologyDisplayItem[];
};

export type TechnologyDisplayModel = {
  buckets: TechnologyDisplayBucket[];
};

const bucketOrder: TechnologyBucketId[] = [
  "platform",
  "framework",
  "infrastructure",
  "business",
  "security",
  "ecosystem",
  "other",
];

const bucketLabels: Record<TechnologyBucketId, string> = {
  platform: "Platform",
  framework: "Framework",
  infrastructure: "Infrastructure / Backend",
  business: "Business Tools",
  security: "Security / Privacy",
  ecosystem: "Ecosystem Add-ons",
  other: "Other",
};

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
  return value.replace(/:\d[\w.+-]*$/u, "").trim();
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
    const normalized = normalizeTechnologyKey(value.name);

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

function inferWordPressPluginNames(technologies: readonly StructuredTechnologyDetection[], existingPluginNames: readonly string[]) {
  const normalizedExistingPlugins = existingPluginNames.map(normalizeLoose);
  const inferredPlugins: string[] = [];
  const seen = new Set<string>();

  for (const technology of technologies) {
    const cleanedTechnology = stripVersionSuffix(technology.name);
    const normalizedTechnology = normalizeTechnologyName(technology.name);
    const normalizedLooseTechnology = normalizeLoose(technology.name);

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

function buildBucketMap(items: readonly TechnologyDisplayItem[]) {
  const bucketItems = new Map<TechnologyBucketId, TechnologyDisplayItem[]>();

  for (const bucketId of bucketOrder) {
    bucketItems.set(bucketId, []);
  }

  for (const item of items) {
    bucketItems.get(item.bucket)?.push(item);
  }

  return bucketOrder.flatMap((bucketId): TechnologyDisplayBucket[] => {
    const bucketEntries = bucketItems.get(bucketId) ?? [];

    if (bucketEntries.length === 0) {
      return [];
    }

    return [{
      id: bucketId,
      label: bucketLabels[bucketId],
      items: bucketEntries,
    }];
  });
}

export function buildTechnologyDisplayModel({ detections, wordpress, cpe = [] }: TechnologyDisplayInput): TechnologyDisplayModel {
  const formattedWordPressPlugins = (wordpress?.plugins ?? [])
    .filter((plugin): plugin is string => typeof plugin === "string" && plugin.length > 0)
    .map(formatWordPressPluginSlug);
  const wordPressThemes = (wordpress?.themes ?? []).filter((theme): theme is string => typeof theme === "string" && theme.length > 0);

  const inferredPlugins = inferWordPressPluginNames(detections, formattedWordPressPlugins);
  const hasWordPressContext =
    detections.some((technology) => wordPressIndicators.has(normalizeTechnologyName(technology.name))) ||
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
      formattedWordPressPlugins.map((name) =>
        buildStructuredTechnologyDetection({
          name,
          version: null,
          sources: ["wordpress"],
          inferred: false,
          bucketOverride: "ecosystem",
        }),
      ),
    );
    appendUniqueItems(
      plugins,
      seen,
      inferredPlugins.map((name) =>
        buildStructuredTechnologyDetection({
          name,
          version: null,
          sources: ["wordpress"],
          inferred: true,
          bucketOverride: "ecosystem",
        }),
      ),
    );

    return plugins;
  })();

  const wordpressPlugins = wordpressPluginItems.map((item) => item.name);
  const hiddenWordPressPluginNames = new Set(wordpressPlugins.map(normalizeLoose));
  const visibleTechnologies = detections.filter((technology) => {
    if (hasWordPressContext && hiddenWordPressPluginNames.has(normalizeLoose(technology.name))) {
      return false;
    }

    if (hasWordPressContext && normalizeTechnologyName(technology.name) === "wordpress block editor") {
      return false;
    }

    return true;
  });

  const orderedTechnologyItems = (() => {
    const values: TechnologyDisplayItem[] = [];
    const seen = new Set<string>();

    appendUniqueItems(values, seen, visibleTechnologies);

    if (hasWordPressContext && !seen.has("wordpress")) {
      appendUniqueItems(values, seen, [
        buildStructuredTechnologyDetection({
          name: "WordPress",
          version: null,
          sources: ["wordpress"],
          inferred: true,
        }),
      ]);
    }

    appendUniqueItems(
      values,
      seen,
      wordPressThemes.map((name) =>
        buildStructuredTechnologyDetection({
          name,
          version: null,
          sources: ["wordpress"],
          inferred: false,
          bucketOverride: "ecosystem",
        }),
      ),
    );
    appendUniqueItems(values, seen, wordpressPluginItems);

    return values;
  })();

  return {
    buckets: buildBucketMap(orderedTechnologyItems),
  };
}
