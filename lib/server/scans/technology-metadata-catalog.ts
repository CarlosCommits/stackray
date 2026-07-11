import wappalyzerCatalog from "./generated/wappalyzer-catalog.json" with { type: "json" }
import customTechnologyMetadata from "./custom-technology-metadata.json" with { type: "json" }
import { buildTechnologyIconUrl } from "./technology-icon-sources.ts"
import { resolveTechnologyBucket, type TechnologyBucketId } from "./technology-taxonomy.ts"

export type { TechnologyBucketId } from "./technology-taxonomy.ts"

export type TechnologyDetectionSource = "wappalyzer" | "wordpress" | "cpe" | "derived" | "nuclei"

type WappalyzerCatalogRecord = {
  name: string
  description: string | null
  website: string | null
  icon: string | null
  cpe: string | null
  categories: string[]
  implies: string[]
}

type CustomCatalogRecord = Partial<WappalyzerCatalogRecord>

type TechnologyMetadata = {
  name: string
  description: string | null
  website: string | null
  iconUrl: string | null
  categories: string[]
  primaryCategory: string | null
  bucket: TechnologyBucketId
}

export type StructuredTechnologyDetection = TechnologyMetadata & {
  version: string | null
  sources: TechnologyDetectionSource[]
  inferred: boolean
}

const catalog = wappalyzerCatalog as Record<string, WappalyzerCatalogRecord>

const hostLikeTechnologyNames = new Set([
  "Amazon Web Services",
  "Azure",
  "Cloudflare Pages",
  "DigitalOcean",
  "Flywheel",
  "GitHub Pages",
  "Google Cloud",
  "Heroku",
  "Kinsta",
  "Netlify",
  "Pantheon",
  "Render",
  "Squarespace",
  "Vercel",
  "Webflow",
  "Wix",
  "WP Engine",
])

const genericServerBannerNames = new Set([
  "apache",
  "caddy",
  "envoy",
  "gunicorn",
  "iis",
  "istio-envoy",
  "litespeed",
  "nginx",
  "openresty",
])

const hostCnameRules: Array<{ suffix: string; host: string }> = [
  { suffix: ".vercel-dns.com", host: "Vercel" },
  { suffix: ".netlify.app", host: "Netlify" },
  { suffix: ".netlifyglobalcdn.com", host: "Netlify" },
  { suffix: ".myshopify.com", host: "Shopify" },
  { suffix: ".webflow.io", host: "Webflow" },
  { suffix: ".squarespace.com", host: "Squarespace" },
  { suffix: ".wixdns.net", host: "Wix" },
  { suffix: ".wpenginepowered.com", host: "WP Engine" },
  { suffix: ".kinsta.cloud", host: "Kinsta" },
  { suffix: ".pantheonsite.io", host: "Pantheon" },
  { suffix: ".flywheelsites.com", host: "Flywheel" },
  { suffix: ".herokudns.com", host: "Heroku" },
  { suffix: ".github.io", host: "GitHub Pages" },
  { suffix: ".azurewebsites.net", host: "Azure" },
]

export function normalizeTechnologyKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "")
}

const customCatalog = Object.fromEntries(
  Object.entries(customTechnologyMetadata as Record<string, CustomCatalogRecord>).flatMap(([key, record]) => {
    const normalizedKey = normalizeTechnologyKey(key || (record.name ?? ""))
    const normalizedName = record.name ? normalizeTechnologyKey(record.name) : null

    return [
      [normalizedKey, record],
      ...(normalizedName && normalizedName !== normalizedKey ? [[normalizedName, record]] : []),
    ]
  }),
) as Record<string, CustomCatalogRecord>

function hasOwnProperty<T extends object, K extends PropertyKey>(
  value: T,
  key: K,
): value is T & Record<K, unknown> {
  return Object.hasOwn(value, key)
}

function parseTechnologyLabel(value: string) {
  const trimmed = value.trim()
  const match = trimmed.match(/^(.*?):(\d[\w.+-]*)$/u)

  if (!match) {
    return {
      name: trimmed,
      version: null,
    }
  }

  return {
    name: match[1]?.trim() ?? trimmed,
    version: match[2] ?? null,
  }
}

function getTechnologyCatalogRecord(name: string) {
  const key = normalizeTechnologyKey(name)
  const customRecord = customCatalog[key]
  const generatedRecord = catalog[key]

  if (!customRecord) {
    return generatedRecord ?? null
  }

  return {
    name: customRecord.name ?? generatedRecord?.name ?? name,
    description: hasOwnProperty(customRecord, "description")
      ? customRecord.description ?? null
      : generatedRecord?.description ?? null,
    website: hasOwnProperty(customRecord, "website")
      ? customRecord.website ?? null
      : generatedRecord?.website ?? null,
    icon: hasOwnProperty(customRecord, "icon")
      ? customRecord.icon ?? null
      : generatedRecord?.icon ?? null,
    cpe: hasOwnProperty(customRecord, "cpe")
      ? customRecord.cpe ?? null
      : generatedRecord?.cpe ?? null,
    categories: customRecord.categories ?? generatedRecord?.categories ?? [],
    implies: customRecord.implies ?? generatedRecord?.implies ?? [],
  }
}

export function canonicalizeTechnologyLabel(value: string) {
  const parsed = parseTechnologyLabel(value)
  const catalogRecord = getTechnologyCatalogRecord(parsed.name)

  return {
    name: catalogRecord?.name ?? parsed.name,
    version: parsed.version,
  }
}

function getTechnologyMetadata(name: string, bucketOverride?: TechnologyBucketId): TechnologyMetadata {
  const catalogRecord = getTechnologyCatalogRecord(name)
  const canonicalName = catalogRecord?.name ?? canonicalizeTechnologyLabel(name).name
  const categories = catalogRecord?.categories ?? []
  const primaryCategory = categories[0] ?? null

  return {
    name: canonicalName,
    description: catalogRecord?.description ?? null,
    website: catalogRecord?.website ?? null,
    iconUrl: buildTechnologyIconUrl(catalogRecord?.icon ?? null),
    categories,
    primaryCategory,
    bucket: bucketOverride ?? resolveTechnologyBucket(canonicalName, categories),
  }
}

export function buildStructuredTechnologyDetection(input: {
  name: string
  version?: string | null
  sources: readonly TechnologyDetectionSource[]
  inferred: boolean
  bucketOverride?: TechnologyBucketId
}): StructuredTechnologyDetection {
  const canonical = input.version !== undefined
    ? { name: canonicalizeTechnologyLabel(input.name).name, version: input.version }
    : canonicalizeTechnologyLabel(input.name)
  const metadata = getTechnologyMetadata(canonical.name, input.bucketOverride)

  return {
    ...metadata,
    version: canonical.version,
    sources: [...input.sources],
    inferred: input.inferred,
  }
}

export function isHostLikeTechnology(name: string, categories: readonly string[]) {
  if (hostLikeTechnologyNames.has(name)) {
    return true
  }

  return categories.some((category) => category === "Hosting" || category === "PaaS" || category === "IaaS")
}

export function isCdnLikeTechnology(categories: readonly string[]) {
  return categories.some((category) => category === "CDN")
}

export function getHostFromServerBanner(serverBanner: string | null) {
  if (!serverBanner) {
    return null
  }

  const rawName = serverBanner.split("/")[0]?.trim() ?? serverBanner.trim()
  const catalogName = canonicalizeTechnologyLabel(rawName).name
  const displayName = normalizeTechnologyKey(rawName) === normalizeTechnologyKey(catalogName) ? catalogName : rawName

  if (!displayName || genericServerBannerNames.has(displayName.toLowerCase())) {
    return null
  }

  return displayName
}

export function getHostFromCnames(cnames: readonly string[]) {
  for (const cname of cnames) {
    const normalized = cname.trim().toLowerCase().replace(/\.+$/g, "")

    for (const rule of hostCnameRules) {
      if (normalized.endsWith(rule.suffix)) {
        return rule.host
      }
    }
  }

  return null
}
