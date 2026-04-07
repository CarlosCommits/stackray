import { z } from "zod";

import { isoDateSchema } from "@/lib/contracts/common";

export const apiTokenSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  tokenHint: z.string().nullable(),
  lastUsedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
});

export const listApiTokensResponseSchema = z.object({
  items: z.array(apiTokenSchema),
});

export const createApiTokenRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const createApiTokenResponseSchema = z.object({
  token: apiTokenSchema,
  plainTextToken: z.string().min(1),
});

export const deleteApiTokenResponseSchema = z.object({
  deletedTokenId: z.string().uuid(),
});

export type ApiToken = z.infer<typeof apiTokenSchema>;
export type CreateApiTokenRequest = z.infer<typeof createApiTokenRequestSchema>;
export type DeleteApiTokenResponse = z.infer<typeof deleteApiTokenResponseSchema>;
