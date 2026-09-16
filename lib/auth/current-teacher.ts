/**
 * The logged-in teacher, for a server component or route handler to check.
 * Reads the signed cookie (lib/auth/session-cookie.ts) and re-fetches the row
 * rather than trusting stale data baked into the cookie — a teacher removed
 * from the database stops working immediately, not after 30 days.
 */
import { cookies } from 'next/headers';
import { getTeacherById, type Teacher } from '@/lib/db/teachers';
import { readTeacherId, TEACHER_COOKIE_NAME } from './session-cookie';

export async function getCurrentTeacher(): Promise<Teacher | null> {
  const store = await cookies();
  const teacherId = readTeacherId(store.get(TEACHER_COOKIE_NAME)?.value);
  if (!teacherId) return null;
  return getTeacherById(teacherId);
}
