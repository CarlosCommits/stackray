import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { users, workspaceMembers, workspaces } from "@/lib/db/schema";
import { env } from "@/lib/env/server";

export type SessionActorSource = "ui" | "cli" | "api" | "system";

export type ActorContext = {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  source: SessionActorSource;
};

const DEVELOPMENT_WORKSPACE = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Workspace Alpha",
  slug: "workspace-alpha",
} as const;

const DEVELOPMENT_USER = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "operator@stackray.local",
  displayName: "Stackray Operator",
} as const;

function canUseDevelopmentActor(): boolean {
  return env.NODE_ENV !== "production";
}

async function seedDevelopmentActor(): Promise<ActorContext> {
  await db.transaction(async (tx) => {
    await tx.insert(workspaces).values(DEVELOPMENT_WORKSPACE).onConflictDoNothing();
    await tx.insert(users).values(DEVELOPMENT_USER).onConflictDoNothing();
    await tx
      .insert(workspaceMembers)
      .values({
        workspaceId: DEVELOPMENT_WORKSPACE.id,
        userId: DEVELOPMENT_USER.id,
        role: "owner",
      })
      .onConflictDoNothing();
  });

  const [workspace] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
    })
    .from(workspaces)
    .where(eq(workspaces.id, DEVELOPMENT_WORKSPACE.id))
    .limit(1);

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
    })
    .from(users)
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.userId, users.id),
        eq(workspaceMembers.workspaceId, DEVELOPMENT_WORKSPACE.id),
      ),
    )
    .where(eq(users.id, DEVELOPMENT_USER.id))
    .limit(1);

  if (!workspace || !user) {
    throw new Error("Failed to resolve the development actor context.");
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? user.email,
    },
    workspace,
    source: "ui",
  };
}

export async function getActorContext(source: SessionActorSource = "ui"): Promise<ActorContext | null> {
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
