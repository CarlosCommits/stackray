import type { ScanResultItem } from "@/lib/contracts/scans";

import { normalizeTargets } from "@/lib/server/scans/normalize-targets";

function normalizeResultCandidate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return normalizeTargets([value])[0]?.normalizedTarget ?? null;
  } catch {
    return null;
  }
}

export function selectPrimaryScanResult(results: readonly ScanResultItem[], primaryTarget: string | null | undefined) {
  if (results.length === 0) {
    return null;
  }

  if (!primaryTarget) {
    return results[0]!;
  }

  const normalizedPrimaryTarget = normalizeResultCandidate(primaryTarget);

  if (!normalizedPrimaryTarget) {
    return results[0]!;
  }

  return (
    results.find((result) => {
      const explicitCandidates = [result.input, result.url, result.finalUrl]
        .map(normalizeResultCandidate)
        .some((candidate) => candidate === normalizedPrimaryTarget);

      if (explicitCandidates) {
        return true;
      }

      return !result.input && !result.url && !result.finalUrl && normalizeResultCandidate(result.target) === normalizedPrimaryTarget;
    }) ?? results[0]!
  );
}
