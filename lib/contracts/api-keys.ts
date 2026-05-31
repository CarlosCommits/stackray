import { z } from "zod";

import { isoDateSchema } from "@/lib/contracts/common";

export const apiKeySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  keyHint: z.string().nullable(),
  lastUsedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
});

export const listApiKeysResponseSchema = z.object({
  items: z.array(apiKeySchema),
});

export const createApiKeyRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const createApiKeyResponseSchema = z.object({
  apiKey: apiKeySchema,
  plainTextApiKey: z.string().min(1),
});

export const revokeApiKeyResponseSchema = z.object({
  revokedApiKeyId: z.string().uuid(),
});

export type ApiKey = z.infer<typeof apiKeySchema>;
export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>;
