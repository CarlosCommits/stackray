CREATE TYPE "public"."scan_result_detection_kind" AS ENUM('technology', 'wordpress_plugin', 'wordpress_theme', 'cpe');--> statement-breakpoint
CREATE TABLE "scan_result_detections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"kind" "scan_result_detection_kind" NOT NULL,
	"name" text NOT NULL,
	"version" text,
	"source" "technology_source" NOT NULL,
	"slug" text,
	"vendor" text,
	"product" text,
	"cpe" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "scan_result_cpes" CASCADE;--> statement-breakpoint
DROP TABLE "scan_result_technologies" CASCADE;--> statement-breakpoint
DROP TABLE "scan_result_wordpress_plugins" CASCADE;--> statement-breakpoint
DROP TABLE "scan_result_wordpress_themes" CASCADE;--> statement-breakpoint
ALTER TABLE "scan_result_detections" ADD CONSTRAINT "scan_result_detections_result_id_scan_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."scan_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_scan_result_detections_result_id" ON "scan_result_detections" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "idx_scan_result_detections_result_id_kind" ON "scan_result_detections" USING btree ("result_id","kind");--> statement-breakpoint
CREATE INDEX "idx_scan_result_detections_kind_name" ON "scan_result_detections" USING btree ("kind","name");