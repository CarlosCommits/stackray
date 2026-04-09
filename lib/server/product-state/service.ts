import { eq } from "drizzle-orm"

import { productStateResponseSchema } from "@/lib/contracts/product-state"
import { db } from "@/lib/db/client"
import { userProductState } from "@/lib/db/schema"
import type { ActorContext } from "@/lib/session/actor-context"

export function mergeCompletedTours(current: string[], tourId: string) {
  return current.includes(tourId) ? current : [...current, tourId]
}

export async function getUserProductState(actor: ActorContext) {
  const [state] = await db
    .select({
      completedTours: userProductState.completedTours,
      lastSeenReleaseVersion: userProductState.lastSeenReleaseVersion,
    })
    .from(userProductState)
    .where(eq(userProductState.userId, actor.user.id))
    .limit(1)

  return productStateResponseSchema.parse({
    completedTours: state?.completedTours ?? [],
    lastSeenReleaseVersion: state?.lastSeenReleaseVersion ?? null,
  })
}

export async function updateUserProductState(
  actor: ActorContext,
  patch: {
    completeTourId?: string
    lastSeenReleaseVersion?: string | null
  },
) {
  const current = await getUserProductState(actor)
  const now = new Date()
  const nextState = {
    completedTours: patch.completeTourId ? mergeCompletedTours(current.completedTours, patch.completeTourId) : current.completedTours,
    lastSeenReleaseVersion:
      patch.lastSeenReleaseVersion === undefined ? current.lastSeenReleaseVersion : patch.lastSeenReleaseVersion,
  }

  const values = {
    userId: actor.user.id,
    completedTours: nextState.completedTours,
    lastSeenReleaseVersion: nextState.lastSeenReleaseVersion,
    updatedAt: now,
  }

  const [existing] = await db
    .select({ userId: userProductState.userId })
    .from(userProductState)
    .where(eq(userProductState.userId, actor.user.id))
    .limit(1)

  if (existing) {
    await db.update(userProductState).set(values).where(eq(userProductState.userId, actor.user.id))
  } else {
    await db.insert(userProductState).values({
      ...values,
      createdAt: now,
    })
  }

  return productStateResponseSchema.parse(nextState)
}
