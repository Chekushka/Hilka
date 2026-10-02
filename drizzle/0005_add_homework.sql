ALTER TABLE "attempts" ADD COLUMN "device_id" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "kind" text DEFAULT 'lesson' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "improvement_task_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "due_at" timestamp with time zone;