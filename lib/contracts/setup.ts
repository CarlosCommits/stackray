import { z } from "zod"
import { isoDateSchema } from "@/lib/contracts/common"

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

export const updateCustomDomainRequestSchema = z.object({
  hostname: z.string().trim().min(1),
})

export const customDomainStateResponseSchema = z.object({
  hostname: z.string().nullable(),
  canonicalBaseUrl: z.string().url().nullable(),
  expectedRailwayDomain: z.string().nullable(),
  dnsVerified: z.boolean(),
  appVerified: z.boolean(),
  cnameTargets: z.array(z.string()),
  resolvedAddresses: z.array(z.string()),
  dnsVerifiedAt: isoDateSchema.nullable(),
  appVerifiedAt: isoDateSchema.nullable(),
  lastCheckedAt: isoDateSchema.nullable(),
})

export type CustomDomainState = z.infer<typeof customDomainStateResponseSchema>
