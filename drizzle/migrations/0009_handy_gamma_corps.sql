CREATE TABLE "instance_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"canonical_base_url" text,
	"setup_completed_at" timestamp with time zone,
	"setup_completed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instance_settings" ADD CONSTRAINT "instance_settings_setup_completed_by_user_id_users_id_fk" FOREIGN KEY ("setup_completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
