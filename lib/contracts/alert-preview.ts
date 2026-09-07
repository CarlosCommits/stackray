import { z } from "zod";

import {
  CHANGE_TYPE_DEFINITIONS,
  getChangeTypeDefinition,
  type KnownChangeType,
} from "../changes/change-types.ts";

const knownChangeTypeSchema = z.string().refine(
  (value): value is KnownChangeType => getChangeTypeDefinition(value) !== null,
  "Select a supported change type.",
);

export const alertPreviewRequestSchema = z.object({
  target: z.string().trim().min(1).max(512),
  changeTypes: z.array(knownChangeTypeSchema)
    .min(1)
    .max(CHANGE_TYPE_DEFINITIONS.length)
    .transform((values) => [...new Set(values)]),
});

export const alertPreviewResponseSchema = z.object({
  email: z.object({
    subject: z.string(),
    html: z.string(),
    text: z.string(),
  }),
});

export type AlertPreviewRequest = z.infer<typeof alertPreviewRequestSchema>;
export type AlertPreviewResponse = z.infer<typeof alertPreviewResponseSchema>;
