import { z } from "zod"

export const productStateResponseSchema = z
  .object({
    lastSeenReleaseVersion: z.string().nullable(),
  })
  .strict()

export const updateProductStateRequestSchema = z
  .object({
    lastSeenReleaseVersion: z.string().trim().min(1).nullable().optional(),
  })
  .strict()
  .refine((value) => value.lastSeenReleaseVersion !== undefined, {
    message: "At least one product state field must be updated.",
  })

export type ProductState = z.infer<typeof productStateResponseSchema>
