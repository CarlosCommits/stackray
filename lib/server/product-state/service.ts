import { eq, sql } from "drizzle-orm"

import { productStateResponseSchema } from "@/lib/contracts/product-state"
import { db } from "@/lib/db/client"
import { userProductState } from "@/lib/db/schema"
import type { ActorContext } from "@/lib/session/actor-context"

type ProductStateFallback = {
  completedTours: string[]
  lastSeenReleaseVersion: string | null
}

const PRODUCT_STATE_SCHEMA_COLUMNS = [
  "user_id",
  "completed_tours",
  "last_seen_release_version",
  "created_at",
  "updated_at",
]

function getDefaultProductState(): ProductStateFallback {
  return {
    completedTours: [],
    lastSeenReleaseVersion: null,
  }
}

function isMissingUserProductStateRelationMessage(message: string) {
  const normalizedMessage = message.toLowerCase()

  return (
    normalizedMessage.includes("relation") &&
    normalizedMessage.includes("user_product_state") &&
    normalizedMessage.includes("does not exist")
  )
}

function isMissingUserProductStateColumnMessage(message: string) {
  const normalizedMessage = message.toLowerCase()

  return (
    normalizedMessage.includes("column") &&
    normalizedMessage.includes("does not exist") &&
    PRODUCT_STATE_SCHEMA_COLUMNS.some((columnName) => normalizedMessage.includes(columnName))
  )
}

export function isMissingUserProductStateSchemaError(error: unknown) {
  let currentError: unknown = error

  while (currentError instanceof Error) {
    const postgresError = currentError as Error & { cause?: unknown; code?: string }

    if (
      (postgresError.code === undefined || postgresError.code === "42P01") &&
      isMissingUserProductStateRelationMessage(currentError.message)
    ) {
      return true
    }

    if (
      (postgresError.code === undefined || postgresError.code === "42703") &&
      isMissingUserProductStateColumnMessage(currentError.message)
    ) {
      return true
    }

    currentError = postgresError.cause
  }

  return false
}

export function mergeCompletedTours(current: string[], tourId: string) {
  return current.includes(tourId) ? current : [...current, tourId]
}

export async function getUserProductState(actor: ActorContext) {
  try {
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
  } catch (error) {
    if (!isMissingUserProductStateSchemaError(error)) {
      throw error
    }

    return productStateResponseSchema.parse(getDefaultProductState())
  }
}

export async function updateUserProductState(
  actor: ActorContext,
  patch: {
    completeTourId?: string
    lastSeenReleaseVersion?: string | null
  },
) {
  try {
    return await db.transaction(async (tx) => {
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
  } catch (error) {
    if (!isMissingUserProductStateSchemaError(error)) {
      throw error
    }

    const currentState = getDefaultProductState()

    return productStateResponseSchema.parse({
      completedTours: patch.completeTourId ? mergeCompletedTours(currentState.completedTours, patch.completeTourId) : currentState.completedTours,
      lastSeenReleaseVersion:
        patch.lastSeenReleaseVersion === undefined ? currentState.lastSeenReleaseVersion : patch.lastSeenReleaseVersion,
    })
  }
}
