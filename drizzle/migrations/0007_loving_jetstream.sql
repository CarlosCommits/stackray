CREATE TABLE "scan_schedule_run_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_run_id" uuid NOT NULL,
	"scan_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_schedule_run_scans_schedule_run_id_scan_id_unique" UNIQUE("schedule_run_id","scan_id")
);
--> statement-breakpoint
ALTER TABLE "scan_targets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "scan_targets" CASCADE;--> statement-breakpoint
ALTER TABLE "scan_results" DROP CONSTRAINT "scan_results_scan_target_id_scan_targets_id_fk";
--> statement-breakpoint
ALTER TABLE "scan_schedule_runs" DROP CONSTRAINT "scan_schedule_runs_scan_id_scans_id_fk";
--> statement-breakpoint
DROP INDEX "idx_scan_results_scan_target_id";--> statement-breakpoint
DROP INDEX "idx_scan_schedule_runs_scan_id";--> statement-breakpoint
DROP INDEX "idx_scans_schedule_slot";--> statement-breakpoint
ALTER TABLE "scan_schedule_runs" ADD COLUMN "queued_scan_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "canonical_target_id" uuid;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "input_target" text NOT NULL;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "normalized_target" text NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_schedule_run_scans" ADD CONSTRAINT "scan_schedule_run_scans_schedule_run_id_scan_schedule_runs_id_fk" FOREIGN KEY ("schedule_run_id") REFERENCES "public"."scan_schedule_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_schedule_run_scans" ADD CONSTRAINT "scan_schedule_run_scans_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scan_schedule_run_scans_scan_id" ON "scan_schedule_run_scans" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "idx_scan_schedule_run_scans_schedule_run_id_sort_order" ON "scan_schedule_run_scans" USING btree ("schedule_run_id","sort_order");--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_canonical_target_id_canonical_targets_id_fk" FOREIGN KEY ("canonical_target_id") REFERENCES "public"."canonical_targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_scans_normalized_target" ON "scans" USING btree ("normalized_target");--> statement-breakpoint
CREATE INDEX "idx_scans_schedule_slot" ON "scans" USING btree ("schedule_id","scheduled_for_at");--> statement-breakpoint
ALTER TABLE "scan_results" DROP COLUMN "scan_target_id";--> statement-breakpoint
ALTER TABLE "scan_schedule_runs" DROP COLUMN "scan_id";--> statement-breakpoint
ALTER TABLE "scans" DROP COLUMN "target_count";