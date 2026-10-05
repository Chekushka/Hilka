/**
 * The body of a class create or edit request, checked: a title, a grade or
 * none, and a roster (lib/classes/roster.ts). Pure, so both class routes read
 * a request the same way.
 */
import { cleanGrade, cleanRoster } from './roster';

export const MAX_TITLE_LENGTH = 80;

export interface ClassBody {
  title: string;
  grade: number | null;
  roster: string[];
  /** Unchecked here: a rename can only be checked against the roster stored before it. */
  renames: unknown;
}

export function parseClassBody(body: unknown): ClassBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.title !== 'string') return null;
  const title = b.title.trim();
  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) return null;
  const grade = cleanGrade(b.grade);
  if (grade === undefined) return null;
  const roster = cleanRoster(b.roster);
  if (!roster) return null;
  return { title, grade, roster, renames: b.renames };
}
