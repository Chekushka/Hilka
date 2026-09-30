/**
 * The logged-in teacher, for a server component or route handler to check.
 * Reads the signed cookie (lib/auth/session-cookie.ts) and re-fetches the row
 * rather than trusting stale data baked into the cookie — a teacher removed
 * from the database, or no longer `active` (disabled by the superuser), stops
 * working on the next request, not after 30 days.
 */
import { cookies } from 'next/headers';
import { cache } from 'react';
import { getTeacherById, type Teacher } from '@/lib/db/teachers';
import { readTeacherId, TEACHER_COOKIE_NAME } from './session-cookie';

// Memoized per request: the teacher layout and the page below it both ask.
export const getCurrentTeacher = cache(async (): Promise<Teacher | null> => {
  const store = await cookies();
  const teacherId = readTeacherId(store.get(TEACHER_COOKIE_NAME)?.value);
  if (!teacherId) return null;
  const teacher = await getTeacherById(teacherId);
  return teacher?.status === 'active' ? teacher : null;
});
