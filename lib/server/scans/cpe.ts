export function normalizeCpeVersion(version: string | null | undefined) {
  const trimmedVersion = version?.trim();

  if (!trimmedVersion || trimmedVersion === "*" || trimmedVersion === "-") {
    return null;
  }

  return trimmedVersion;
}

export function extractCpeVersion(cpe: string) {
  const parts = cpe.split(":");

  if (parts.length >= 6 && parts[0] === "cpe" && parts[1] === "2.3") {
    return normalizeCpeVersion(parts[5]);
  }

  if (parts.length >= 5 && parts[0] === "cpe" && parts[1]?.startsWith("/")) {
    return normalizeCpeVersion(parts[4]);
  }

  return null;
}
