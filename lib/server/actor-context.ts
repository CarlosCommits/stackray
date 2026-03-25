import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { auth } from "@/lib/auth/server";
import { env } from "@/lib/env/server";
import { isAdminRole, type AppRole } from "@/lib/auth/permissions";

export type SessionActorSource = "ui" | "cli" | "api" | "system";

export type ActorContext = {
  user: {
    id: string;
    email: string;
    displayName: string;
    image: string | null;
    role: AppRole;
  };
  requiresPasswordChange: boolean;
  source: SessionActorSource;
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
    requiresPasswordChange: false,
    source: "ui",
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
      deactivatedAt: users.deactivatedAt,
      passwordChangeRequiredAt: users.passwordChangeRequiredAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!membership || membership.deactivatedAt || membership.banned) {
    return null;
  }

  const normalizedRole = membership.role === "viewer" || membership.role === "user" || isAdminRole(membership.role)
    ? (membership.role as AppRole)
    : "user";

  return {
    user: {
      id: membership.userId,
      email: membership.email,
      displayName: membership.displayName ?? membership.email,
      image: membership.image ?? null,
      role: normalizedRole,
    },
    requiresPasswordChange: Boolean(membership.passwordChangeRequiredAt),
    source,
  };
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
