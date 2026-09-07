function normalizeAlertText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getDistinctAlertDetail(label: string, detail?: string | null) {
  const trimmedDetail = detail?.trim();
  if (!trimmedDetail || normalizeAlertText(label) === normalizeAlertText(trimmedDetail)) {
    return null;
  }

  return trimmedDetail;
}
