export interface TargetIdentityInput {
  normalizedTarget?: string | null;
  inputTarget?: string | null;
  resultInput?: string | null;
  resultUrl?: string | null;
  resultFinalUrl?: string | null;
  resultHost?: string | null;
}

export function normalizeTargetSearchToken(value: string): string {
  return value.trim().toLowerCase();
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function targetIdentityValues(input: TargetIdentityInput): string[] {
  return [
    input.normalizedTarget,
    input.inputTarget,
    input.resultInput,
    input.resultUrl,
    input.resultFinalUrl,
    input.resultHost,
  ].flatMap((value) => {
    const normalizedValue = value?.trim().toLowerCase();

    return normalizedValue ? [normalizedValue] : [];
  });
}

export function matchesTargetIdentity(values: readonly string[], query: string | null): boolean {
  if (!query) {
    return true;
  }

  return values.some((value) => value.includes(query));
}
