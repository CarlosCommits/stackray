ALTER TABLE "email_provider_settings" ADD COLUMN "oauth_client_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "email_provider_settings" ADD COLUMN "oauth_scope" text NOT NULL;--> statement-breakpoint
ALTER TABLE "email_provider_settings" ADD COLUMN "access_token_expires_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "resend_oauth_setup_sessions" ADD COLUMN "oauth_scope" text NOT NULL;--> statement-breakpoint
ALTER TABLE "email_provider_settings" DROP COLUMN "domain_id";--> statement-breakpoint
ALTER TABLE "email_provider_settings" DROP COLUMN "provider_api_key_id";--> statement-breakpoint
ALTER TABLE "email_provider_settings" DROP COLUMN "provider_api_key_name";--> statement-breakpoint
ALTER TABLE "resend_oauth_setup_sessions" DROP COLUMN "purpose";--> statement-breakpoint
ALTER TABLE "resend_oauth_setup_sessions" DROP COLUMN "redirect_uri";