CREATE TABLE "instance_runtime_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"public_origin" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instance_runtime_settings_singleton" CHECK ("instance_runtime_settings"."id" = 'default')
);
