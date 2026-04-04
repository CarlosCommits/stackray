function isAbsoluteHttpUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value)
}

function isLocalImagePath(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("/")
}

export function resolveFaviconPreviewSrc(faviconUrl: string | null): string | null {
  if (!faviconUrl) {
    return null
  }

  if (isLocalImagePath(faviconUrl) || isAbsoluteHttpUrl(faviconUrl)) {
    return faviconUrl
  }

  return null
}
