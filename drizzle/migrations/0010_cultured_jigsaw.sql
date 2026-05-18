DROP INDEX "idx_scan_subdomains_run_host_ip_source";--> statement-breakpoint
ALTER TABLE "scan_subdomains" ADD COLUMN "ip_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_subdomains" ADD COLUMN "source_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "scan_subdomains" SET "ip_key" = lower(COALESCE("ip", '')), "source_key" = lower(COALESCE("source", ''));--> statement-breakpoint
DELETE FROM "scan_subdomains" AS existing USING "scan_subdomains" AS duplicate WHERE existing.ctid < duplicate.ctid AND existing."run_id" = duplicate."run_id" AND existing."host" = duplicate."host" AND existing."ip_key" = duplicate."ip_key" AND existing."source_key" = duplicate."source_key";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scan_subdomains_run_host_ip_source_key" ON "scan_subdomains" USING btree ("run_id","host","ip_key","source_key");
