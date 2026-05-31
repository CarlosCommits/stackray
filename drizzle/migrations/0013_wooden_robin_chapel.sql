CREATE TYPE "public"."scan_phase_kind" AS ENUM('http_probe', 'headless', 'subfinder', 'nuclei_dns', 'nuclei_http', 'ip_intel', 'finalize');--> statement-breakpoint
CREATE TYPE "public"."scan_phase_status" AS ENUM('queued', 'running', 'completed', 'failed', 'skipped', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."scan_event_type" ADD VALUE 'scan.phase' BEFORE 'scan.progress';--> statement-breakpoint
CREATE TABLE "scan_phase_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"result_id" uuid,
	"phase" "scan_phase_kind" NOT NULL,
	"status" "scan_phase_status" NOT NULL,
	"worker_id" text,
	"job_key" text,
	"error_code" text,
	"error_message" text,
	"meta_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scan_phase_runs" ADD CONSTRAINT "scan_phase_runs_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_phase_runs" ADD CONSTRAINT "scan_phase_runs_attempt_id_scan_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."scan_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_phase_runs" ADD CONSTRAINT "scan_phase_runs_result_id_scan_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."scan_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scan_phase_runs_attempt_id_phase" ON "scan_phase_runs" USING btree ("attempt_id","phase");--> statement-breakpoint
CREATE INDEX "idx_scan_phase_runs_scan_id" ON "scan_phase_runs" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "idx_scan_phase_runs_status" ON "scan_phase_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scan_phase_runs_phase_status" ON "scan_phase_runs" USING btree ("phase","status");