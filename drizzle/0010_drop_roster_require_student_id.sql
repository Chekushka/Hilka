-- Students get ids, step 2 of 2 (step 1: 0009). Applied once step 1 has run
-- in production long enough that no code from before it is still serving and
-- no open page still holds a name in place of an id. Removes what only that
-- old code needed: the two triggers and `classes.roster`, and makes
-- `attempts.student_id` required.
--
-- First, the same backfill as 0009, for any attempt that still lacks an id:
-- by its name on its class's roster, else one id per class and name.
UPDATE "attempts" SET "student_id" = (
  SELECT e.value->>'id'
  FROM "sessions" s
  JOIN "classes" c ON c.id = s.class_id
  CROSS JOIN LATERAL jsonb_array_elements(c.students) WITH ORDINALITY AS e(value, ord)
  WHERE s.id = "attempts"."session_id" AND e.value->>'name' = "attempts"."student_name"
  ORDER BY e.ord
  LIMIT 1
)
WHERE "student_id" IS NULL;--> statement-breakpoint
WITH "orphans" AS (
  SELECT DISTINCT s.class_id, a.student_name
  FROM "attempts" a JOIN "sessions" s ON s.id = a.session_id
  WHERE a.student_id IS NULL
), "minted" AS (
  SELECT class_id, student_name, substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) AS id FROM "orphans"
)
UPDATE "attempts" a SET "student_id" = m.id
FROM "sessions" s, "minted" m
WHERE a.student_id IS NULL AND s.id = a.session_id AND m.class_id = s.class_id AND m.student_name = a.student_name;--> statement-breakpoint
DROP TRIGGER IF EXISTS "hilka_0009_attempt_student_id" ON "attempts";--> statement-breakpoint
DROP FUNCTION IF EXISTS "hilka_0009_attempt_student_id"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "hilka_0009_class_students" ON "classes";--> statement-breakpoint
DROP FUNCTION IF EXISTS "hilka_0009_class_students"();--> statement-breakpoint
ALTER TABLE "attempts" ALTER COLUMN "student_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" DROP COLUMN "roster";
