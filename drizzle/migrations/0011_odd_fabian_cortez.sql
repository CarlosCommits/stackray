ALTER TABLE "instance_settings" ADD COLUMN "custom_domain_hostname" text;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "custom_domain_dns_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "custom_domain_app_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "custom_domain_last_checked_at" timestamp with time zone;
