import { cookies, headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { apiTokens, users } from "@/lib/db/schema";
import { auth } from "@/lib/auth/better-auth";
import { env } from "@/lib/env/server";
import { isAdminRole, type AppRole } from "@/lib/auth/permissions";
import { hashApiToken } from "@/lib/server/tokens/crypto";

export type SessionActorSource = "ui" | "cli" | "api" | "system";

export type ActorContext = {
  user: {
    id: string;
    email: string;
    displayName: string;
    image: string | null;
    role: AppRole;
  };
  apiTokenAccessEnabled: boolean;
  requiresPasswordChange: boolean;
  source: SessionActorSource;
  token: {
    id: string;
    name: string;
  } | null;
};

const DEVELOPMENT_USER = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "operator@stackray.local",
  displayName: "Stackray Operator",
  role: "admin" as const,
} as const;

function canUseDevelopmentActor(): boolean {
  return env.NODE_ENV !== "production" && env.STACKRAY_ENABLE_DEV_ACTOR === "true";
}

async function seedDevelopmentActor(): Promise<ActorContext> {
  await db.insert(users).values(DEVELOPMENT_USER).onConflictDoNothing();

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      image: users.image,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, DEVELOPMENT_USER.id))
    .limit(1);

  if (!user) {
    throw new Error("Failed to resolve the development actor context.");
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? user.email,
      image: user.image ?? null,
      role: (user.role as AppRole) ?? "admin",
    },
    apiTokenAccessEnabled: true,
    requiresPasswordChange: false,
    source: "ui",
    token: null,
  };
}

function normalizeRole(role: string | null | undefined): AppRole {
  return role === "viewer" || role === "user" || isAdminRole(role)
    ? (role as AppRole)
    : "user";
}

function buildActorContext(
  user: {
    id: string;
    email: string;
    displayName: string | null;
    image: string | null;
    role: string | null;
    passwordChangeRequiredAt: Date | null;
    apiTokenAccessEnabled: boolean;
  },
  source: SessionActorSource,
  token: ActorContext["token"] = null,
): ActorContext {
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? user.email,
      image: user.image ?? null,
      role: normalizeRole(user.role),
    },
    apiTokenAccessEnabled: user.apiTokenAccessEnabled,
    requiresPasswordChange: Boolean(user.passwordChangeRequiredAt),
    source,
    token,
  };
}

async function resolveAuthenticatedActor(source: SessionActorSource): Promise<ActorContext | null> {
  const requestHeaders = new Headers(await headers());
  const cookieHeader = (await cookies()).toString();

  if (cookieHeader) {
    requestHeaders.set("cookie", cookieHeader);
  }

  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session) {
    return null;
  }

  const [membership] = await db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      image: users.image,
      role: users.role,
      banned: users.banned,
      apiTokenAccessEnabled: users.apiTokenAccessEnabled,
      deactivatedAt: users.deactivatedAt,
      passwordChangeRequiredAt: users.passwordChangeRequiredAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!membership || membership.deactivatedAt || membership.banned) {
    return null;
  }

  return buildActorContext(
    {
      id: membership.userId,
      email: membership.email,
      displayName: membership.displayName,
      image: membership.image,
      role: membership.role,
      passwordChangeRequiredAt: membership.passwordChangeRequiredAt,
      apiTokenAccessEnabled: membership.apiTokenAccessEnabled,
    },
    source,
  );
}

export async function resolveBearerActor(rawToken: string, source: SessionActorSource = "api"): Promise<ActorContext | null> {
  const tokenHash = hashApiToken(rawToken);

  const [tokenRecord] = await db
    .select({
      tokenId: apiTokens.id,
      tokenName: apiTokens.name,
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      image: users.image,
      role: users.role,
      banned: users.banned,
      apiTokenAccessEnabled: users.apiTokenAccessEnabled,
      deactivatedAt: users.deactivatedAt,
      passwordChangeRequiredAt: users.passwordChangeRequiredAt,
    })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.createdByUserId))
    .where(and(eq(apiTokens.tokenHash, tokenHash), isNull(apiTokens.revokedAt)))
    .limit(1);

  if (!tokenRecord || tokenRecord.deactivatedAt || tokenRecord.banned) {
    return null;
  }

  const actor = buildActorContext(
    {
      id: tokenRecord.userId,
      email: tokenRecord.email,
      displayName: tokenRecord.displayName,
      image: tokenRecord.image,
      role: tokenRecord.role,
      passwordChangeRequiredAt: tokenRecord.passwordChangeRequiredAt,
      apiTokenAccessEnabled: tokenRecord.apiTokenAccessEnabled,
    },
    source,
    {
      id: tokenRecord.tokenId,
      name: tokenRecord.tokenName,
    },
  );

  if (actor.user.role !== "admin" && !actor.apiTokenAccessEnabled) {
    return null;
  }

  await db
    .update(apiTokens)
    .set({
      lastUsedAt: new Date(),
    })
    .where(eq(apiTokens.id, tokenRecord.tokenId));

  return actor;
}

export async function resolveSystemActor(userId: string): Promise<ActorContext | null> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      image: users.image,
      role: users.role,
      banned: users.banned,
      apiTokenAccessEnabled: users.apiTokenAccessEnabled,
      deactivatedAt: users.deactivatedAt,
      passwordChangeRequiredAt: users.passwordChangeRequiredAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.deactivatedAt || user.banned) {
    return null;
  }

  return buildActorContext(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      image: user.image,
      role: user.role,
      passwordChangeRequiredAt: user.passwordChangeRequiredAt,
      apiTokenAccessEnabled: user.apiTokenAccessEnabled,
    },
    "system",
  );
}

export async function getActorContext(source: SessionActorSource = "ui"): Promise<ActorContext | null> {
  const authenticatedActor = await resolveAuthenticatedActor(source);

  if (authenticatedActor) {
    return authenticatedActor;
  }

  if (!canUseDevelopmentActor()) {
    return null;
  }

  const actor = await seedDevelopmentActor();

  return {
    ...actor,
    source,
  };
}

export async function requireActorContext(source: SessionActorSource = "ui"): Promise<ActorContext> {
  const actor = await getActorContext(source);

  if (!actor) {
    throw new Error("Authentication is not configured.");
  }

  return actor;
}
