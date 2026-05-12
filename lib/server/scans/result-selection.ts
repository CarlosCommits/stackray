import { normalizeTargets } from "./normalize-targets.ts";

export type AuthoritativeScanResultLike = {
  id?: string | null;
  resultId?: string | null;
  input?: string | null;
  url?: string | null;
  finalUrl?: string | null;
  target?: string | null;
  statusCode?: number | null;
  observedAt?: Date | string | null;
};

export type AuthoritativeResultMatchSource = "input" | "url" | "finalUrl" | "target" | "none";

export type RankedAuthoritativeScanResult<T extends AuthoritativeScanResultLike> = {
  result: T;
  resultId: string | null;
  statusCode: number | null;
  input: string | null;
  url: string | null;
  finalUrl: string | null;
  target: string | null;
  observedAt: string | null;
  matchesPrimaryTarget: boolean;
  matchedOn: AuthoritativeResultMatchSource;
  matchCount: number;
  normalizedCandidates: {
    input: string | null;
    url: string | null;
    finalUrl: string | null;
    target: string | null;
  };
};

const matchSourceRank: Record<AuthoritativeResultMatchSource, number> = {
  finalUrl: 0,
  url: 1,
  input: 2,
  target: 3,
  none: 4,
};

function getStatusQualityRank(statusCode: number | null) {
  if (statusCode === null) {
    return 4;
  }

  if (statusCode >= 200 && statusCode < 300) {
    return 0;
  }

  if (statusCode >= 300 && statusCode < 400) {
    return 1;
  }

  if (statusCode >= 400 && statusCode < 500) {
    return 2;
  }

  if (statusCode >= 500 && statusCode < 600) {
    return 3;
  }

  return 4;
}

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

function toResultId(result: AuthoritativeScanResultLike) {
  return result.resultId ?? result.id ?? null;
}

function toObservedAtIso(value: Date | string | null | undefined) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return typeof value === "string" ? value : null;
}

function toObservedAtTime(value: Date | string | null | undefined) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value !== "string") {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function compareNullableStrings(left: string | null, right: string | null) {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left.localeCompare(right);
}

function getMatchedOn(
  normalizedPrimaryTarget: string | null,
  normalizedCandidates: RankedAuthoritativeScanResult<AuthoritativeScanResultLike>["normalizedCandidates"],
): AuthoritativeResultMatchSource {
  if (!normalizedPrimaryTarget) {
    return "none";
  }

  if (normalizedCandidates.finalUrl === normalizedPrimaryTarget) {
    return "finalUrl";
  }

  if (normalizedCandidates.url === normalizedPrimaryTarget) {
    return "url";
  }

  if (normalizedCandidates.input === normalizedPrimaryTarget) {
    return "input";
  }

  if (normalizedCandidates.target === normalizedPrimaryTarget) {
    return "target";
  }

  return "none";
}

function getMatchCount(
  normalizedPrimaryTarget: string | null,
  normalizedCandidates: RankedAuthoritativeScanResult<AuthoritativeScanResultLike>["normalizedCandidates"],
) {
  if (!normalizedPrimaryTarget) {
    return 0;
  }

  return [
    normalizedCandidates.input,
    normalizedCandidates.url,
    normalizedCandidates.finalUrl,
    normalizedCandidates.target,
  ].filter((candidate) => candidate === normalizedPrimaryTarget).length;
}

export function rankAuthoritativeScanResults<T extends AuthoritativeScanResultLike>(
  results: readonly T[],
  primaryTarget: string | null | undefined,
): RankedAuthoritativeScanResult<T>[] {
  const normalizedPrimaryTarget = normalizeResultCandidate(primaryTarget);

  return results
    .map((result) => {
      const normalizedCandidates = {
        input: normalizeResultCandidate(result.input),
        url: normalizeResultCandidate(result.url),
        finalUrl: normalizeResultCandidate(result.finalUrl),
        target: normalizeResultCandidate(result.target),
      };
      const matchedOn = getMatchedOn(normalizedPrimaryTarget, normalizedCandidates);
      const matchCount = getMatchCount(normalizedPrimaryTarget, normalizedCandidates);

      return {
        result,
        resultId: toResultId(result),
        statusCode: result.statusCode ?? null,
        input: result.input ?? null,
        url: result.url ?? null,
        finalUrl: result.finalUrl ?? null,
        target: result.target ?? null,
        observedAt: toObservedAtIso(result.observedAt),
        matchesPrimaryTarget: matchedOn !== "none",
        matchedOn,
        matchCount,
        normalizedCandidates,
      } satisfies RankedAuthoritativeScanResult<T>;
    })
    .sort((left, right) => {
      const matchCountDifference = right.matchCount - left.matchCount;

      if (matchCountDifference !== 0) {
        return matchCountDifference;
      }

      const matchRankDifference = matchSourceRank[left.matchedOn] - matchSourceRank[right.matchedOn];

      if (matchRankDifference !== 0) {
        return matchRankDifference;
      }

      const statusRankDifference = getStatusQualityRank(left.statusCode) - getStatusQualityRank(right.statusCode);

      if (statusRankDifference !== 0) {
        return statusRankDifference;
      }

      const observedAtDifference = toObservedAtTime(right.result.observedAt) - toObservedAtTime(left.result.observedAt);

      if (observedAtDifference !== 0) {
        return observedAtDifference;
      }

      const statusPresenceDifference = Number(right.statusCode !== null) - Number(left.statusCode !== null);

      if (statusPresenceDifference !== 0) {
        return statusPresenceDifference;
      }

      const idDifference = compareNullableStrings(left.resultId, right.resultId);

      if (idDifference !== 0) {
        return idDifference;
      }

      return compareNullableStrings(
        left.finalUrl ?? left.url ?? left.input ?? left.target,
        right.finalUrl ?? right.url ?? right.input ?? right.target,
      );
    });
}

export function selectAuthoritativeScanResult<T extends AuthoritativeScanResultLike>(
  results: readonly T[],
  primaryTarget: string | null | undefined,
) {
  if (results.length === 0) {
    return null;
  }

  return rankAuthoritativeScanResults(results, primaryTarget)[0]?.result ?? null;
}
