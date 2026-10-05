ALTER TABLE "classes" ADD COLUMN "grade" smallint;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;