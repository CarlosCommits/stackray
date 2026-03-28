CREATE TYPE "public"."scan_result_nuclei_run_status" AS ENUM('pending', 'running', 'completed', 'failed', 'skipped');--> statement-breakpoint
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
ALTER TABLE "scan_result_nuclei_matches" ADD CONSTRAINT "scan_result_nuclei_matches_run_id_scan_result_nuclei_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."scan_result_nuclei_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_result_nuclei_matches" ADD CONSTRAINT "scan_result_nuclei_matches_result_id_scan_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."scan_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_result_nuclei_runs" ADD CONSTRAINT "scan_result_nuclei_runs_result_id_scan_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."scan_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_scan_result_nuclei_matches_result_id" ON "scan_result_nuclei_matches" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "idx_scan_result_nuclei_matches_run_id" ON "scan_result_nuclei_matches" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_scan_result_nuclei_matches_template_id" ON "scan_result_nuclei_matches" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scan_result_nuclei_runs_result_id" ON "scan_result_nuclei_runs" USING btree ("result_id");
