-- Students get ids (docs/AI_CONTEXT.md, "Database Schema"). Step 1 of 2:
-- add and backfill, drop nothing. Code from before this migration may still
-- be running while it applies (migrate.yml and the Vercel deploy race), so
-- two temporary triggers keep that code working: an attempt it inserts gets
-- its student_id, and a roster it writes is mirrored into `students`. The
-- next migration drops the triggers and `classes.roster`, and makes
-- `attempts.student_id` NOT NULL.
ALTER TABLE "classes" ADD COLUMN "students" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Every name on a roster today keeps seeding its variants and pools from the
-- name (`seed`), so nobody's tasks change mid-homework.
UPDATE "classes" SET "students" = coalesce((
  SELECT jsonb_agg(
    jsonb_build_object('id', substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), 'name', r.name, 'seed', r.name)
    ORDER BY r.ord)
  FROM unnest("classes"."roster") WITH ORDINALITY AS r(name, ord)
), '[]'::jsonb);--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "student_id" text;--> statement-breakpoint
UPDATE "attempts" SET "student_id" = (
  SELECT e.value->>'id'
  FROM "sessions" s
  JOIN "classes" c ON c.id = s.class_id
  CROSS JOIN LATERAL jsonb_array_elements(c.students) WITH ORDINALITY AS e(value, ord)
  WHERE s.id = "attempts"."session_id" AND e.value->>'name' = "attempts"."student_name"
  ORDER BY e.ord
  LIMIT 1
);--> statement-breakpoint
-- A name no longer on its roster still has a history: one id per class and
-- name, kept off the roster.
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
DROP INDEX "attempts_session_idx";--> statement-breakpoint
CREATE INDEX "attempts_session_student_idx" ON "attempts" USING btree ("session_id","student_id");--> statement-breakpoint
CREATE FUNCTION "hilka_0009_attempt_student_id"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.student_id IS NULL THEN
    NEW.student_id := (
      SELECT e.value->>'id'
      FROM sessions s
      JOIN classes c ON c.id = s.class_id
      CROSS JOIN LATERAL jsonb_array_elements(c.students) AS e(value)
      WHERE s.id = NEW.session_id AND e.value->>'name' = NEW.student_name
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "hilka_0009_attempt_student_id" BEFORE INSERT ON "attempts"
  FOR EACH ROW EXECUTE FUNCTION "hilka_0009_attempt_student_id"();--> statement-breakpoint
CREATE FUNCTION "hilka_0009_class_students"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Only a write that set the roster and left `students` alone: old code.
  IF (TG_OP = 'INSERT' AND NEW.students = '[]'::jsonb AND cardinality(NEW.roster) > 0)
     OR (TG_OP = 'UPDATE' AND NEW.roster IS DISTINCT FROM OLD.roster AND NEW.students IS NOT DISTINCT FROM OLD.students) THEN
    NEW.students := coalesce((
      SELECT jsonb_agg(
        coalesce(
          (SELECT p.value FROM jsonb_array_elements(CASE WHEN TG_OP = 'UPDATE' THEN OLD.students ELSE '[]'::jsonb END) AS p(value)
           WHERE p.value->>'name' = r.name LIMIT 1),
          jsonb_build_object('id', substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), 'name', r.name)
        ) ORDER BY r.ord)
      FROM unnest(NEW.roster) WITH ORDINALITY AS r(name, ord)
    ), '[]'::jsonb);
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "hilka_0009_class_students" BEFORE INSERT OR UPDATE ON "classes"
  FOR EACH ROW EXECUTE FUNCTION "hilka_0009_class_students"();
