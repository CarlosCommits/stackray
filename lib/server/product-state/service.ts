import { eq, sql } from "drizzle-orm"

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
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${actor.user.id}))`)

    const now = new Date()
    const [existing] = await tx
      .select({
        completedTours: userProductState.completedTours,
        lastSeenReleaseVersion: userProductState.lastSeenReleaseVersion,
      })
      .from(userProductState)
      .where(eq(userProductState.userId, actor.user.id))
      .limit(1)

    const currentState = {
      completedTours: existing?.completedTours ?? [],
      lastSeenReleaseVersion: existing?.lastSeenReleaseVersion ?? null,
    }

    const nextState = {
      completedTours: patch.completeTourId ? mergeCompletedTours(currentState.completedTours, patch.completeTourId) : currentState.completedTours,
      lastSeenReleaseVersion:
        patch.lastSeenReleaseVersion === undefined ? currentState.lastSeenReleaseVersion : patch.lastSeenReleaseVersion,
    }

    const values = {
      userId: actor.user.id,
      completedTours: nextState.completedTours,
      lastSeenReleaseVersion: nextState.lastSeenReleaseVersion,
      updatedAt: now,
    }

    if (existing) {
      await tx.update(userProductState).set(values).where(eq(userProductState.userId, actor.user.id))
    } else {
      await tx.insert(userProductState).values({
        ...values,
        createdAt: now,
      })
    }

    return productStateResponseSchema.parse(nextState)
  })
}
