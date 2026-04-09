import { lookup, resolveCname } from "node:dns/promises"

import { count, eq, isNull } from "drizzle-orm"

import { canManageUsers } from "@/lib/authorization/authz"
import { customDomainStateResponseSchema, setupStateResponseSchema } from "@/lib/contracts/setup"
import { db } from "@/lib/db/client"
import { apiTokens, instanceSettings, scans, users } from "@/lib/db/schema"
import { getPublicOrigin } from "@/lib/public-origin"
import type { ActorContext } from "@/lib/session/actor-context"

const INSTANCE_SETTINGS_ID = "default"

function assertSetupAdmin(actor: ActorContext) {
  if (!canManageUsers(actor)) {
    throw new Error("You do not have permission to configure this Stackray instance.")
  }
}

export function normalizePublicUrl(publicUrl: string) {
  const normalized = new URL(publicUrl)
  normalized.pathname = ""
  normalized.search = ""
  normalized.hash = ""

  return normalized.toString().replace(/\/$/, "")
}

export function normalizeHostname(hostname: string) {
  const candidate = hostname.trim().toLowerCase()
  const normalized = candidate.includes("://") ? new URL(candidate) : new URL(`https://${candidate}`)

  return normalized.hostname
}

export function shouldRedirectToSetup({
  pathname,
  canManageSetup,
  isSetupComplete,
}: {
  pathname: string | null
  canManageSetup: boolean
  isSetupComplete: boolean
}) {
  return canManageSetup && !isSetupComplete && pathname !== "/setup"
}

export async function getInstanceSettings() {
  const [settings] = await db
    .select()
    .from(instanceSettings)
    .where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID))
    .limit(1)

  return settings ?? null
}

export async function isInstanceSetupComplete() {
  const settings = await getInstanceSettings()
  return Boolean(settings?.setupCompletedAt && settings.canonicalBaseUrl)
}

export async function getEffectivePublicUrl() {
  const settings = await getInstanceSettings()
  return settings?.canonicalBaseUrl ?? (await getPublicOrigin())
}

export async function getSetupState(actor: ActorContext) {
  assertSetupAdmin(actor)

  const [settings, userCountRow, tokenCountRow, scanCountRow, detectedPublicUrl] = await Promise.all([
    getInstanceSettings(),
    db
      .select({ count: count() })
      .from(users)
      .where(isNull(users.deactivatedAt)),
    db
      .select({ count: count() })
      .from(apiTokens)
      .where(isNull(apiTokens.revokedAt)),
    db
      .select({ count: count() })
      .from(scans),
    getPublicOrigin(),
  ])

  return setupStateResponseSchema.parse({
    publicUrl: settings?.canonicalBaseUrl ?? detectedPublicUrl,
    detectedPublicUrl,
    hasUsers: userCountRow[0]?.count > 1,
    hasTokens: tokenCountRow[0]?.count > 0,
    hasScans: scanCountRow[0]?.count > 0,
    isSetupComplete: Boolean(settings?.setupCompletedAt && settings.canonicalBaseUrl),
  })
}

export async function completeSetup(actor: ActorContext, publicUrl: string) {
  assertSetupAdmin(actor)

  const canonicalBaseUrl = normalizePublicUrl(publicUrl)
  const now = new Date()
  const existing = await getInstanceSettings()

  if (existing) {
    await db
      .update(instanceSettings)
      .set({
        canonicalBaseUrl,
        setupCompletedAt: existing.setupCompletedAt ?? now,
        setupCompletedByUserId: existing.setupCompletedByUserId ?? actor.user.id,
        updatedAt: now,
      })
      .where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID))
  } else {
    await db.insert(instanceSettings).values({
      id: INSTANCE_SETTINGS_ID,
      canonicalBaseUrl,
      setupCompletedAt: now,
      setupCompletedByUserId: actor.user.id,
      createdAt: now,
      updatedAt: now,
    })
  }

  return getSetupState(actor)
}

export async function getCustomDomainState(actor: ActorContext) {
  assertSetupAdmin(actor)

  const settings = await getInstanceSettings()

  return customDomainStateResponseSchema.parse({
    hostname: settings?.customDomainHostname ?? null,
    canonicalBaseUrl: settings?.canonicalBaseUrl ?? null,
    expectedRailwayDomain: process.env.RAILWAY_PUBLIC_DOMAIN ?? null,
    dnsVerified: Boolean(settings?.customDomainDnsVerifiedAt),
    appVerified: Boolean(settings?.customDomainAppVerifiedAt),
    cnameTargets: [],
    resolvedAddresses: [],
    dnsVerifiedAt: settings?.customDomainDnsVerifiedAt?.toISOString() ?? null,
    appVerifiedAt: settings?.customDomainAppVerifiedAt?.toISOString() ?? null,
    lastCheckedAt: settings?.customDomainLastCheckedAt?.toISOString() ?? null,
  })
}

export async function saveCustomDomainHostname(actor: ActorContext, hostname: string) {
  assertSetupAdmin(actor)

  const normalizedHostname = normalizeHostname(hostname)
  const now = new Date()
  const existing = await getInstanceSettings()

  if (existing) {
    await db
      .update(instanceSettings)
      .set({
        customDomainHostname: normalizedHostname,
        customDomainDnsVerifiedAt: null,
        customDomainAppVerifiedAt: null,
        customDomainLastCheckedAt: null,
        updatedAt: now,
      })
      .where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID))
  } else {
    await db.insert(instanceSettings).values({
      id: INSTANCE_SETTINGS_ID,
      customDomainHostname: normalizedHostname,
      createdAt: now,
      updatedAt: now,
    })
  }

  return getCustomDomainState(actor)
}

async function resolveDnsState(hostname: string) {
  try {
    const [cnameTargets, addresses] = await Promise.all([
      resolveCname(hostname).catch(() => []),
      lookup(hostname, { all: true }).catch(() => []),
    ])

    return {
      cnameTargets,
      resolvedAddresses: addresses.map((entry) => entry.address),
    }
  } catch {
    return {
      cnameTargets: [],
      resolvedAddresses: [],
    }
  }
}

async function verifyAppReachability(hostname: string) {
  try {
    const response = await fetch(`https://${hostname}`, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    })

    return response.ok || response.status >= 300
  } catch {
    return false
  }
}

export async function verifyCustomDomain(actor: ActorContext, hostname?: string) {
  assertSetupAdmin(actor)

  const settings = await getInstanceSettings()
  const normalizedHostname = hostname ? normalizeHostname(hostname) : settings?.customDomainHostname

  if (!normalizedHostname) {
    throw new Error("Save a custom domain hostname before running verification.")
  }

  const [dnsState, appVerified] = await Promise.all([
    resolveDnsState(normalizedHostname),
    verifyAppReachability(normalizedHostname),
  ])

  const now = new Date()

  await db
    .update(instanceSettings)
    .set({
      customDomainHostname: normalizedHostname,
      customDomainDnsVerifiedAt:
        dnsState.cnameTargets.length > 0 || dnsState.resolvedAddresses.length > 0 ? now : null,
      customDomainAppVerifiedAt: appVerified ? now : null,
      customDomainLastCheckedAt: now,
      updatedAt: now,
    })
    .where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID))

  return customDomainStateResponseSchema.parse({
    hostname: normalizedHostname,
    canonicalBaseUrl: settings?.canonicalBaseUrl ?? null,
    expectedRailwayDomain: process.env.RAILWAY_PUBLIC_DOMAIN ?? null,
    dnsVerified: dnsState.cnameTargets.length > 0 || dnsState.resolvedAddresses.length > 0,
    appVerified,
    cnameTargets: dnsState.cnameTargets,
    resolvedAddresses: dnsState.resolvedAddresses,
    dnsVerifiedAt:
      dnsState.cnameTargets.length > 0 || dnsState.resolvedAddresses.length > 0 ? now.toISOString() : null,
    appVerifiedAt: appVerified ? now.toISOString() : null,
    lastCheckedAt: now.toISOString(),
  })
}
