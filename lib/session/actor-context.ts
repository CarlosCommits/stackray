import { cookies, headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { apiKeys, users } from "@/lib/db/schema";
import { auth } from "@/lib/auth/better-auth";
import { env } from "@/lib/env/server";
import { isAdminRole, type AppRole } from "@/lib/auth/permissions";
import { hashApiKey } from "@/lib/server/api-keys/crypto";
import { DEMO_USER_EMAIL, isDemoModeEnabled } from "@/lib/demo-mode";

export type SessionActorSource = "ui" | "cli" | "api" | "system";

export type ActorContext = {
  user: {
    id: string;
    email: string;
    displayName: string;
    image: string | null;
    role: AppRole;
  };
  apiKeyAccessEnabled: boolean;
  requiresPasswordChange: boolean;
  source: SessionActorSource;
  apiKey: {
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

const DEMO_USER = {
  email: DEMO_USER_EMAIL,
  displayName: "Stackray Demo",
  role: "user" as const,
  apiKeyAccessEnabled: false,
} as const;

function canUseDevelopmentActor(): boolean {
  return env.NODE_ENV !== "production" && env.STACKRAY_ENABLE_DEV_ACTOR === "true";
}

async function seedDemoActor(): Promise<ActorContext> {
  await db
    .insert(users)
    .values(DEMO_USER)
    .onConflictDoUpdate({
      target: users.email,
      set: {
        displayName: DEMO_USER.displayName,
        role: DEMO_USER.role,
        apiKeyAccessEnabled: DEMO_USER.apiKeyAccessEnabled,
        deactivatedAt: null,
        passwordChangeRequiredAt: null,
        updatedAt: new Date(),
      },
    });

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      image: users.image,
      role: users.role,
      apiKeyAccessEnabled: users.apiKeyAccessEnabled,
    })
    .from(users)
    .where(eq(users.email, DEMO_USER.email))
    .limit(1);

  if (!user) {
    throw new Error("Failed to resolve the demo actor context.");
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? user.email,
      image: user.image ?? null,
      role: (user.role as AppRole) ?? "user",
    },
    apiKeyAccessEnabled: user.apiKeyAccessEnabled,
    requiresPasswordChange: false,
    source: "ui",
    apiKey: null,
  };
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
    apiKeyAccessEnabled: true,
    requiresPasswordChange: false,
    source: "ui",
    apiKey: null,
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
    apiKeyAccessEnabled: boolean;
  },
  source: SessionActorSource,
  apiKey: ActorContext["apiKey"] = null,
): ActorContext {
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? user.email,
      image: user.image ?? null,
      role: normalizeRole(user.role),
    },
    apiKeyAccessEnabled: user.apiKeyAccessEnabled,
    requiresPasswordChange: Boolean(user.passwordChangeRequiredAt),
    source,
    apiKey,
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
      apiKeyAccessEnabled: users.apiKeyAccessEnabled,
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
      apiKeyAccessEnabled: membership.apiKeyAccessEnabled,
    },
    source,
  );
}

export async function resolveBearerActor(rawApiKey: string, source: SessionActorSource = "api"): Promise<ActorContext | null> {
  const keyHash = hashApiKey(rawApiKey);

  const [apiKeyRecord] = await db
    .select({
      apiKeyId: apiKeys.id,
      apiKeyName: apiKeys.name,
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      image: users.image,
      role: users.role,
      banned: users.banned,
      apiKeyAccessEnabled: users.apiKeyAccessEnabled,
      deactivatedAt: users.deactivatedAt,
      passwordChangeRequiredAt: users.passwordChangeRequiredAt,
    })
    .from(apiKeys)
    .innerJoin(users, eq(users.id, apiKeys.createdByUserId))
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!apiKeyRecord || apiKeyRecord.deactivatedAt || apiKeyRecord.banned) {
    return null;
  }

  const actor = buildActorContext(
    {
      id: apiKeyRecord.userId,
      email: apiKeyRecord.email,
      displayName: apiKeyRecord.displayName,
      image: apiKeyRecord.image,
      role: apiKeyRecord.role,
      passwordChangeRequiredAt: apiKeyRecord.passwordChangeRequiredAt,
      apiKeyAccessEnabled: apiKeyRecord.apiKeyAccessEnabled,
    },
    source,
    {
      id: apiKeyRecord.apiKeyId,
      name: apiKeyRecord.apiKeyName,
    },
  );

  if (actor.user.role !== "admin" && !actor.apiKeyAccessEnabled) {
    return null;
  }

  await db
    .update(apiKeys)
    .set({
      lastUsedAt: new Date(),
    })
    .where(eq(apiKeys.id, apiKeyRecord.apiKeyId));

  return actor;
}

export async function getActorContext(source: SessionActorSource = "ui"): Promise<ActorContext | null> {
  const authenticatedActor = await resolveAuthenticatedActor(source);

  if (authenticatedActor) {
    return authenticatedActor;
  }

  if (isDemoModeEnabled()) {
    const actor = await seedDemoActor();

    return {
      ...actor,
      source,
    };
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
