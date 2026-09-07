ALTER TABLE "scan_comparisons" DROP CONSTRAINT "scan_comparisons_nonnegative_counts";--> statement-breakpoint
DROP INDEX "idx_scan_change_items_comparison_severity";--> statement-breakpoint
ALTER TABLE "alert_policies" ALTER COLUMN "conditions_schema_version" SET DEFAULT 2;--> statement-breakpoint
ALTER TABLE "scan_change_items" DROP COLUMN "severity";--> statement-breakpoint
ALTER TABLE "scan_comparisons" DROP COLUMN "important_count";--> statement-breakpoint
ALTER TABLE "scan_comparisons" DROP COLUMN "informational_count";--> statement-breakpoint
ALTER TABLE "scan_comparisons" DROP COLUMN "severity_counts_json";--> statement-breakpoint
ALTER TABLE "scan_comparisons" ADD CONSTRAINT "scan_comparisons_nonnegative_counts" CHECK ("scan_comparisons"."change_count" >= 0 AND "scan_comparisons"."alert_eligible_count" >= 0);