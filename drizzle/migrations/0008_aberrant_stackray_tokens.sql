ALTER TABLE "users" ADD COLUMN "api_token_access_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "token_hint" text;
