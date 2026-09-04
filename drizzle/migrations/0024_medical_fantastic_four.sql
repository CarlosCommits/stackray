CREATE INDEX "idx_scan_comparisons_feed_current_scan" ON "scan_comparisons" USING btree ("comparison_scan_id","id") WHERE "scan_comparisons"."status" = 'completed';--> statement-breakpoint
CREATE INDEX "idx_scans_completed_at_id" ON "scans" USING btree ("completed_at","id");
