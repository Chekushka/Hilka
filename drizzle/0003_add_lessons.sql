CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"grade" smallint NOT NULL,
	"order" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"curriculum_ref" text,
	"explanation_md" text DEFAULT '' NOT NULL,
	"core_task_ids" uuid[] DEFAULT '{}' NOT NULL,
	"additional_task_ids" uuid[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "lessons_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "lessons_grade_order_idx" ON "lessons" USING btree ("grade","order");