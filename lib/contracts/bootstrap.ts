import { z } from "zod"

export const firstAdminBootstrapRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  password: z.string().min(12).max(256),
})

export const firstAdminBootstrapResponseSchema = z.object({
  email: z.string().email(),
  displayName: z.string(),
  bootstrapOpen: z.boolean(),
})

export type FirstAdminBootstrapRequest = z.infer<typeof firstAdminBootstrapRequestSchema>
