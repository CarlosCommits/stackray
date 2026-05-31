ALTER TABLE "api_tokens" RENAME TO "api_keys";--> statement-breakpoint
ALTER TABLE "api_keys" RENAME COLUMN "token_hint" TO "key_hint";--> statement-breakpoint
ALTER TABLE "api_keys" RENAME COLUMN "token_hash" TO "key_hash";--> statement-breakpoint
ALTER TABLE "scans" RENAME COLUMN "created_by_token_id" TO "created_by_api_key_id";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "api_token_access_enabled" TO "api_key_access_enabled";--> statement-breakpoint
ALTER TABLE "api_keys" DROP CONSTRAINT "api_tokens_created_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "scans" DROP CONSTRAINT "scans_created_by_token_id_api_tokens_id_fk";
--> statement-breakpoint
DROP INDEX "idx_api_tokens_token_hash";--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_created_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_api_keys_key_hash" ON "api_keys" USING btree ("key_hash");