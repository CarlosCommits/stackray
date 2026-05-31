import { and, desc, eq, isNull } from "drizzle-orm";

import type { CreateApiKeyRequest } from "@/lib/contracts/api-keys";
import {
  createApiKeyResponseSchema,
  listApiKeysResponseSchema,
  revokeApiKeyResponseSchema,
  type ApiKey,
} from "@/lib/contracts/api-keys";
import { db } from "@/lib/db/client";
import { apiKeys } from "@/lib/db/schema";
import type { ActorContext } from "@/lib/session/actor-context";
import { canAccessApiKeys } from "@/lib/authorization/authz";
import { generateApiKey, getApiKeyHint, hashApiKey } from "@/lib/server/api-keys/crypto";

function assertCanUseApiKeys(actor: ActorContext) {
  if (!canAccessApiKeys(actor)) {
    throw new Error("API key access is disabled for this account.");
  }
}

function mapApiKey(apiKey: typeof apiKeys.$inferSelect): ApiKey {
  return {
    id: apiKey.id,
    name: apiKey.name,
    keyHint: apiKey.keyHint ?? null,
    lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
    createdAt: apiKey.createdAt.toISOString(),
  };
}

export async function listApiKeys(actor: ActorContext) {
  assertCanUseApiKeys(actor);

  const keyRows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.createdByUserId, actor.user.id), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));

  return listApiKeysResponseSchema.parse({
    items: keyRows.map(mapApiKey),
  });
}

export async function createApiKey(actor: ActorContext, input: CreateApiKeyRequest) {
  assertCanUseApiKeys(actor);

  const plainTextApiKey = generateApiKey();
  const [createdApiKey] = await db
    .insert(apiKeys)
    .values({
      createdByUserId: actor.user.id,
      name: input.name.trim(),
      keyHint: getApiKeyHint(plainTextApiKey),
      keyHash: hashApiKey(plainTextApiKey),
      scope: {},
    })
    .returning();

  return createApiKeyResponseSchema.parse({
    apiKey: mapApiKey(createdApiKey),
    plainTextApiKey,
  });
}

export async function revokeApiKey(actor: ActorContext, apiKeyId: string) {
  assertCanUseApiKeys(actor);

  const [existingApiKey] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.createdByUserId, actor.user.id), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!existingApiKey) {
    throw new Error("The requested API key could not be found.");
  }

  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, apiKeyId));

  return revokeApiKeyResponseSchema.parse({ revokedApiKeyId: apiKeyId });
}
