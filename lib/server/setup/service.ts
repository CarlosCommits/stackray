import { count, eq, isNull } from "drizzle-orm"

import { canManageUsers } from "@/lib/authorization/authz"
import { setupStateResponseSchema } from "@/lib/contracts/setup"
import { db } from "@/lib/db/client"
import { apiTokens, instanceSettings, users } from "@/lib/db/schema"
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

  const [settings, userCountRow, tokenCountRow, detectedPublicUrl] = await Promise.all([
    getInstanceSettings(),
    db
      .select({ count: count() })
      .from(users)
      .where(isNull(users.deactivatedAt)),
    db
      .select({ count: count() })
      .from(apiTokens)
      .where(isNull(apiTokens.revokedAt)),
    getPublicOrigin(),
  ])

  return setupStateResponseSchema.parse({
    publicUrl: settings?.canonicalBaseUrl ?? detectedPublicUrl,
    detectedPublicUrl,
    hasUsers: userCountRow[0]?.count > 1,
    hasTokens: tokenCountRow[0]?.count > 0,
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
