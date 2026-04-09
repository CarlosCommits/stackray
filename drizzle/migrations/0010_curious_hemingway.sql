CREATE TABLE "user_product_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"completed_tours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_seen_release_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_product_state" ADD CONSTRAINT "user_product_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
