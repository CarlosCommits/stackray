ALTER TABLE "scan_result_nuclei_matches" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "scan_result_nuclei_matches" ADD COLUMN "subject_type" text;--> statement-breakpoint
ALTER TABLE "scan_result_nuclei_runs" ADD COLUMN "domain_target" text;