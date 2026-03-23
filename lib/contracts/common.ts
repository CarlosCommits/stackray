import { z } from "zod";

export const isoDateSchema = z.iso.datetime();

export const actorSourceSchema = z.enum(["ui", "cli", "api", "system"]);

export const scanStatusSchema = z.enum([
  "pending",
  "queued",
  "running",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const scanProfileSchema = z.enum(["stack-default", "stack-js", "stack-deep", "fingerprint-light"]);

export const cdnSchema = z.object({
  enabled: z.boolean(),
  name: z.string().nullable(),
  type: z.string().nullable(),
});

export const wordpressSchema = z.object({
  plugins: z.array(z.string()),
  themes: z.array(z.string()),
});

export const paginationSchema = z.object({
  nextCursor: z.string().nullable().optional(),
});
