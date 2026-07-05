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

const optionalNonNegativeInteger = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().int().nonnegative().optional());

const optionalBooleanString = z.enum(["true", "false"]).optional();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("postgres://postgres:postgres@127.0.0.1:5432/stackray"),
  HTTPX_BIN: optionalNonEmptyString,
  NUCLEI_BIN: optionalNonEmptyString,
  SUBFINDER_BIN: optionalNonEmptyString,
  NUCLEI_TEMPLATES_DIR: optionalNonEmptyString,
  STACKRAY_HTTPX_TIMEOUT_MS: optionalPositiveInteger,
  STACKRAY_NUCLEI_TIMEOUT_MS: optionalPositiveInteger,
  STACKRAY_SUBFINDER_TIMEOUT_MS: optionalPositiveInteger,
  STACKRAY_SUBFINDER_SOURCE_TIMEOUT_SECONDS: optionalPositiveInteger,
  STACKRAY_SUBFINDER_MAX_TIME_MINUTES: optionalPositiveInteger,
  STACKRAY_SCREENSHOT_TIMEOUT_MS: optionalPositiveInteger,
  STACKRAY_HEADLESS_IDLE_MS: optionalPositiveInteger,
  STACKRAY_HEADLESS_ENRICHMENT_TIMEOUT_MS: optionalPositiveInteger,
  STACKRAY_HEADLESS_TECH_DETECTION_TIMEOUT_MS: optionalPositiveInteger,
  STACKRAY_BROWSER_FALLBACK_ENABLED: optionalBooleanString,
  STACKRAY_BROWSER_FALLBACK_TIMEOUT_MS: optionalPositiveInteger,
  STACKRAY_BROWSER_FALLBACK_SETTLE_TIMEOUT_MS: optionalPositiveInteger,
  STACKRAY_BROWSER_FALLBACK_IDLE_MS: optionalPositiveInteger,
  STACKRAY_BROWSER_FALLBACK_CHROME_BIN: optionalNonEmptyString,
  STACKRAY_BROWSER_FALLBACK_XVFB_BIN: optionalNonEmptyString,
  STACKRAY_WORKER_ROLE: z.enum(["all", "http", "intel", "browser"]).default("all"),
  STACKRAY_WORKER_CONCURRENCY: optionalPositiveInteger,
  STACKRAY_EXTERNAL_REVERSE_IP: z.enum(["true", "false"]).optional(),
  STACKRAY_GITHUB_TOKEN: optionalNonEmptyString,
  STACKRAY_RELEASE_REPOSITORY: optionalNonEmptyString,
  AWS_ACCESS_KEY_ID: optionalNonEmptyString,
  AWS_SECRET_ACCESS_KEY: optionalNonEmptyString,
  AWS_ENDPOINT_URL: optionalNonEmptyString,
  AWS_S3_BUCKET_NAME: optionalNonEmptyString,
  AWS_S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).optional(),
  AWS_DEFAULT_REGION: optionalNonEmptyString,
  BETTER_AUTH_SECRET: optionalNonEmptyString,
  BETTER_AUTH_URL: z.preprocess((value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value), z.url().optional()),
  RAILWAY_PUBLIC_DOMAIN: optionalNonEmptyString,
  RESEND_API_KEY: optionalNonEmptyString,
  RESEND_FROM_EMAIL: optionalNonEmptyString,
  AUTH_REPLY_TO_EMAIL: optionalNonEmptyString,
  STACKRAY_ALLOWED_HOSTS: optionalNonEmptyString,
  STACKRAY_ENABLE_DEV_ACTOR: z.enum(["true", "false"]).optional(),
  STACKRAY_ENABLE_DEMO: z.enum(["true", "false"]).optional(),
  STACKRAY_DEMO_DAILY_SCAN_LIMIT: optionalNonNegativeInteger,
  STACKRAY_ANALYTICS_SCRIPT_URL: optionalNonEmptyString,
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  HTTPX_BIN: process.env.HTTPX_BIN,
  NUCLEI_BIN: process.env.NUCLEI_BIN,
  SUBFINDER_BIN: process.env.SUBFINDER_BIN,
  NUCLEI_TEMPLATES_DIR: process.env.NUCLEI_TEMPLATES_DIR,
  STACKRAY_HTTPX_TIMEOUT_MS: process.env.STACKRAY_HTTPX_TIMEOUT_MS,
  STACKRAY_NUCLEI_TIMEOUT_MS: process.env.STACKRAY_NUCLEI_TIMEOUT_MS,
  STACKRAY_SUBFINDER_TIMEOUT_MS: process.env.STACKRAY_SUBFINDER_TIMEOUT_MS,
  STACKRAY_SUBFINDER_SOURCE_TIMEOUT_SECONDS: process.env.STACKRAY_SUBFINDER_SOURCE_TIMEOUT_SECONDS,
  STACKRAY_SUBFINDER_MAX_TIME_MINUTES: process.env.STACKRAY_SUBFINDER_MAX_TIME_MINUTES,
  STACKRAY_SCREENSHOT_TIMEOUT_MS: process.env.STACKRAY_SCREENSHOT_TIMEOUT_MS,
  STACKRAY_HEADLESS_IDLE_MS: process.env.STACKRAY_HEADLESS_IDLE_MS,
  STACKRAY_HEADLESS_ENRICHMENT_TIMEOUT_MS: process.env.STACKRAY_HEADLESS_ENRICHMENT_TIMEOUT_MS,
  STACKRAY_HEADLESS_TECH_DETECTION_TIMEOUT_MS: process.env.STACKRAY_HEADLESS_TECH_DETECTION_TIMEOUT_MS,
  STACKRAY_BROWSER_FALLBACK_ENABLED: process.env.STACKRAY_BROWSER_FALLBACK_ENABLED,
  STACKRAY_BROWSER_FALLBACK_TIMEOUT_MS: process.env.STACKRAY_BROWSER_FALLBACK_TIMEOUT_MS,
  STACKRAY_BROWSER_FALLBACK_SETTLE_TIMEOUT_MS: process.env.STACKRAY_BROWSER_FALLBACK_SETTLE_TIMEOUT_MS,
  STACKRAY_BROWSER_FALLBACK_IDLE_MS: process.env.STACKRAY_BROWSER_FALLBACK_IDLE_MS,
  STACKRAY_BROWSER_FALLBACK_CHROME_BIN: process.env.STACKRAY_BROWSER_FALLBACK_CHROME_BIN,
  STACKRAY_BROWSER_FALLBACK_XVFB_BIN: process.env.STACKRAY_BROWSER_FALLBACK_XVFB_BIN,
  STACKRAY_WORKER_ROLE: process.env.STACKRAY_WORKER_ROLE,
  STACKRAY_WORKER_CONCURRENCY: process.env.STACKRAY_WORKER_CONCURRENCY,
  STACKRAY_EXTERNAL_REVERSE_IP: process.env.STACKRAY_EXTERNAL_REVERSE_IP,
  STACKRAY_GITHUB_TOKEN: process.env.STACKRAY_GITHUB_TOKEN,
  STACKRAY_RELEASE_REPOSITORY: process.env.STACKRAY_RELEASE_REPOSITORY,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL,
  AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
  AWS_S3_FORCE_PATH_STYLE: process.env.AWS_S3_FORCE_PATH_STYLE,
  AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  AUTH_REPLY_TO_EMAIL: process.env.AUTH_REPLY_TO_EMAIL,
  STACKRAY_ALLOWED_HOSTS: process.env.STACKRAY_ALLOWED_HOSTS,
  STACKRAY_ENABLE_DEV_ACTOR: process.env.STACKRAY_ENABLE_DEV_ACTOR,
  STACKRAY_ENABLE_DEMO: process.env.STACKRAY_ENABLE_DEMO,
  STACKRAY_DEMO_DAILY_SCAN_LIMIT: process.env.STACKRAY_DEMO_DAILY_SCAN_LIMIT,
  STACKRAY_ANALYTICS_SCRIPT_URL: process.env.STACKRAY_ANALYTICS_SCRIPT_URL,
});
