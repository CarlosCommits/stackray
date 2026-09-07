UPDATE "scan_comparisons"
SET "status" = 'failed',
    "failure_code" = COALESCE("failure_code", 'comparison_incompatible'),
    "failure_message" = COALESCE("failure_message", 'Legacy incompatible comparison')
WHERE "status" = 'incompatible';--> statement-breakpoint
DROP INDEX "idx_scan_comparisons_feed_current_scan";--> statement-breakpoint
ALTER TABLE "scan_comparisons" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "scan_comparisons" ALTER COLUMN "status" SET DEFAULT 'completed'::text;--> statement-breakpoint
DROP TYPE "public"."scan_comparison_status";--> statement-breakpoint
CREATE TYPE "public"."scan_comparison_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "scan_comparisons" ALTER COLUMN "status" SET DEFAULT 'completed'::"public"."scan_comparison_status";--> statement-breakpoint
ALTER TABLE "scan_comparisons" ALTER COLUMN "status" SET DATA TYPE "public"."scan_comparison_status" USING "status"::"public"."scan_comparison_status";--> statement-breakpoint
ALTER TABLE "scan_comparisons" DROP COLUMN "comparison_signature";--> statement-breakpoint
CREATE INDEX "idx_scan_comparisons_feed_current_scan" ON "scan_comparisons" USING btree ("comparison_scan_id","id") WHERE "scan_comparisons"."status" = 'completed';
