import wappalyzerCatalog from "./generated/wappalyzer-catalog.json" with { type: "json" }
import customTechnologyMetadata from "./custom-technology-metadata.json" with { type: "json" }

type TechnologyIconRecord = {
  icon?: string | null
}

const wappalyzerIconBaseUrl = "https://raw.githubusercontent.com/enthec/webappanalyzer/main/src/images/icons"

function normalizeUrl(value: string) {
  try {
    return new URL(value).href
  } catch {
    return null
  }
}

export function buildTechnologyIconUrl(icon: string | null | undefined) {
  if (!icon) {
    return null
  }

  if (/^https?:\/\//iu.test(icon)) {
    return normalizeUrl(icon)
  }

  return `${wappalyzerIconBaseUrl}/${encodeURIComponent(icon)}`
}

const trustedTechnologyIconUrls = new Set(
  [
    ...Object.values(wappalyzerCatalog as Record<string, TechnologyIconRecord>),
    ...Object.values(customTechnologyMetadata as Record<string, TechnologyIconRecord>),
  ].flatMap((record) => {
    const iconUrl = buildTechnologyIconUrl(record.icon)

    return iconUrl ? [iconUrl] : []
  }),
)

export function isTrustedTechnologyIconUrl(url: URL) {
  return trustedTechnologyIconUrls.has(url.href)
}
