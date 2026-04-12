CREATE TYPE "public"."scan_schedule_frequency" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."scan_schedule_run_status" AS ENUM('queued', 'skipped', 'failed');--> statement-breakpoint
CREATE TABLE "scan_schedule_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"scan_id" uuid,
	"status" "scan_schedule_run_status" NOT NULL,
	"scheduled_for_at" timestamp with time zone NOT NULL,
	"queued_at" timestamp with time zone,
	"skip_reason" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_schedule_runs_schedule_id_scheduled_for_at_unique" UNIQUE("schedule_id","scheduled_for_at")
);
--> statement-breakpoint
CREATE TABLE "scan_schedule_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"canonical_target_id" uuid,
	"input_target" text NOT NULL,
	"normalized_target" text NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_schedule_targets_schedule_id_normalized_target_unique" UNIQUE("schedule_id","normalized_target")
);
--> statement-breakpoint
CREATE TABLE "scan_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"frequency" "scan_schedule_frequency" NOT NULL,
	"hour" integer NOT NULL,
	"minute" integer NOT NULL,
	"weekday" integer,
	"day_of_month" integer,
	"timezone" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"options_json" jsonb NOT NULL,
	"target_count" integer DEFAULT 0 NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "schedule_id" uuid;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "scheduled_for_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scan_schedule_runs" ADD CONSTRAINT "scan_schedule_runs_schedule_id_scan_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."scan_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_schedule_runs" ADD CONSTRAINT "scan_schedule_runs_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_schedule_targets" ADD CONSTRAINT "scan_schedule_targets_schedule_id_scan_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."scan_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_schedule_targets" ADD CONSTRAINT "scan_schedule_targets_canonical_target_id_canonical_targets_id_fk" FOREIGN KEY ("canonical_target_id") REFERENCES "public"."canonical_targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_schedules" ADD CONSTRAINT "scan_schedules_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scan_schedule_runs_scan_id" ON "scan_schedule_runs" USING btree ("scan_id") WHERE "scan_schedule_runs"."scan_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_scan_schedule_runs_schedule_id_created_at" ON "scan_schedule_runs" USING btree ("schedule_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_scan_schedule_runs_schedule_id_scheduled_for_at" ON "scan_schedule_runs" USING btree ("schedule_id","scheduled_for_at");--> statement-breakpoint
CREATE INDEX "idx_scan_schedules_created_by_user_id" ON "scan_schedules" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_scan_schedules_enabled_next_run_at" ON "scan_schedules" USING btree ("enabled","next_run_at");--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_schedule_id_scan_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."scan_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_scans_schedule_id" ON "scans" USING btree ("schedule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scans_schedule_slot" ON "scans" USING btree ("schedule_id","scheduled_for_at") WHERE "scans"."schedule_id" IS NOT NULL AND "scans"."scheduled_for_at" IS NOT NULL;