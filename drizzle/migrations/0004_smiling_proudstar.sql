ALTER TABLE "scan_results" ADD COLUMN "screenshot_object_key" text;--> statement-breakpoint
ALTER TABLE "scan_results" ADD COLUMN "screenshot_content_type" text;--> statement-breakpoint
ALTER TABLE "scan_results" ADD COLUMN "screenshot_byte_size" bigint;--> statement-breakpoint
ALTER TABLE "scan_results" ADD COLUMN "screenshot_captured_at" timestamp with time zone;