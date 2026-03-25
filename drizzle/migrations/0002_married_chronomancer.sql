CREATE TYPE "public"."user_role" AS ENUM('admin', 'user', 'viewer');--> statement-breakpoint
ALTER TABLE "workspace_members" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspaces" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "workspace_members" CASCADE;--> statement-breakpoint
DROP TABLE "workspaces" CASCADE;--> statement-breakpoint
ALTER TABLE "canonical_targets" DROP CONSTRAINT "canonical_targets_workspace_id_normalized_target_unique";--> statement-breakpoint
ALTER TABLE "api_tokens" DROP CONSTRAINT "api_tokens_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "canonical_targets" DROP CONSTRAINT "canonical_targets_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "saved_searches" DROP CONSTRAINT "saved_searches_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "scan_comparisons" DROP CONSTRAINT "scan_comparisons_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "scans" DROP CONSTRAINT "scans_workspace_id_workspaces_id_fk";
--> statement-breakpoint
DROP INDEX "idx_scans_workspace_submitted_at";--> statement-breakpoint
DROP INDEX "idx_scans_workspace_status";--> statement-breakpoint
DROP INDEX "idx_scans_workspace_request_fingerprint";--> statement-breakpoint
DROP INDEX "idx_scans_workspace_idempotency_key";--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "impersonated_by" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ban_expires" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_scans_submitted_at" ON "scans" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "idx_scans_status" ON "scans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scans_request_fingerprint" ON "scans" USING btree ("request_fingerprint","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scans_idempotency_key" ON "scans" USING btree ("idempotency_key") WHERE "scans"."idempotency_key" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "api_tokens" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "canonical_targets" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "saved_searches" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "scan_comparisons" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "scans" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "canonical_targets" ADD CONSTRAINT "canonical_targets_normalized_target_unique" UNIQUE("normalized_target");