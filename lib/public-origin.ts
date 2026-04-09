import { headers } from "next/headers"

import { env } from "@/lib/env/server"

function splitList(value: string | null | undefined) {
  if (!value) {
    return []
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function escapeRegExp(value: string) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
}

function toWildcardRegExp(pattern: string) {
  const escaped = escapeRegExp(pattern).replace(/\*/g, "[^/]*").replace(/\?/g, ".")
  return new RegExp(`^${escaped}$`, "i")
}

function normalizeHost(value: string | null | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return null
  }

  if (trimmed.includes("://")) {
    return new URL(trimmed).host
  }

  return trimmed
}

function normalizeProtocol(value: string | null) {
  if (!value) {
    return null
  }

  const candidate = value.split(",")[0]?.trim().toLowerCase()
  return candidate === "http" || candidate === "https" ? candidate : null
}

function normalizeForwardedHost(value: string | null) {
  const candidate = value?.split(",")[0]?.trim()
  return candidate ? candidate : null
}

export function getConfiguredPublicOrigin() {
  if (env.BETTER_AUTH_URL) {
    return env.BETTER_AUTH_URL
  }

  const railwayPublicDomain = normalizeHost(env.RAILWAY_PUBLIC_DOMAIN ?? process.env.RAILWAY_PUBLIC_DOMAIN)

  if (railwayPublicDomain) {
    return `https://${railwayPublicDomain}`
  }

  return env.NODE_ENV === "production" ? null : "http://localhost:3000"
}

export function getPublicOriginAllowedHosts(extraHosts: string[] = []) {
  const hosts = new Set<string>(["localhost:*", "127.0.0.1:*", "[::1]:*", "*.up.railway.app"])
  const configuredValues = [
    env.BETTER_AUTH_URL,
    env.RAILWAY_PUBLIC_DOMAIN,
    ...splitList(env.STACKRAY_ALLOWED_HOSTS),
    ...extraHosts,
  ]

  for (const value of configuredValues) {
    if (!value) {
      continue
    }

    const host = normalizeHost(value)

    if (host) {
      hosts.add(host)
    }
  }

  return Array.from(hosts)
}

export function isAllowedPublicHost(host: string, allowedHosts = getPublicOriginAllowedHosts()) {
  return allowedHosts.some((pattern) => toWildcardRegExp(pattern).test(host))
}

export function derivePublicOriginFromHeaders(requestHeaders: Headers, extraHosts: string[] = []) {
  const host =
    normalizeForwardedHost(requestHeaders.get("x-forwarded-host")) ??
    normalizeForwardedHost(requestHeaders.get("host"))

  if (!host) {
    return getConfiguredPublicOrigin()
  }

  if (!isAllowedPublicHost(host, getPublicOriginAllowedHosts(extraHosts))) {
    return getConfiguredPublicOrigin()
  }

  const protocol =
    normalizeProtocol(requestHeaders.get("x-forwarded-proto")) ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]") ? "http" : "https")

  return `${protocol}://${host}`
}

export async function getPublicOrigin(extraHosts: string[] = []) {
  return derivePublicOriginFromHeaders(await headers(), extraHosts)
}

export function buildAbsoluteUrl(pathname: string, origin: string) {
  return new URL(pathname, origin).toString()
}
