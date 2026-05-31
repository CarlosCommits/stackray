import { headers } from "next/headers";

import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

import { auth } from "@/lib/auth/better-auth";
import { canSendAuthEmail } from "@/lib/auth/mailer";
import { generateTemporaryPassword } from "@/lib/auth/passwords";
import {
  createUserResponseSchema,
  listUsersResponseSchema,
  resetUserPasswordResponseSchema,
  type AppUser,
} from "@/lib/contracts/users";
import { db } from "@/lib/db/client";
import { authAccounts, authSessions, users } from "@/lib/db/schema";
import { buildAbsoluteUrl, getConfiguredPublicOrigin, getPublicOrigin } from "@/lib/public-origin";
import type { ActorContext } from "@/lib/session/actor-context";
import { canEditUserRole, canManageUsers } from "@/lib/authorization/authz";

function assertAdmin(actor: ActorContext) {
  if (!canManageUsers(actor)) {
    throw new Error("You do not have permission to manage users.");
  }
}

function assertNotSelfTarget(actor: ActorContext, userId: string) {
  if (actor.user.id === userId) {
    throw new Error("You cannot modify or delete your own admin access from this page.");
  }
}

async function getRequestHeaders() {
  return headers();
}

async function getResetPasswordRedirectUrl() {
  const publicOrigin = getConfiguredPublicOrigin() ?? (await getPublicOrigin())

  if (publicOrigin) {
    return buildAbsoluteUrl("/reset-password", publicOrigin)
  }

  throw new Error("A public Stackray URL could not be resolved for password reset links.")
}

function toAppUser(row: {
  userId: string;
  email: string;
  displayName: string | null;
  role: ActorContext["user"]["role"];
  banned: boolean;
  deactivatedAt: Date | null;
  passwordChangeRequiredAt: Date | null;
  hasPassword: boolean;
  lastLoginAt: Date | null;
  apiKeyAccessEnabled: boolean;
}): AppUser {
  return {
    userId: row.userId,
    email: row.email,
    displayName: row.displayName ?? row.email,
    role: row.role,
    isActive: !row.banned && !row.deactivatedAt,
    requiresPasswordChange: Boolean(row.passwordChangeRequiredAt),
    hasPassword: row.hasPassword,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    apiKeyAccessEnabled: row.role === "admin" ? true : row.apiKeyAccessEnabled,
  };
}

async function getUserById(userId: string): Promise<AppUser | null> {
  const [user] = await db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      banned: users.banned,
      apiKeyAccessEnabled: users.apiKeyAccessEnabled,
      deactivatedAt: users.deactivatedAt,
      passwordChangeRequiredAt: users.passwordChangeRequiredAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return null;
  }

  const [account, latestSession] = await Promise.all([
    db
      .select({ id: authAccounts.id })
      .from(authAccounts)
      .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, "credential")))
      .limit(1),
    db
      .select({ updatedAt: authSessions.updatedAt })
      .from(authSessions)
      .where(eq(authSessions.userId, userId))
      .orderBy(desc(authSessions.updatedAt))
      .limit(1),
  ]);

  return toAppUser({
    ...user,
      role: user.role,
      hasPassword: Boolean(account[0]),
      lastLoginAt: latestSession[0]?.updatedAt ?? null,
      apiKeyAccessEnabled: user.apiKeyAccessEnabled,
    });
}

function normalizeUserEmail(email: string) {
  return email.trim().toLowerCase();
}

function isEmailUniquenessError(error: unknown): boolean {
  let current: unknown = error;

  while (current instanceof Error) {
    const candidate = current as Error & { code?: string; constraint?: string; cause?: unknown };

    if (
      candidate.code === "23505" &&
      (!candidate.constraint || candidate.constraint.toLowerCase().includes("email"))
    ) {
      return true;
    }

    current = candidate.cause;
  }

  return false;
}

async function assertEmailAvailableForUser(userId: string, normalizedEmail: string) {
  const [emailOwner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${normalizedEmail}`, ne(users.id, userId)))
    .limit(1);

  if (emailOwner) {
    throw new Error("A user with that email already exists.");
  }
}

export async function listUsers(actor: ActorContext) {
  assertAdmin(actor);

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      banned: users.banned,
      apiKeyAccessEnabled: users.apiKeyAccessEnabled,
      deactivatedAt: users.deactivatedAt,
      passwordChangeRequiredAt: users.passwordChangeRequiredAt,
    })
    .from(users)
    .orderBy(users.email);

  const userIds = rows.map((row) => row.userId);
  const [accounts, sessions] = await Promise.all([
    userIds.length > 0
      ? db
          .select({ userId: authAccounts.userId })
          .from(authAccounts)
          .where(and(inArray(authAccounts.userId, userIds), eq(authAccounts.providerId, "credential")))
      : Promise.resolve([]),
    userIds.length > 0
      ? db
          .select({ userId: authSessions.userId, updatedAt: authSessions.updatedAt })
          .from(authSessions)
          .where(inArray(authSessions.userId, userIds))
          .orderBy(desc(authSessions.updatedAt))
      : Promise.resolve([]),
  ]);

  const passwordUserIds = new Set(accounts.map((account) => account.userId));
  const latestSessionByUserId = new Map<string, Date>();
  for (const session of sessions) {
    if (!latestSessionByUserId.has(session.userId)) {
      latestSessionByUserId.set(session.userId, session.updatedAt);
    }
  }

  return listUsersResponseSchema.parse({
    items: rows.map((row) =>
      toAppUser({
        ...row,
        role: row.role,
        hasPassword: passwordUserIds.has(row.userId),
        lastLoginAt: latestSessionByUserId.get(row.userId) ?? null,
        apiKeyAccessEnabled: row.apiKeyAccessEnabled,
      }),
    ),
  });
}

export async function createUser(
  actor: ActorContext,
  input: {
    email: string;
    displayName: string;
    role: ActorContext["user"]["role"];
    deliveryMode: "email" | "temp-password";
  },
) {
  assertAdmin(actor);

  if (input.deliveryMode === "email" && !canSendAuthEmail()) {
    throw new Error("Email delivery is not configured. Use temp-password delivery instead.");
  }

  const temporaryPassword = generateTemporaryPassword();
  const response = await auth.api.createUser({
    headers: await getRequestHeaders(),
    body: {
      email: input.email,
      password: temporaryPassword,
      name: input.displayName,
      role: input.role,
    },
  });

  await db
    .update(users)
    .set({
      passwordChangeRequiredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, response.user.id));

  if (input.deliveryMode === "email") {
    const redirectTo = await getResetPasswordRedirectUrl();

    await auth.api.requestPasswordReset({
      headers: await getRequestHeaders(),
      body: {
        email: input.email,
        redirectTo,
      },
    });
  }

  const user = await getUserById(response.user.id);

  if (!user) {
    throw new Error("The new user could not be loaded.");
  }

  return createUserResponseSchema.parse({
    user,
    temporaryPassword: input.deliveryMode === "temp-password" ? temporaryPassword : null,
  });
}

export async function updateUser(
  actor: ActorContext,
  userId: string,
  patch: {
    email?: string;
    displayName?: string;
    role?: ActorContext["user"]["role"];
    apiKeyAccessEnabled?: boolean;
  },
) {
  assertAdmin(actor);

  const [existingUser] = await db
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!existingUser) {
    throw new Error("The requested user could not be found.");
  }

  if (patch.role && patch.role !== existingUser.role) {
    assertNotSelfTarget(actor, userId);
  }

  if (patch.role && !canEditUserRole(actor, patch.role)) {
    throw new Error("You do not have permission to assign that role.");
  }

  const nextRole = patch.role ?? existingUser.role;

  if (patch.apiKeyAccessEnabled !== undefined && nextRole === "admin" && patch.apiKeyAccessEnabled === false) {
    throw new Error("Admin API key access cannot be disabled.");
  }

  if (patch.role) {
    await auth.api.setRole({
      headers: await getRequestHeaders(),
      body: {
        userId,
        role: patch.role,
      },
    });
  }

  if (patch.email !== undefined || patch.displayName !== undefined) {
    const authUserPatch: { email?: string; name?: string } = {};

    if (patch.email !== undefined) {
      const normalizedEmail = normalizeUserEmail(patch.email);

      if (!normalizedEmail) {
        throw new Error("Email is required.");
      }

      if (normalizedEmail !== existingUser.email.toLowerCase()) {
        await assertEmailAvailableForUser(userId, normalizedEmail);
      }

      authUserPatch.email = normalizedEmail;
    }

    if (patch.displayName !== undefined) {
      authUserPatch.name = patch.displayName.trim();
    }

    try {
      const authContext = await auth.$context;
      await authContext.internalAdapter.updateUser(userId, authUserPatch);
    } catch (error) {
      if (isEmailUniquenessError(error)) {
        throw new Error("A user with that email already exists.");
      }

      throw error;
    }
  }

  if (patch.apiKeyAccessEnabled !== undefined) {
    await db
      .update(users)
      .set({
        apiKeyAccessEnabled: nextRole === "admin" ? true : patch.apiKeyAccessEnabled,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  const user = await getUserById(userId);

  if (!user) {
    throw new Error("The updated user could not be loaded.");
  }

  return user;
}

export async function resetUserPassword(
  actor: ActorContext,
  userId: string,
  deliveryMode: "email" | "temp-password",
) {
  assertAdmin(actor);

  const user = await getUserById(userId);

  if (!user) {
    throw new Error("The requested user could not be found.");
  }

  if (deliveryMode === "email") {
    if (!canSendAuthEmail()) {
      throw new Error("Email delivery is not configured. Use temp-password delivery instead.");
    }

    const redirectTo = await getResetPasswordRedirectUrl();

    await auth.api.requestPasswordReset({
      headers: await getRequestHeaders(),
      body: {
        email: user.email,
        redirectTo,
      },
    });

    return resetUserPasswordResponseSchema.parse({
      temporaryPassword: null,
      deliveredByEmail: true,
    });
  }

  const temporaryPassword = generateTemporaryPassword();
  await auth.api.setUserPassword({
    headers: await getRequestHeaders(),
    body: {
      userId,
      newPassword: temporaryPassword,
    },
  });

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordChangeRequiredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await tx.delete(authSessions).where(eq(authSessions.userId, userId));
  });

  return resetUserPasswordResponseSchema.parse({
    temporaryPassword,
    deliveredByEmail: false,
  });
}

export async function deleteUser(actor: ActorContext, userId: string) {
  assertAdmin(actor);
  assertNotSelfTarget(actor, userId);

  await auth.api.removeUser({
    headers: await getRequestHeaders(),
    body: {
      userId,
    },
  });

  return { ok: true };
}
