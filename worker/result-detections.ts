import { scanResultDetections, scanResults } from "../drizzle/schema.ts";
import { extractCpeVersion, normalizeCpeVersion } from "../lib/server/scans/cpe.ts";
import {
  buildEnrichedTechnologies,
  getNucleiDnsServiceTechnologyName,
  promoteTechnologiesFromCpe,
} from "../lib/server/scans/technology-enrichment.ts";
import { canonicalizeTechnologyLabel } from "../lib/server/scans/technology-metadata-catalog.ts";

type ScanResultRow = typeof scanResults.$inferSelect;
type DetectionInsert = typeof scanResultDetections.$inferInsert;

export type CpeEntry = {
  cpe: string;
  vendor: string | null;
  product: string | null;
  version: string | null;
};

export { extractCpeVersion, promoteTechnologiesFromCpe };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toObject(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export function buildSearchDocument(payload: {
  input: string | null;
  finalUrl: string | null;
  title: string | null;
  server: string | null;
  technologies: string[];
  plugins: string[];
  themes: string[];
  cpes: string[];
}) {
  return [
    payload.input,
    payload.finalUrl,
    payload.title,
    payload.server,
    ...payload.technologies,
    ...payload.plugins,
    ...payload.themes,
    ...payload.cpes,
  ]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ");
}

export function extractCpeEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as CpeEntry[];
  }

  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      return [{ cpe: entry, vendor: null, product: null, version: extractCpeVersion(entry) }];
    }

    if (isObject(entry) && typeof entry.cpe === "string") {
      return [
        {
          cpe: entry.cpe,
          vendor: typeof entry.vendor === "string" ? entry.vendor : null,
          product: typeof entry.product === "string" ? entry.product : null,
          version: typeof entry.version === "string" ? normalizeCpeVersion(entry.version) : extractCpeVersion(entry.cpe),
        },
      ];
    }

    return [];
  });
}

export function buildDetectionRows(input: {
  resultId: string;
  technologies: readonly string[];
  promotedCpeTechnologies: readonly string[];
  plugins: readonly string[];
  themes: readonly string[];
  cpeEntries: readonly CpeEntry[];
}) {
  const detectionRows: DetectionInsert[] = [];
  const seen = new Set<string>();

  const appendDetection = (row: DetectionInsert) => {
    const key = [
      row.kind,
      row.source,
      row.slug?.trim().toLowerCase() ?? "",
      row.name.trim().toLowerCase(),
      row.version?.trim().toLowerCase() ?? "",
      row.cpe?.trim().toLowerCase() ?? "",
    ].join("::");

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    detectionRows.push(row);
  };

  for (const technologyName of input.technologies) {
    const canonicalTechnology = canonicalizeTechnologyLabel(technologyName);

    appendDetection({
      resultId: input.resultId,
      kind: "technology",
      name: canonicalTechnology.name,
      version: canonicalTechnology.version,
      source: "wappalyzer",
      slug: null,
      vendor: null,
      product: null,
      cpe: null,
    });
  }

  for (const technologyName of input.promotedCpeTechnologies) {
    const canonicalTechnology = canonicalizeTechnologyLabel(technologyName);

    appendDetection({
      resultId: input.resultId,
      kind: "technology",
      name: canonicalTechnology.name,
      version: canonicalTechnology.version,
      source: "cpe",
      slug: null,
      vendor: null,
      product: null,
      cpe: null,
    });
  }

  for (const pluginName of input.plugins) {
    appendDetection({
      resultId: input.resultId,
      kind: "wordpress_plugin",
      name: pluginName,
      version: null,
      source: "wordpress",
      slug: pluginName,
      vendor: null,
      product: null,
      cpe: null,
    });
  }

  for (const themeName of input.themes) {
    appendDetection({
      resultId: input.resultId,
      kind: "wordpress_theme",
      name: themeName,
      version: null,
      source: "wordpress",
      slug: themeName,
      vendor: null,
      product: null,
      cpe: null,
    });
  }

  for (const entry of input.cpeEntries) {
    appendDetection({
      resultId: input.resultId,
      kind: "cpe",
      name: entry.product ?? entry.vendor ?? entry.cpe,
      version: entry.version,
      source: "cpe",
      slug: null,
      vendor: entry.vendor,
      product: entry.product,
      cpe: entry.cpe,
    });
  }

  return detectionRows;
}

export function buildNucleiTechnologyDetectionRows(input: {
  resultId: string;
  matches: readonly { templateId?: string | null; findingKind: string; matcherName: string | null; technologyName: string | null; technologyVersion: string | null }[];
}) {
  const detectionRows: DetectionInsert[] = [];
  const seen = new Set<string>();

  for (const match of input.matches) {
    const technologyName = match.technologyName ?? getNucleiDnsServiceTechnologyName({
      templateId: match.templateId,
      findingKind: match.findingKind,
      matcherName: match.matcherName,
    });

    if (!technologyName) {
      continue;
    }

    if (isSuppressedNucleiTechnologyMatch(match, technologyName)) {
      continue;
    }

    const canonicalTechnology = canonicalizeTechnologyLabel(technologyName);
    const version = match.technologyVersion ?? canonicalTechnology.version;
    const key = [
      canonicalTechnology.name.trim().toLowerCase(),
      version?.trim().toLowerCase() ?? "",
    ].join("::");

    if (!canonicalTechnology.name.trim() || seen.has(key)) {
      continue;
    }

    seen.add(key);

    detectionRows.push({
      resultId: input.resultId,
      kind: "technology",
      name: canonicalTechnology.name,
      version,
      source: "nuclei",
      slug: null,
      vendor: null,
      product: null,
      cpe: null,
    });
  }

  return detectionRows;
}

const suppressedNucleiTechnologyMatches = new Set([
  // Upstream FingerprintHub rule matches the generic word "landmark", which is commonly present
  // in normal page content and accessibility language.
  "fingerprinthub-web-fingerprints::landmark-dus",
]);

function isSuppressedNucleiTechnologyMatch(
  match: { templateId?: string | null },
  technologyName: string,
) {
  const templateId = match.templateId?.trim().toLowerCase() ?? "";
  const normalizedTechnologyName = technologyName.trim().toLowerCase();

  return suppressedNucleiTechnologyMatches.has(`${templateId}::${normalizedTechnologyName}`);
}

export function buildScreenshotTechnologyDetectionRows(input: {
  resultId: string;
  technologies: readonly string[];
  existingDetections: readonly Pick<DetectionInsert, "kind" | "source" | "name" | "version" | "slug" | "cpe">[];
}) {
  const detectionRows: DetectionInsert[] = [];
  const detectionKey = (row: Pick<DetectionInsert, "kind" | "source" | "name" | "version">) =>
    [
      row.kind,
      row.source,
      row.name.trim().toLowerCase(),
      row.version?.trim().toLowerCase() ?? "",
    ].join("::");
  const seen = new Set(
    input.existingDetections.map((row) => detectionKey(row)),
  );

  for (const technologyName of input.technologies) {
    const canonicalTechnology = canonicalizeTechnologyLabel(technologyName);
    const canonicalName = canonicalTechnology.name.trim();

    if (!canonicalName) {
      continue;
    }

    const row: DetectionInsert = {
      resultId: input.resultId,
      kind: "technology",
      name: canonicalName,
      version: canonicalTechnology.version,
      source: "wappalyzer",
      slug: null,
      vendor: null,
      product: null,
      cpe: null,
    };
    const key = detectionKey(row);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    detectionRows.push(row);
  }

  return detectionRows;
}

export function collectUniqueTechnologyNames(technologyNames: readonly (string | null)[]) {
  const visibleTechnologyNames: string[] = [];
  const seen = new Map<string, { index: number; hasVersion: boolean }>();

  for (const technologyName of technologyNames) {
    if (!technologyName) {
      continue;
    }

    const canonicalTechnology = canonicalizeTechnologyLabel(technologyName);
    const normalizedTechnologyName = canonicalTechnology.name.trim().toLowerCase();

    if (!normalizedTechnologyName) {
      continue;
    }

    const label = canonicalTechnology.version ? `${canonicalTechnology.name}:${canonicalTechnology.version}` : canonicalTechnology.name;
    const existing = seen.get(normalizedTechnologyName);

    if (!existing) {
      seen.set(normalizedTechnologyName, {
        index: visibleTechnologyNames.length,
        hasVersion: Boolean(canonicalTechnology.version),
      });
      visibleTechnologyNames.push(label);
      continue;
    }

    if (!existing.hasVersion && canonicalTechnology.version) {
      visibleTechnologyNames[existing.index] = label;
      existing.hasVersion = true;
    }
  }

  return visibleTechnologyNames;
}

export function buildStoredResultVisibleTechnologies(
  result: ScanResultRow,
  nucleiTechnologyNames: readonly string[],
  persistedTechnologyNames?: readonly string[],
) {
  const rawPayload = toObject(result.rawJson);
  const cpeEntries = extractCpeEntries(rawPayload.cpe);

  return buildEnrichedTechnologies({
    persistedTechnologies: persistedTechnologyNames ?? asStringArray(rawPayload.tech),
    additionalTechnologies: nucleiTechnologyNames,
    cpeEntries,
  });
}

export function buildStoredResultSearchDocument(
  result: ScanResultRow,
  nucleiTechnologyNames: readonly string[],
  persistedTechnologyNames?: readonly string[],
) {
  const rawPayload = toObject(result.rawJson);
  const wordpress = toObject(rawPayload.wordpress);
  const cpeEntries = extractCpeEntries(rawPayload.cpe);

  return buildSearchDocument({
    input: result.input,
    finalUrl: result.finalUrl ?? result.url,
    title: result.title,
    server: result.webServer,
    technologies: buildStoredResultVisibleTechnologies(result, nucleiTechnologyNames, persistedTechnologyNames),
    plugins: asStringArray(wordpress.plugins),
    themes: asStringArray(wordpress.themes),
    cpes: cpeEntries.map((entry) => entry.cpe),
  });
}
