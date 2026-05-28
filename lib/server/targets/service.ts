import { targetResultsResponseSchema, technologyComparisonOptionsResponseSchema, technologyComparisonResponseSchema } from "@/lib/contracts/targets";
import type { ActorContext } from "@/lib/session/actor-context";
import { listCompletedResultSnapshots, type CompletedResultSnapshot } from "@/lib/server/scans/read-service";
import { buildStructuredTechnologyDetection } from "@/lib/server/scans/technology-metadata-catalog";
import { parseTargetQuery, type TargetParamsInput, type TargetQuery } from "@/lib/targets/shared";
import { POPULAR_TECHNOLOGY_COMBINATIONS } from "@/lib/technology-comparison/preferences";

function normalizeTargetToken(value: string): string {
  return value.trim().toLowerCase();
}

function getSnapshotTimestamp(snapshot: CompletedResultSnapshot): number {
  return new Date(snapshot.completedAt).getTime();
}

function compareSnapshots(left: CompletedResultSnapshot, right: CompletedResultSnapshot): number {
  const timestampDifference = getSnapshotTimestamp(right) - getSnapshotTimestamp(left);

  if (timestampDifference !== 0) {
    return timestampDifference;
  }

  const targetDifference = left.normalizedTarget.localeCompare(right.normalizedTarget);

  if (targetDifference !== 0) {
    return targetDifference;
  }

  return left.scanId.localeCompare(right.scanId);
}

function getLatestSnapshots(snapshots: readonly CompletedResultSnapshot[]) {
  const latestByTarget = new Map<string, CompletedResultSnapshot>();

  for (const snapshot of snapshots.toSorted(compareSnapshots)) {
    if (!latestByTarget.has(snapshot.canonicalTargetId)) {
      latestByTarget.set(snapshot.canonicalTargetId, snapshot);
    }
  }

  return [...latestByTarget.values()].toSorted(compareSnapshots);
}

function matchesTokenList(values: readonly string[], filters: readonly string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  const normalizedValues = new Set(values.map(normalizeTargetToken));

  return filters.some((filter) => normalizedValues.has(filter));
}

function findExactTechnologyMatch(values: readonly string[], technology: string): string | null {
  const normalizedTechnology = normalizeTargetToken(technology);

  if (!normalizedTechnology) {
    return null;
  }

  return values.find((value) => normalizeTargetToken(value) === normalizedTechnology) ?? null;
}

function findExactTechnologyMatches(values: readonly string[], technologies: readonly string[]) {
  const matches: string[] = [];

  for (const technology of technologies) {
    const match = findExactTechnologyMatch(values, technology);

    if (!match) {
      return null;
    }

    matches.push(match);
  }

  return matches;
}

function getRequestedTechnologies(searchParams?: TargetParamsInput) {
  const rawValues = searchParams instanceof URLSearchParams
    ? searchParams.getAll("technology")
    : Array.isArray(searchParams?.technology)
      ? searchParams.technology
      : typeof searchParams?.technology === "string"
        ? [searchParams.technology]
        : [];
  const seen = new Set<string>();
  const technologies: string[] = [];

  for (const rawValue of rawValues) {
    const trimmedValue = rawValue.trim();
    const normalizedValue = normalizeTargetToken(trimmedValue);

    if (!trimmedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    technologies.push(trimmedValue);
  }

  return technologies;
}

function toTechnologyMatch(name: string) {
  const detection = buildStructuredTechnologyDetection({
    name,
    sources: ["wappalyzer"],
    inferred: false,
  });

  return {
    name: detection.name,
    iconUrl: detection.iconUrl,
  };
}

function getInlineScreenshotUrl(screenshotUrl: string | null): string | null {
  if (!screenshotUrl) {
    return null;
  }

  return `${screenshotUrl}${screenshotUrl.includes("?") ? "&" : "?"}inline=1`;
}

function matchesSubstring(value: string | null, filters: readonly string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  const normalizedValue = normalizeTargetToken(value ?? "");

  return filters.some((filter) => normalizedValue.includes(filter));
}

function matchesCpe(snapshot: CompletedResultSnapshot, filters: readonly string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  const normalizedCpeValues = snapshot.cpe.map(normalizeTargetToken);

  return filters.some((filter) => normalizedCpeValues.some((cpe) => cpe.includes(filter)));
}

function matchesDateRange(snapshot: CompletedResultSnapshot, query: TargetQuery): boolean {
  const timestamp = getSnapshotTimestamp(snapshot);

  if (query.from && timestamp < new Date(query.from).getTime()) {
    return false;
  }

  if (query.to && timestamp > new Date(query.to).getTime()) {
    return false;
  }

  return true;
}

function matchesQuery(snapshot: CompletedResultSnapshot, query: TargetQuery): boolean {
  if (query.q) {
    const searchableText = [
      snapshot.normalizedTarget,
      snapshot.title,
      ...snapshot.technologies,
      snapshot.server ?? "",
      snapshot.cdn ?? "",
      ...snapshot.wordpressPlugins,
      ...snapshot.wordpressThemes,
      ...snapshot.cpe,
      String(snapshot.statusCode),
    ]
      .join(" ")
      .toLowerCase();

    if (!searchableText.includes(query.q)) {
      return false;
    }
  }

  if (
    !matchesTokenList(snapshot.technologies, query.technology)
    && !matchesTokenList(snapshot.wordpressPlugins, query.technology)
  ) {
    return false;
  }

  if (!matchesSubstring(snapshot.cdn, query.cdn)) {
    return false;
  }

  if (!matchesSubstring(snapshot.server, query.server)) {
    return false;
  }

  if (!matchesTokenList(snapshot.wordpressPlugins, query.plugin)) {
    return false;
  }

  if (!matchesTokenList(snapshot.wordpressThemes, query.theme)) {
    return false;
  }

  if (!matchesCpe(snapshot, query.cpe)) {
    return false;
  }

  if (query.statusCode.length > 0 && !query.statusCode.includes(snapshot.statusCode)) {
    return false;
  }

  return matchesDateRange(snapshot, query);
}

export async function getTargetResults(actor: ActorContext, searchParams?: TargetParamsInput) {
  const query = parseTargetQuery(searchParams);
  const snapshots = await listCompletedResultSnapshots(actor);
  const latestSnapshots = getLatestSnapshots(snapshots);
  const latestScanIdByTarget = new Map(latestSnapshots.map((snapshot) => [snapshot.canonicalTargetId, snapshot.scanId]));
  const filtered = latestSnapshots.filter((snapshot) => matchesQuery(snapshot, query));
  const cursorOffset = query.cursor ? Number.parseInt(query.cursor, 10) : 0;
  const startOffset = Number.isInteger(cursorOffset) && cursorOffset >= 0 ? cursorOffset : 0;
  const endOffset = startOffset + query.limit;
  const items = filtered.slice(startOffset, endOffset).map((snapshot) => ({
    canonicalTargetId: snapshot.canonicalTargetId,
    normalizedTarget: snapshot.normalizedTarget,
    latestScanId: latestScanIdByTarget.get(snapshot.canonicalTargetId) ?? snapshot.scanId,
    title: snapshot.title,
    technologies: snapshot.technologies,
    lastScannedAt: snapshot.completedAt,
    faviconUrl: snapshot.faviconUrl,
    screenshotUrl: snapshot.screenshotUrl,
  }));
  const nextCursor = endOffset < filtered.length ? String(endOffset) : null;

  return targetResultsResponseSchema.parse({
    items,
    nextCursor,
  });
}

export async function getTechnologyComparisonResults(actor: ActorContext, searchParams?: TargetParamsInput) {
  const technologies = getRequestedTechnologies(searchParams);
  const technology = technologies[0] ?? "";

  if (technologies.length === 0) {
    return technologyComparisonResponseSchema.parse({
      technology: "",
      technologies: [],
      items: [],
    });
  }

  const snapshots = await listCompletedResultSnapshots(actor);
  const latestSnapshots = getLatestSnapshots(snapshots);
  const items = latestSnapshots.flatMap((snapshot) => {
    const matchedTechnologyNames = findExactTechnologyMatches(snapshot.technologies, technologies);

    if (!matchedTechnologyNames) {
      return [];
    }

    const matchedTechnologies = matchedTechnologyNames.map(toTechnologyMatch);
    const primaryTechnology = matchedTechnologies[0] ?? toTechnologyMatch(technology);

    return [{
      canonicalTargetId: snapshot.canonicalTargetId,
      normalizedTarget: snapshot.normalizedTarget,
      latestScanId: snapshot.scanId,
      title: snapshot.title,
      technologies: snapshot.technologies,
      matchedTechnology: primaryTechnology.name,
      matchedTechnologyIconUrl: primaryTechnology.iconUrl,
      matchedTechnologies,
      lastScannedAt: snapshot.completedAt,
      faviconUrl: snapshot.faviconUrl,
      screenshotUrl: getInlineScreenshotUrl(snapshot.screenshotUrl),
    }];
  });

  return technologyComparisonResponseSchema.parse({
    technology,
    technologies,
    items,
  });
}

export async function getTechnologyComparisonOptions(actor: ActorContext) {
  const snapshots = await listCompletedResultSnapshots(actor);
  const latestSnapshots = getLatestSnapshots(snapshots);
  const countsByTechnology = new Map<string, { name: string; count: number }>();
  const snapshotTechnologies: Array<Array<{ normalizedName: string; name: string }>> = [];

  for (const snapshot of latestSnapshots) {
    const seenForSnapshot = new Set<string>();
    const technologiesForSnapshot: Array<{ normalizedName: string; name: string }> = [];

    for (const technology of snapshot.technologies) {
      const detection = toTechnologyMatch(technology);
      const normalizedName = normalizeTargetToken(detection.name);

      if (!normalizedName || seenForSnapshot.has(normalizedName)) {
        continue;
      }

      seenForSnapshot.add(normalizedName);
      const existing = countsByTechnology.get(normalizedName);

      if (existing) {
        existing.count += 1;
      } else {
        countsByTechnology.set(normalizedName, {
          name: detection.name,
          count: 1,
        });
      }

      technologiesForSnapshot.push({
        normalizedName,
        name: detection.name,
      });
    }

    snapshotTechnologies.push(technologiesForSnapshot);
  }

  const items = [...countsByTechnology.values()]
    .toSorted((left, right) => {
      const countDifference = right.count - left.count;

      if (countDifference !== 0) {
        return countDifference;
      }

      return left.name.localeCompare(right.name);
    })
    .map((item) => ({
      name: item.name,
      iconUrl: toTechnologyMatch(item.name).iconUrl,
      matchCount: item.count,
    }));

  const optionByNormalizedName = new Map(items.map((item) => [normalizeTargetToken(item.name), item]));
  const countsByCombination = new Map<string, { normalizedNames: [string, string]; count: number }>();

  for (const technologiesForSnapshot of snapshotTechnologies) {
    const prioritizedTechnologies = technologiesForSnapshot
      .toSorted((left, right) => {
        const leftCount = countsByTechnology.get(left.normalizedName)?.count ?? 0;
        const rightCount = countsByTechnology.get(right.normalizedName)?.count ?? 0;
        const countDifference = rightCount - leftCount;

        if (countDifference !== 0) {
          return countDifference;
        }

        return left.name.localeCompare(right.name);
      })
      .slice(0, 12);

    for (let leftIndex = 0; leftIndex < prioritizedTechnologies.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < prioritizedTechnologies.length; rightIndex += 1) {
        const left = prioritizedTechnologies[leftIndex];
        const right = prioritizedTechnologies[rightIndex];
        const normalizedNames = [left.normalizedName, right.normalizedName].toSorted() as [string, string];
        const key = normalizedNames.join("\u0000");
        const existing = countsByCombination.get(key);

        if (existing) {
          existing.count += 1;
        } else {
          countsByCombination.set(key, {
            normalizedNames,
            count: 1,
          });
        }
      }
    }
  }

  const suggestedCombinations = [...countsByCombination.values()]
    .toSorted((left, right) => {
      const countDifference = right.count - left.count;

      if (countDifference !== 0) {
        return countDifference;
      }

      return left.normalizedNames.join(" ").localeCompare(right.normalizedNames.join(" "));
    })
    .flatMap((combination) => {
      const technologies = combination.normalizedNames.flatMap((normalizedName) => {
        const option = optionByNormalizedName.get(normalizedName);

        return option ? [option] : [];
      });

      return technologies.length === combination.normalizedNames.length
        ? [{ technologies, matchCount: combination.count }]
        : [];
    });

  const preferredCombinations = POPULAR_TECHNOLOGY_COMBINATIONS.flatMap((preferredCombination) => {
    const normalizedNames = preferredCombination
      .map(normalizeTargetToken)
      .toSorted() as [string, string];
    const key = normalizedNames.join("\u0000");
    const match = countsByCombination.get(key);

    if (!match) {
      return [];
    }

    const technologies = normalizedNames.flatMap((normalizedName) => {
      const option = optionByNormalizedName.get(normalizedName);

      return option ? [option] : [];
    });

    return technologies.length === normalizedNames.length
      ? [{ technologies, matchCount: match.count }]
      : [];
  });

  const seenCombinations = new Set<string>();
  const prioritizedSuggestedCombinations = [...preferredCombinations, ...suggestedCombinations]
    .flatMap((combination) => {
      const key = combination.technologies
        .map((technology) => normalizeTargetToken(technology.name))
        .toSorted()
        .join("\u0000");

      if (seenCombinations.has(key)) {
        return [];
      }

      seenCombinations.add(key);
      return [combination];
    })
    .slice(0, 4);

  return technologyComparisonOptionsResponseSchema.parse({
    items,
    suggestedCombinations: prioritizedSuggestedCombinations,
  });
}
