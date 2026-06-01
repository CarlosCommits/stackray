CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE INDEX "idx_scan_result_detections_name_trgm" ON "scan_result_detections" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_scan_result_detections_slug_trgm" ON "scan_result_detections" USING gin ("slug" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_scan_result_detections_vendor_trgm" ON "scan_result_detections" USING gin ("vendor" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_scan_result_detections_product_trgm" ON "scan_result_detections" USING gin ("product" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_scan_result_detections_cpe_trgm" ON "scan_result_detections" USING gin ("cpe" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_scan_results_search_document_trgm" ON "scan_results" USING gin ("search_document" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_scan_results_input_trgm" ON "scan_results" USING gin ("input" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_scan_results_url_trgm" ON "scan_results" USING gin ("url" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_scan_results_final_url_trgm" ON "scan_results" USING gin ("final_url" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_scan_results_host_trgm" ON "scan_results" USING gin ("host" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_scan_results_title_trgm" ON "scan_results" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_scan_results_server_trgm" ON "scan_results" USING gin ("web_server" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_scan_results_cdn_name_trgm" ON "scan_results" USING gin ("cdn_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_scans_input_target_trgm" ON "scans" USING gin ("input_target" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_scans_normalized_target_trgm" ON "scans" USING gin ("normalized_target" gin_trgm_ops);