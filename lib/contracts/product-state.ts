import { z } from "zod"

export const productStateResponseSchema = z.object({
  completedTours: z.array(z.string()),
  lastSeenReleaseVersion: z.string().nullable(),
})

export const updateProductStateRequestSchema = z
  .object({
    completeTourId: z.string().trim().min(1).optional(),
    lastSeenReleaseVersion: z.string().trim().min(1).nullable().optional(),
  })
  .refine((value) => value.completeTourId !== undefined || value.lastSeenReleaseVersion !== undefined, {
    message: "At least one product state field must be updated.",
  })

export type ProductState = z.infer<typeof productStateResponseSchema>
