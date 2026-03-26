import { z } from "zod";

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().min(1).optional());

const optionalPositiveInteger = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().int().positive().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("postgres://postgres:postgres@127.0.0.1:5432/stackray"),
  HTTPX_BIN: optionalNonEmptyString,
  STACKRAY_HTTPX_TIMEOUT_MS: optionalPositiveInteger,
  BETTER_AUTH_SECRET: optionalNonEmptyString,
  BETTER_AUTH_URL: z.preprocess((value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value), z.url().optional()),
  RESEND_API_KEY: optionalNonEmptyString,
  RESEND_FROM_EMAIL: optionalNonEmptyString,
  AUTH_REPLY_TO_EMAIL: optionalNonEmptyString,
  STACKRAY_ENABLE_DEV_ACTOR: z.enum(["true", "false"]).optional(),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  HTTPX_BIN: process.env.HTTPX_BIN,
  STACKRAY_HTTPX_TIMEOUT_MS: process.env.STACKRAY_HTTPX_TIMEOUT_MS,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  AUTH_REPLY_TO_EMAIL: process.env.AUTH_REPLY_TO_EMAIL,
  STACKRAY_ENABLE_DEV_ACTOR: process.env.STACKRAY_ENABLE_DEV_ACTOR,
});

export type ServerEnv = typeof env;
