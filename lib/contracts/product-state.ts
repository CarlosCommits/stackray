import { z } from "zod"
import { isoDateSchema } from "@/lib/contracts/common"

export const productStateResponseSchema = z
  .object({
    lastSeenReleaseVersion: z.string().nullable(),
    gettingStartedDismissedAt: isoDateSchema.nullable(),
  })
  .strict()

export const updateProductStateRequestSchema = z
  .object({
    lastSeenReleaseVersion: z.string().trim().min(1).nullable().optional(),
    gettingStartedDismissedAt: isoDateSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.lastSeenReleaseVersion !== undefined ||
      value.gettingStartedDismissedAt !== undefined,
    {
      message: "At least one product state field must be updated.",
    },
  )
