/**
 * The body of a class create or edit request: a title, a grade or none, and
 * the students — checked here as far as they can be without the class's
 * stored roster, which `readStudents` then checks them against
 * (lib/classes/roster.ts). Pure, so both class routes read a request the
 * same way.
 */
import { cleanGrade, cleanStudents, type RosterStudent } from './roster';

export const MAX_TITLE_LENGTH = 80;

export interface ClassBody {
  title: string;
  grade: number | null;
  /** `{ id?, name }[]`, unchecked until compared with what is stored. */
  students: unknown;
}

export function parseClassBody(body: unknown): ClassBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.title !== 'string') return null;
  const title = b.title.trim();
  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) return null;
  const grade = cleanGrade(b.grade);
  if (grade === undefined) return null;
  return { title, grade, students: b.students };
}

/** The class's students after this save, or null when the body's list is not acceptable. */
export function readStudents(
  body: ClassBody,
  stored: readonly RosterStudent[],
  newId?: () => string
): RosterStudent[] | null {
  return cleanStudents(body.students, stored, newId);
}
