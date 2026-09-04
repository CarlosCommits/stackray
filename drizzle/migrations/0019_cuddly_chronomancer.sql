CREATE TYPE "public"."alert_channel_test_status" AS ENUM('untested', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."alert_channel_type" AS ENUM('email', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."alert_delivery_status" AS ENUM('pending', 'queued', 'delivering', 'retrying', 'delivered', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."alert_event_state" AS ENUM('pending', 'delivering', 'delivered', 'partially_failed', 'failed', 'suppressed');--> statement-breakpoint
CREATE TYPE "public"."alert_policy_coverage" AS ENUM('all_targets', 'selected_targets', 'selected_schedules');--> statement-breakpoint
CREATE TYPE "public"."alert_policy_state" AS ENUM('draft', 'enabled', 'paused');--> statement-breakpoint
CREATE TYPE "public"."monitoring_baseline_mode" AS ENUM('previous', 'pinned');--> statement-breakpoint
CREATE TYPE "public"."scan_comparison_status" AS ENUM('pending', 'completed', 'failed', 'incompatible');--> statement-breakpoint
CREATE TABLE "alert_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"channel_type" "alert_channel_type" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
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
	"deleted_at" timestamp with time zone,
	CONSTRAINT "alert_channels_secret_envelope_complete" CHECK (("alert_channels"."secret_ciphertext" IS NULL AND "alert_channels"."secret_nonce" IS NULL AND "alert_channels"."secret_auth_tag" IS NULL AND "alert_channels"."encryption_algorithm" IS NULL AND "alert_channels"."encryption_key_version" IS NULL) OR ("alert_channels"."secret_ciphertext" IS NOT NULL AND "alert_channels"."secret_nonce" IS NOT NULL AND "alert_channels"."secret_auth_tag" IS NOT NULL AND "alert_channels"."encryption_algorithm" IS NOT NULL AND "alert_channels"."encryption_key_version" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "alert_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"status" "alert_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"provider_response_class" text,
	"provider_status_code" integer,
	"provider_message_id" text,
	"redacted_error" text,
	"delivered_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alert_deliveries_nonnegative_attempts" CHECK ("alert_deliveries"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"comparison_id" uuid NOT NULL,
	"event_type" text DEFAULT 'scan.changes' NOT NULL,
	"deduplication_key" text NOT NULL,
	"state" "alert_event_state" DEFAULT 'pending' NOT NULL,
	"matched_item_count" integer DEFAULT 0 NOT NULL,
	"summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"suppression_reason" text,
	"suppressed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alert_events_nonnegative_matched_items" CHECK ("alert_events"."matched_item_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "alert_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"state" "alert_policy_state" DEFAULT 'draft' NOT NULL,
	"coverage" "alert_policy_coverage" DEFAULT 'all_targets' NOT NULL,
	"conditions_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"conditions_schema_version" integer DEFAULT 1 NOT NULL,
	"cooldown_seconds" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "alert_policies_nonnegative_cooldown" CHECK ("alert_policies"."cooldown_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "alert_policy_channels" (
	"policy_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_policy_schedules" (
	"policy_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_policy_targets" (
	"policy_id" uuid NOT NULL,
	"canonical_target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_change_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comparison_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"endpoint_identity" text,
	"baseline_result_id" uuid,
	"current_result_id" uuid,
	"category" text NOT NULL,
	"change_type" text NOT NULL,
	"field_path" text,
	"severity" text NOT NULL,
	"confidence" text DEFAULT 'high' NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"summary" text NOT NULL,
	"summary_args_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"alert_eligible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "target_monitoring_baseline_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"canonical_target_id" uuid NOT NULL,
	"previous_mode" "monitoring_baseline_mode" NOT NULL,
	"previous_pinned_scan_id" uuid,
	"new_mode" "monitoring_baseline_mode" NOT NULL,
	"new_pinned_scan_id" uuid,
	"changed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "target_monitoring_settings" (
	"canonical_target_id" uuid PRIMARY KEY NOT NULL,
	"baseline_mode" "monitoring_baseline_mode" DEFAULT 'previous' NOT NULL,
	"pinned_baseline_scan_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_user_id" uuid,
	CONSTRAINT "target_monitoring_settings_baseline_consistency" CHECK (("target_monitoring_settings"."baseline_mode" = 'previous' AND "target_monitoring_settings"."pinned_baseline_scan_id" IS NULL) OR ("target_monitoring_settings"."baseline_mode" = 'pinned' AND "target_monitoring_settings"."pinned_baseline_scan_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "scan_comparisons" DROP CONSTRAINT "scan_comparisons_baseline_scan_id_comparison_scan_id_unique";--> statement-breakpoint
DROP INDEX "idx_scans_idempotency_key";--> statement-breakpoint
ALTER TABLE "scan_comparisons" ALTER COLUMN "diff_json" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD COLUMN "canonical_target_id" uuid;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD COLUMN "comparison_signature" text;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD COLUMN "algorithm_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD COLUMN "status" "scan_comparison_status" DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD COLUMN "change_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD COLUMN "alert_eligible_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD COLUMN "important_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD COLUMN "informational_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD COLUMN "severity_counts_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD COLUMN "category_counts_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD COLUMN "failure_code" text;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD COLUMN "failure_message" text;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD COLUMN "failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_channels" ADD CONSTRAINT "alert_channels_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_channels" ADD CONSTRAINT "alert_channels_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_event_id_alert_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."alert_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_channel_id_alert_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."alert_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_policy_id_alert_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."alert_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_comparison_id_scan_comparisons_id_fk" FOREIGN KEY ("comparison_id") REFERENCES "public"."scan_comparisons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_policies" ADD CONSTRAINT "alert_policies_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_policies" ADD CONSTRAINT "alert_policies_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_policy_channels" ADD CONSTRAINT "alert_policy_channels_policy_id_alert_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."alert_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_policy_channels" ADD CONSTRAINT "alert_policy_channels_channel_id_alert_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."alert_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_policy_schedules" ADD CONSTRAINT "alert_policy_schedules_policy_id_alert_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."alert_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_policy_schedules" ADD CONSTRAINT "alert_policy_schedules_schedule_id_scan_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."scan_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_policy_targets" ADD CONSTRAINT "alert_policy_targets_policy_id_alert_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."alert_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_policy_targets" ADD CONSTRAINT "alert_policy_targets_canonical_target_id_canonical_targets_id_fk" FOREIGN KEY ("canonical_target_id") REFERENCES "public"."canonical_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_change_items" ADD CONSTRAINT "scan_change_items_comparison_id_scan_comparisons_id_fk" FOREIGN KEY ("comparison_id") REFERENCES "public"."scan_comparisons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_change_items" ADD CONSTRAINT "scan_change_items_baseline_result_id_scan_results_id_fk" FOREIGN KEY ("baseline_result_id") REFERENCES "public"."scan_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_change_items" ADD CONSTRAINT "scan_change_items_current_result_id_scan_results_id_fk" FOREIGN KEY ("current_result_id") REFERENCES "public"."scan_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_monitoring_baseline_events" ADD CONSTRAINT "target_monitoring_baseline_events_canonical_target_id_canonical_targets_id_fk" FOREIGN KEY ("canonical_target_id") REFERENCES "public"."canonical_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_monitoring_baseline_events" ADD CONSTRAINT "target_monitoring_baseline_events_previous_pinned_scan_id_scans_id_fk" FOREIGN KEY ("previous_pinned_scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_monitoring_baseline_events" ADD CONSTRAINT "target_monitoring_baseline_events_new_pinned_scan_id_scans_id_fk" FOREIGN KEY ("new_pinned_scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_monitoring_baseline_events" ADD CONSTRAINT "target_monitoring_baseline_events_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_monitoring_settings" ADD CONSTRAINT "target_monitoring_settings_canonical_target_id_canonical_targets_id_fk" FOREIGN KEY ("canonical_target_id") REFERENCES "public"."canonical_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_monitoring_settings" ADD CONSTRAINT "target_monitoring_settings_pinned_baseline_scan_id_scans_id_fk" FOREIGN KEY ("pinned_baseline_scan_id") REFERENCES "public"."scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_monitoring_settings" ADD CONSTRAINT "target_monitoring_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_alert_channels_type_enabled" ON "alert_channels" USING btree ("channel_type","enabled");--> statement-breakpoint
CREATE INDEX "idx_alert_channels_deleted_at" ON "alert_channels" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_alert_deliveries_event_channel" ON "alert_deliveries" USING btree ("event_id","channel_id");--> statement-breakpoint
CREATE INDEX "idx_alert_deliveries_status_next_attempt" ON "alert_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "idx_alert_deliveries_channel_created_at" ON "alert_deliveries" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_alert_events_deduplication_key" ON "alert_events" USING btree ("deduplication_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_alert_events_policy_comparison_type" ON "alert_events" USING btree ("policy_id","comparison_id","event_type");--> statement-breakpoint
CREATE INDEX "idx_alert_events_state_created_at" ON "alert_events" USING btree ("state","created_at");--> statement-breakpoint
CREATE INDEX "idx_alert_events_comparison_id" ON "alert_events" USING btree ("comparison_id");--> statement-breakpoint
CREATE INDEX "idx_alert_policies_state_deleted_at" ON "alert_policies" USING btree ("state","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_alert_policy_channels_policy_channel" ON "alert_policy_channels" USING btree ("policy_id","channel_id");--> statement-breakpoint
CREATE INDEX "idx_alert_policy_channels_channel_id" ON "alert_policy_channels" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_alert_policy_schedules_policy_schedule" ON "alert_policy_schedules" USING btree ("policy_id","schedule_id");--> statement-breakpoint
CREATE INDEX "idx_alert_policy_schedules_schedule_id" ON "alert_policy_schedules" USING btree ("schedule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_alert_policy_targets_policy_target" ON "alert_policy_targets" USING btree ("policy_id","canonical_target_id");--> statement-breakpoint
CREATE INDEX "idx_alert_policy_targets_target_id" ON "alert_policy_targets" USING btree ("canonical_target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scan_change_items_comparison_item_key" ON "scan_change_items" USING btree ("comparison_id","item_key");--> statement-breakpoint
CREATE INDEX "idx_scan_change_items_comparison_severity" ON "scan_change_items" USING btree ("comparison_id","severity");--> statement-breakpoint
CREATE INDEX "idx_scan_change_items_comparison_category" ON "scan_change_items" USING btree ("comparison_id","category");--> statement-breakpoint
CREATE INDEX "idx_scan_change_items_current_result_id" ON "scan_change_items" USING btree ("current_result_id");--> statement-breakpoint
CREATE INDEX "idx_scan_change_items_baseline_result_id" ON "scan_change_items" USING btree ("baseline_result_id");--> statement-breakpoint
CREATE INDEX "idx_target_monitoring_baseline_events_target_id" ON "target_monitoring_baseline_events" USING btree ("canonical_target_id","id");--> statement-breakpoint
CREATE INDEX "idx_target_monitoring_settings_pinned_scan" ON "target_monitoring_settings" USING btree ("pinned_baseline_scan_id");--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD CONSTRAINT "scan_comparisons_canonical_target_id_canonical_targets_id_fk" FOREIGN KEY ("canonical_target_id") REFERENCES "public"."canonical_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scan_comparisons_pair_algorithm" ON "scan_comparisons" USING btree ("comparison_scan_id","baseline_scan_id","algorithm_version");--> statement-breakpoint
CREATE INDEX "idx_scan_comparisons_current_scan_status" ON "scan_comparisons" USING btree ("comparison_scan_id","status");--> statement-breakpoint
CREATE INDEX "idx_scan_comparisons_target_created_at" ON "scan_comparisons" USING btree ("canonical_target_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scans_idempotency_key" ON "scans" USING btree ("idempotency_key") WHERE "scans"."idempotency_key" is not null;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD CONSTRAINT "scan_comparisons_distinct_scans" CHECK ("scan_comparisons"."comparison_scan_id" <> "scan_comparisons"."baseline_scan_id");--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD CONSTRAINT "scan_comparisons_nonnegative_counts" CHECK ("scan_comparisons"."change_count" >= 0 AND "scan_comparisons"."alert_eligible_count" >= 0 AND "scan_comparisons"."important_count" >= 0 AND "scan_comparisons"."informational_count" >= 0);