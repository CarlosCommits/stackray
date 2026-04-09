import { randomUUID } from "node:crypto"

import { and, count, eq, isNull, sql } from "drizzle-orm"
import { hashPassword } from "better-auth/crypto"

import { firstAdminBootstrapResponseSchema, type FirstAdminBootstrapRequest } from "@/lib/contracts/bootstrap"
import { db } from "@/lib/db/client"
import { authAccounts, users } from "@/lib/db/schema"

const BOOTSTRAP_LOCK_KEY = "stackray-first-admin-bootstrap"

export class BootstrapClosedError extends Error {
  constructor() {
    super("This Stackray instance has already been initialized. Sign in to continue.")
  }
}

export async function isBootstrapOpen() {
  const [row] = await db
    .select({ count: count() })
    .from(users)
    .where(isNull(users.deactivatedAt))

  return row.count === 0
}

export async function createFirstAdmin(input: FirstAdminBootstrapRequest) {
  const normalizedEmail = input.email.trim().toLowerCase()
  const normalizedDisplayName = input.displayName.trim()

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${BOOTSTRAP_LOCK_KEY}))`)

    const [activeUserCount] = await tx
      .select({ count: count() })
      .from(users)
      .where(isNull(users.deactivatedAt))

    if (activeUserCount.count > 0) {
      throw new BootstrapClosedError()
    }

    const userId = randomUUID()
    const now = new Date()
    const passwordHash = await hashPassword(input.password)

    await tx.insert(users).values({
      id: userId,
      email: normalizedEmail,
      displayName: normalizedDisplayName,
      emailVerified: true,
      role: "admin",
      passwordChangeRequiredAt: null,
      createdAt: now,
      updatedAt: now,
    })

    await tx.insert(authAccounts).values({
      userId,
      providerId: "credential",
      accountId: userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    })

    return firstAdminBootstrapResponseSchema.parse({
      email: normalizedEmail,
      displayName: normalizedDisplayName,
      bootstrapOpen: false,
    })
  })
}
