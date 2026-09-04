CREATE TABLE "email_provider_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'resend' NOT NULL,
	"domain_id" text NOT NULL,
	"domain_name" text NOT NULL,
	"sender_name" text NOT NULL,
	"sender_local_part" text NOT NULL,
	"test_recipient" varchar(320) NOT NULL,
	"provider_api_key_id" text NOT NULL,
	"provider_api_key_name" text NOT NULL,
	"secret_plaintext" text,
	"secret_ciphertext" text,
	"secret_nonce" text,
	"secret_auth_tag" text,
	"encryption_algorithm" text,
	"encryption_key_version" integer,
	"last_test_status" "alert_channel_test_status" DEFAULT 'untested' NOT NULL,
	"last_tested_at" timestamp with time zone,
	"last_test_error_category" text,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_provider_settings_singleton" CHECK ("email_provider_settings"."id" = 'default'),
	CONSTRAINT "email_provider_settings_secret_envelope_complete" CHECK (("email_provider_settings"."secret_plaintext" IS NOT NULL AND "email_provider_settings"."secret_ciphertext" IS NULL AND "email_provider_settings"."secret_nonce" IS NULL AND "email_provider_settings"."secret_auth_tag" IS NULL AND "email_provider_settings"."encryption_algorithm" IS NULL AND "email_provider_settings"."encryption_key_version" IS NULL) OR ("email_provider_settings"."secret_plaintext" IS NULL AND "email_provider_settings"."secret_ciphertext" IS NOT NULL AND "email_provider_settings"."secret_nonce" IS NOT NULL AND "email_provider_settings"."secret_auth_tag" IS NOT NULL AND "email_provider_settings"."encryption_algorithm" IS NOT NULL AND "email_provider_settings"."encryption_key_version" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "resend_oauth_setup_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text DEFAULT 'configure' NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"secret_plaintext" text,
	"secret_ciphertext" text,
	"secret_nonce" text,
	"secret_auth_tag" text,
	"encryption_algorithm" text,
	"encryption_key_version" integer,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resend_oauth_setup_sessions_secret_envelope_complete" CHECK (("resend_oauth_setup_sessions"."secret_plaintext" IS NOT NULL AND "resend_oauth_setup_sessions"."secret_ciphertext" IS NULL AND "resend_oauth_setup_sessions"."secret_nonce" IS NULL AND "resend_oauth_setup_sessions"."secret_auth_tag" IS NULL AND "resend_oauth_setup_sessions"."encryption_algorithm" IS NULL AND "resend_oauth_setup_sessions"."encryption_key_version" IS NULL) OR ("resend_oauth_setup_sessions"."secret_plaintext" IS NULL AND "resend_oauth_setup_sessions"."secret_ciphertext" IS NOT NULL AND "resend_oauth_setup_sessions"."secret_nonce" IS NOT NULL AND "resend_oauth_setup_sessions"."secret_auth_tag" IS NOT NULL AND "resend_oauth_setup_sessions"."encryption_algorithm" IS NOT NULL AND "resend_oauth_setup_sessions"."encryption_key_version" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "email_provider_settings" ADD CONSTRAINT "email_provider_settings_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_provider_settings" ADD CONSTRAINT "email_provider_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resend_oauth_setup_sessions" ADD CONSTRAINT "resend_oauth_setup_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_resend_oauth_setup_sessions_user_expires_at" ON "resend_oauth_setup_sessions" USING btree ("user_id","expires_at");