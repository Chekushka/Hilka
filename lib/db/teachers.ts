/**
 * Teacher queries. Teachers are provisioned directly in the database for now
 * — there is no self-signup, and magic-link login only ever looks an email
 * up, never creates one.
 */
import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { teachers } from './schema';

export interface Teacher {
  id: string;
  email: string;
  role: 'teacher' | 'admin';
}

export async function getTeacherByEmail(email: string): Promise<Teacher | null> {
  const [row] = await getDb()
    .select({ id: teachers.id, email: teachers.email, role: teachers.role })
    .from(teachers)
    .where(eq(teachers.email, email))
    .limit(1);
  return row ?? null;
}

export async function getTeacherById(id: string): Promise<Teacher | null> {
  const [row] = await getDb()
    .select({ id: teachers.id, email: teachers.email, role: teachers.role })
    .from(teachers)
    .where(eq(teachers.id, id))
    .limit(1);
  return row ?? null;
}
