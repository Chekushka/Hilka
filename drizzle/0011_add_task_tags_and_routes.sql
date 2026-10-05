ALTER TABLE "sessions" ADD COLUMN "support_task_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "extension_task_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "student_routes" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;