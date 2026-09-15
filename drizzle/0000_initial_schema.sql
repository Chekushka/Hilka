CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"student_name" text NOT NULL,
	"task_id" uuid NOT NULL,
	"task_version" integer NOT NULL,
	"seed" bigint,
	"submitted_answer" jsonb,
	"passed" boolean NOT NULL,
	"score" numeric,
	"hints_used" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"flags" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"title" text NOT NULL,
	"roster" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_codes" (
	"code" char(8) PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"code" char(6) NOT NULL,
	"mode" text NOT NULL,
	"task_ids" uuid[] DEFAULT '{}' NOT NULL,
	"time_limit_s" integer,
	"hints_enabled" boolean DEFAULT true NOT NULL,
	"shuffle" boolean DEFAULT false NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"topic_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"payload" jsonb NOT NULL,
	"checks" jsonb NOT NULL,
	"cases" jsonb,
	"reference" jsonb,
	"hints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"params" jsonb,
	"difficulty" smallint NOT NULL,
	"grade_tags" integer[] DEFAULT '{}' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "tasks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'teacher' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teachers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"order" integer NOT NULL,
	"grade_tags" integer[] DEFAULT '{}' NOT NULL,
	"curriculum_ref" text,
	"theory_md" text,
	CONSTRAINT "topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_session_idx" ON "attempts" USING btree ("session_id","student_name");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_open_code_idx" ON "sessions" USING btree ("code") WHERE "sessions"."closes_at" is null;--> statement-breakpoint
CREATE INDEX "tasks_topic_idx" ON "tasks" USING btree ("topic_id","difficulty");