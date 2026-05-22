CREATE TABLE "ip_enrichments" (
	"ip" varchar(64) PRIMARY KEY NOT NULL,
	"provider_name" text,
	"provider_source" text,
	"rdap_json" jsonb,
	"bgp_json" jsonb,
	"ptr_json" jsonb,
	"reverse_ip_json" jsonb,
	"error_json" jsonb,
	"refreshed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_ip_enrichments_provider_name" ON "ip_enrichments" USING btree ("provider_name");--> statement-breakpoint
CREATE INDEX "idx_ip_enrichments_refreshed_at" ON "ip_enrichments" USING btree ("refreshed_at");