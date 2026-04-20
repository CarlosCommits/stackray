export function formatTargetForDisplay(target: string): string {
  const trimmedTarget = target.trim();

  if (!trimmedTarget) {
    return trimmedTarget;
  }

  if (!/^https?:\/\//i.test(trimmedTarget)) {
    return trimmedTarget;
  }

  try {
    const url = new URL(trimmedTarget);
    const normalizedHost = url.host.toLowerCase();

    if (url.pathname === "/" && !url.search) {
      return normalizedHost;
    }

    return `${normalizedHost}${url.pathname}${url.search}`;
  } catch {
    return trimmedTarget.replace(/^https?:\/\//i, "");
  }
}
