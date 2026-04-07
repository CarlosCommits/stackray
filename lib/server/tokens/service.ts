import { and, desc, eq } from "drizzle-orm";

import type { CreateApiTokenRequest } from "@/lib/contracts/tokens";
import {
  createApiTokenResponseSchema,
  deleteApiTokenResponseSchema,
  listApiTokensResponseSchema,
  type ApiToken,
} from "@/lib/contracts/tokens";
import { db } from "@/lib/db/client";
import { apiTokens } from "@/lib/db/schema";
import type { ActorContext } from "@/lib/session/actor-context";
import { canAccessApiTokens } from "@/lib/authorization/authz";
import { generateApiToken, getApiTokenHint, hashApiToken } from "@/lib/server/tokens/crypto";

function assertCanUseApiTokens(actor: ActorContext) {
  if (!canAccessApiTokens(actor)) {
    throw new Error("API token access is disabled for this account.");
  }
}

function mapApiToken(token: typeof apiTokens.$inferSelect): ApiToken {
  return {
    id: token.id,
    name: token.name,
    tokenHint: token.tokenHint ?? null,
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    createdAt: token.createdAt.toISOString(),
  };
}

export async function listApiTokens(actor: ActorContext) {
  assertCanUseApiTokens(actor);

  const tokens = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.createdByUserId, actor.user.id))
    .orderBy(desc(apiTokens.createdAt));

  return listApiTokensResponseSchema.parse({
    items: tokens.map(mapApiToken),
  });
}

export async function createApiToken(actor: ActorContext, input: CreateApiTokenRequest) {
  assertCanUseApiTokens(actor);

  const plainTextToken = generateApiToken();
  const [createdToken] = await db
    .insert(apiTokens)
    .values({
      createdByUserId: actor.user.id,
      name: input.name.trim(),
      tokenHint: getApiTokenHint(plainTextToken),
      tokenHash: hashApiToken(plainTextToken),
      scope: {},
    })
    .returning();

  return createApiTokenResponseSchema.parse({
    token: mapApiToken(createdToken),
    plainTextToken,
  });
}

export async function deleteApiToken(actor: ActorContext, tokenId: string) {
  assertCanUseApiTokens(actor);

  const [existingToken] = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.createdByUserId, actor.user.id)))
    .limit(1);

  if (!existingToken) {
    throw new Error("The requested API token could not be found.");
  }

  await db.delete(apiTokens).where(eq(apiTokens.id, tokenId));

  return deleteApiTokenResponseSchema.parse({ deletedTokenId: tokenId });
}
