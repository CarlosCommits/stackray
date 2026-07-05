import { env } from "@/lib/env/server"

export interface AnalyticsScriptConfig {
  src: string
  websiteId: string
  domains?: string
}

export function parseAnalyticsScriptUrl(rawValue: string | undefined): AnalyticsScriptConfig | null {
  if (!rawValue) {
    return null
  }

  try {
    const url = new URL(rawValue)
    const websiteId = url.searchParams.get("websiteId") ?? url.searchParams.get("website") ?? url.searchParams.get("id")
    const domains = url.searchParams.get("domains") ?? undefined

    if (!websiteId) {
      return null
    }

    url.searchParams.delete("websiteId")
    url.searchParams.delete("website")
    url.searchParams.delete("id")
    url.searchParams.delete("domains")

    return {
      src: url.toString(),
      websiteId,
      domains,
    }
  } catch {
    return null
  }
}

export function getAnalyticsScriptConfig() {
  return parseAnalyticsScriptUrl(env.STACKRAY_ANALYTICS_SCRIPT_URL)
}
