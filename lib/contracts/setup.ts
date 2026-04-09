import { z } from "zod"

export const updateSetupRequestSchema = z.object({
  publicUrl: z.string().url(),
})

export const setupStateResponseSchema = z.object({
  publicUrl: z.string().url().nullable(),
  detectedPublicUrl: z.string().url().nullable(),
  hasUsers: z.boolean(),
  hasTokens: z.boolean(),
  hasScans: z.boolean(),
  isSetupComplete: z.boolean(),
})

export type SetupState = z.infer<typeof setupStateResponseSchema>
export type UpdateSetupRequest = z.infer<typeof updateSetupRequestSchema>
