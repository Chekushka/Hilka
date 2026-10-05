/**
 * How queries read the student an attempt belongs to (docs/AI_CONTEXT.md,
 * "Database Schema"): by `student_id`, shown under the name the class roster
 * gives that id now — the name stored on the attempt is what it was then, and
 * stands in only for a student no longer on the roster.
 */
import { sql } from 'drizzle-orm';
import { attempts } from './schema';

/**
 * The attempt's student id. Never null once migration 0009 has run (a trigger
 * fills inserts that leave it out); the name stands in until the next
 * migration makes the column NOT NULL, so a type of `string` is honest.
 */
export const attemptStudentId = sql<string>`coalesce(${attempts.studentId}, ${attempts.studentName})`;

/** The student's current name on their class's roster, or the one stored on the attempt. */
export const attemptStudentName = sql<string>`coalesce((
  select entry->>'name'
  from sessions s
  join classes c on c.id = s.class_id
  cross join lateral jsonb_array_elements(c.students) as entry
  where s.id = ${attempts.sessionId} and entry->>'id' = ${attempts.studentId}
  limit 1
), ${attempts.studentName})`;
