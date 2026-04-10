CREATE TYPE "public"."attempt_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."scan_result_nuclei_run_status" AS ENUM('pending', 'running', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."scan_event_type" AS ENUM('scan.status', 'scan.progress', 'scan.result', 'scan.complete', 'scan.failed', 'scan.cancelled');--> statement-breakpoint
CREATE TYPE "public"."scan_source" AS ENUM('ui', 'cli', 'api', 'system');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('pending', 'queued', 'running', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('url', 'host', 'domain');--> statement-breakpoint
CREATE TYPE "public"."technology_source" AS ENUM('wappalyzer', 'wordpress', 'cpe', 'derived');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user', 'viewer');--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_user_id" uuid,
	"name" text NOT NULL,
	"token_hint" text,
	"token_hash" text NOT NULL,
	"scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"impersonated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canonical_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"normalized_target" text NOT NULL,
	"target_type" "target_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canonical_targets_normalized_target_unique" UNIQUE("normalized_target")
);
--> statement-breakpoint
CREATE TABLE "instance_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"canonical_base_url" text,
	"custom_domain_hostname" text,
	"custom_domain_dns_verified_at" timestamp with time zone,
	"custom_domain_app_verified_at" timestamp with time zone,
	"custom_domain_last_checked_at" timestamp with time zone,
	"setup_completed_at" timestamp with time zone,
	"setup_completed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_user_id" uuid,
	"name" text NOT NULL,
	"query" jsonb NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"worker_id" text,
	"status" "attempt_status" NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"meta_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "scan_attempts_scan_id_attempt_number_unique" UNIQUE("scan_id","attempt_number")
);
--> statement-breakpoint
CREATE TABLE "scan_comparisons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"baseline_scan_id" uuid NOT NULL,
	"comparison_scan_id" uuid NOT NULL,
	"diff_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_comparisons_baseline_scan_id_comparison_scan_id_unique" UNIQUE("baseline_scan_id","comparison_scan_id")
);
--> statement-breakpoint
CREATE TABLE "scan_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"scan_id" uuid NOT NULL,
	"attempt_id" uuid,
	"event_type" "scan_event_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_result_cpes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"vendor" text,
	"product" text,
	"cpe" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_result_cpes_result_id_cpe_unique" UNIQUE("result_id","cpe")
);
--> statement-breakpoint
CREATE TABLE "scan_result_nuclei_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"result_id" uuid NOT NULL,
	"template_id" text NOT NULL,
	"template_path" text,
	"matcher_name" text,
	"protocol_type" text,
	"severity" text,
	"matched_at" text,
	"host" text,
	"ip" varchar(64),
	"port" text,
	"scheme" text,
	"url" text,
	"path" text,
	"extracted_results_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"technology_name" text,
	"technology_version" text,
	"finding_kind" text NOT NULL,
	"subject" text,
	"subject_type" text,
	"raw_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_result_nuclei_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"status" "scan_result_nuclei_run_status" NOT NULL,
	"target_url" text,
	"target_host" text,
	"original_domain_target" text,
	"final_domain_target" text,
	"domain_target" text,
	"headers_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"template_ids_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"engine_version" text,
	"templates_version" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_result_technologies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"technology_name" text NOT NULL,
	"technology_version" text,
	"source" "technology_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_result_wordpress_plugins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"plugin_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_result_wordpress_plugins_result_id_plugin_name_unique" UNIQUE("result_id","plugin_name")
);
--> statement-breakpoint
CREATE TABLE "scan_result_wordpress_themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"theme_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_result_wordpress_themes_result_id_theme_name_unique" UNIQUE("result_id","theme_name")
);
--> statement-breakpoint
CREATE TABLE "scan_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"scan_target_id" uuid NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"url" text,
	"final_url" text,
	"input" text,
	"host" text,
	"scheme" text,
	"port" text,
	"path" text,
	"method" text,
	"host_ip" varchar(64),
	"status_code" integer,
	"title" text,
	"web_server" text,
	"location" text,
	"content_type" text,
	"content_length" bigint,
	"response_time_ms" integer,
	"words" integer,
	"lines" integer,
	"cdn" boolean,
	"cdn_name" text,
	"cdn_type" text,
	"favicon_mmh3" text,
	"favicon_md5" text,
	"favicon_url" text,
	"favicon_path" text,
	"sni" text,
	"jarm_hash" text,
	"body_preview" text,
	"raw_headers" text,
	"response_headers_json" jsonb,
	"dns_a_records" jsonb,
	"dns_aaaa_records" jsonb,
	"dns_cname_records" jsonb,
	"dns_resolvers" jsonb,
	"asn_json" jsonb,
	"tls_json" jsonb,
	"csp_json" jsonb,
	"hashes_json" jsonb,
	"body_domains" jsonb,
	"body_fqdns" jsonb,
	"redirect_chain_status_codes" jsonb,
	"redirect_chain_json" jsonb,
	"http2" boolean,
	"pipeline" boolean,
	"websocket" boolean,
	"vhost" boolean,
	"stored_response_path" text,
	"screenshot_object_key" text,
	"screenshot_content_type" text,
	"screenshot_byte_size" bigint,
	"screenshot_captured_at" timestamp with time zone,
	"failed" boolean DEFAULT false NOT NULL,
	"raw_json" jsonb NOT NULL,
	"search_document" text
);
--> statement-breakpoint
CREATE TABLE "scan_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"canonical_target_id" uuid,
	"input_target" text NOT NULL,
	"normalized_target" text NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_targets_scan_id_normalized_target_unique" UNIQUE("scan_id","normalized_target")
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_user_id" uuid,
	"created_by_token_id" uuid,
	"source" "scan_source" NOT NULL,
	"status" "scan_status" NOT NULL,
	"profile" text NOT NULL,
	"idempotency_key" text,
	"request_fingerprint" text NOT NULL,
	"request_schema_version" integer DEFAULT 1 NOT NULL,
	"options_json" jsonb NOT NULL,
	"target_count" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancellation_requested_at" timestamp with time zone,
	"error_code" text,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "user_product_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"completed_tours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_seen_release_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"display_name" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"api_token_access_enabled" boolean DEFAULT true NOT NULL,
	"deactivated_at" timestamp with time zone,
	"password_change_required_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD CONSTRAINT "instance_settings_setup_completed_by_user_id_users_id_fk" FOREIGN KEY ("setup_completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_attempts" ADD CONSTRAINT "scan_attempts_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD CONSTRAINT "scan_comparisons_baseline_scan_id_scans_id_fk" FOREIGN KEY ("baseline_scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD CONSTRAINT "scan_comparisons_comparison_scan_id_scans_id_fk" FOREIGN KEY ("comparison_scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_attempt_id_scan_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."scan_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_result_cpes" ADD CONSTRAINT "scan_result_cpes_result_id_scan_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."scan_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_result_nuclei_matches" ADD CONSTRAINT "scan_result_nuclei_matches_run_id_scan_result_nuclei_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."scan_result_nuclei_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_result_nuclei_matches" ADD CONSTRAINT "scan_result_nuclei_matches_result_id_scan_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."scan_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_result_nuclei_runs" ADD CONSTRAINT "scan_result_nuclei_runs_result_id_scan_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."scan_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_result_technologies" ADD CONSTRAINT "scan_result_technologies_result_id_scan_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."scan_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_result_wordpress_plugins" ADD CONSTRAINT "scan_result_wordpress_plugins_result_id_scan_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."scan_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_result_wordpress_themes" ADD CONSTRAINT "scan_result_wordpress_themes_result_id_scan_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."scan_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_attempt_id_scan_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."scan_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_scan_target_id_scan_targets_id_fk" FOREIGN KEY ("scan_target_id") REFERENCES "public"."scan_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_targets" ADD CONSTRAINT "scan_targets_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_targets" ADD CONSTRAINT "scan_targets_canonical_target_id_canonical_targets_id_fk" FOREIGN KEY ("canonical_target_id") REFERENCES "public"."canonical_targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_created_by_token_id_api_tokens_id_fk" FOREIGN KEY ("created_by_token_id") REFERENCES "public"."api_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_state" ADD CONSTRAINT "user_product_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_api_tokens_token_hash" ON "api_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_auth_accounts_provider_account" ON "auth_accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_auth_accounts_user_id" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_auth_sessions_token" ON "auth_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_user_id" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auth_verifications_identifier" ON "auth_verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "idx_scan_attempts_scan_id_status" ON "scan_attempts" USING btree ("scan_id","status","attempt_number");--> statement-breakpoint
CREATE INDEX "idx_scan_events_scan_id_id" ON "scan_events" USING btree ("scan_id","id");--> statement-breakpoint
CREATE INDEX "idx_scan_result_nuclei_matches_result_id" ON "scan_result_nuclei_matches" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "idx_scan_result_nuclei_matches_run_id" ON "scan_result_nuclei_matches" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_scan_result_nuclei_matches_template_id" ON "scan_result_nuclei_matches" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scan_result_nuclei_runs_result_id" ON "scan_result_nuclei_runs" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "idx_scan_results_scan_id" ON "scan_results" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "idx_scan_results_scan_target_id" ON "scan_results" USING btree ("scan_target_id");--> statement-breakpoint
CREATE INDEX "idx_scan_results_status_code" ON "scan_results" USING btree ("status_code");--> statement-breakpoint
CREATE INDEX "idx_scan_results_final_url" ON "scan_results" USING btree ("final_url");--> statement-breakpoint
CREATE INDEX "idx_scan_results_location" ON "scan_results" USING btree ("location");--> statement-breakpoint
CREATE INDEX "idx_scan_results_host_ip" ON "scan_results" USING btree ("host_ip");--> statement-breakpoint
CREATE INDEX "idx_scan_results_server" ON "scan_results" USING btree ("web_server");--> statement-breakpoint
CREATE INDEX "idx_scan_results_cdn_name" ON "scan_results" USING btree ("cdn_name");--> statement-breakpoint
CREATE INDEX "idx_scan_results_jarm_hash" ON "scan_results" USING btree ("jarm_hash");--> statement-breakpoint
CREATE INDEX "idx_scan_results_favicon_mmh3" ON "scan_results" USING btree ("favicon_mmh3");--> statement-breakpoint
CREATE INDEX "idx_scans_submitted_at" ON "scans" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "idx_scans_status" ON "scans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scans_request_fingerprint" ON "scans" USING btree ("request_fingerprint","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scans_idempotency_key" ON "scans" USING btree ("idempotency_key") WHERE "scans"."idempotency_key" IS NOT NULL;