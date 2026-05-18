CREATE TYPE "public"."scan_subdomain_discovery_run_status" AS ENUM('pending', 'running', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "scan_subdomain_discovery_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"status" "scan_subdomain_discovery_run_status" NOT NULL,
	"target_domain" text,
	"engine_version" text,
	"error_message" text,
	"result_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_subdomains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"root_domain" text NOT NULL,
	"host" text NOT NULL,
	"ip" varchar(64),
	"source" text,
	"wildcard_certificate" boolean DEFAULT false NOT NULL,
	"raw_json" jsonb NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scan_subdomain_discovery_runs" ADD CONSTRAINT "scan_subdomain_discovery_runs_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_subdomain_discovery_runs" ADD CONSTRAINT "scan_subdomain_discovery_runs_attempt_id_scan_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."scan_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_subdomains" ADD CONSTRAINT "scan_subdomains_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_subdomains" ADD CONSTRAINT "scan_subdomains_attempt_id_scan_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."scan_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_subdomains" ADD CONSTRAINT "scan_subdomains_run_id_scan_subdomain_discovery_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."scan_subdomain_discovery_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scan_subdomain_discovery_runs_attempt_id" ON "scan_subdomain_discovery_runs" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "idx_scan_subdomain_discovery_runs_scan_id" ON "scan_subdomain_discovery_runs" USING btree ("scan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scan_subdomains_run_host_ip_source" ON "scan_subdomains" USING btree ("run_id","host","ip","source");--> statement-breakpoint
CREATE INDEX "idx_scan_subdomains_scan_id" ON "scan_subdomains" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "idx_scan_subdomains_run_id" ON "scan_subdomains" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_scan_subdomains_root_domain" ON "scan_subdomains" USING btree ("root_domain");--> statement-breakpoint
CREATE INDEX "idx_scan_subdomains_host" ON "scan_subdomains" USING btree ("host");