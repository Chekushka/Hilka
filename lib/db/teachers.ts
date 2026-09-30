/**
 * Teacher queries. A teacher asks for access at /signup (a `pending` row)
 * or is added by the superuser; only the superuser makes one `active`
 * (docs/AI_CONTEXT.md, "Teacher Auth"). Magic-link login only ever looks
 * an active email up, never creates one. Emails arrive normalized
 * (lib/auth/email.ts).
 */
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from './client';
import { teachers, type TeacherStatus } from './schema';

export type { TeacherStatus };

export interface Teacher {
  id: string;
  email: string;
  role: 'teacher' | 'admin';
  status: TeacherStatus;
}

export interface TeacherListRow extends Teacher {
  createdAt: string;
}

const columns = { id: teachers.id, email: teachers.email, role: teachers.role, status: teachers.status };

export async function getTeacherByEmail(email: string): Promise<Teacher | null> {
  const [row] = await getDb().select(columns).from(teachers).where(eq(teachers.email, email)).limit(1);
  return row ?? null;
}

export async function getTeacherById(id: string): Promise<Teacher | null> {
  const [row] = await getDb().select(columns).from(teachers).where(eq(teachers.id, id)).limit(1);
  return row ?? null;
}

/** Everyone, oldest first — the superuser's page groups them by status. */
export async function listTeachers(): Promise<TeacherListRow[]> {
  const rows = await getDb()
    .select({ ...columns, createdAt: teachers.createdAt })
    .from(teachers)
    .orderBy(asc(teachers.createdAt));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

/**
 * A sign-up: a pending row for a new address, nothing at all for a known one
 * — whatever its status, asking again never changes it, so a disabled
 * teacher cannot re-queue themselves and nobody learns what exists.
 * `created` is for the caller's notification only, never for the response.
 */
export async function requestTeacherAccess(email: string): Promise<{ created: boolean }> {
  const rows = await getDb()
    .insert(teachers)
    .values({ email, status: 'pending' })
    .onConflictDoNothing({ target: teachers.email })
    .returning({ id: teachers.id });
  return { created: rows.length > 0 };
}

/** The superuser adds an address directly: active at once, a pending or disabled one included. */
export async function addActiveTeacher(email: string): Promise<Teacher> {
  const [row] = await getDb()
    .insert(teachers)
    .values({ email, status: 'active' })
    .onConflictDoUpdate({ target: teachers.email, set: { status: 'active' } })
    .returning(columns);
  return row;
}

/** Approve, disable or re-enable. Null when there is no such teacher. */
export async function setTeacherStatus(id: string, status: TeacherStatus): Promise<Teacher | null> {
  const [row] = await getDb().update(teachers).set({ status }).where(eq(teachers.id, id)).returning(columns);
  return row ?? null;
}

/**
 * Rejecting a request deletes it, so the address can ask again later. Only a
 * pending row: an active or disabled teacher owns classes and sessions, and
 * is disabled rather than deleted. False when nothing pending matched.
 */
export async function deletePendingTeacher(id: string): Promise<boolean> {
  const rows = await getDb()
    .delete(teachers)
    .where(and(eq(teachers.id, id), eq(teachers.status, 'pending')))
    .returning({ id: teachers.id });
  return rows.length > 0;
}
