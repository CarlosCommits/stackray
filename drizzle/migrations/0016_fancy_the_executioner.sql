CREATE TABLE "demo_scan_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_key_hash" varchar(64) NOT NULL,
	"day" varchar(10) NOT NULL,
	"scan_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_demo_scan_rate_limits_visitor_day" ON "demo_scan_rate_limits" USING btree ("visitor_key_hash","day");--> statement-breakpoint
CREATE INDEX "idx_demo_scan_rate_limits_day" ON "demo_scan_rate_limits" USING btree ("day");