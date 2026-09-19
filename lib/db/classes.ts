/**
 * Class queries, scoped to the owning teacher — a teacher only ever sees
 * their own classes and sessions, never another teacher's.
 */
import { and, asc, eq } from 'drizzle-orm';
import type { SessionMode } from '@/lib/session/types';
import { getDb } from './client';
import { classes, sessions } from './schema';

export interface TeacherSessionSummary {
  id: string;
  code: string;
  mode: SessionMode;
  open: boolean;
  taskCount: number;
}

export interface TeacherClassSummary {
  id: string;
  title: string;
  roster: string[];
  sessions: TeacherSessionSummary[];
}

export interface ClassOption {
  id: string;
  title: string;
}

/** For the session builder's class picker — no roster or session join needed there. */
export async function listClassOptionsForTeacher(teacherId: string): Promise<ClassOption[]> {
  return getDb()
    .select({ id: classes.id, title: classes.title })
    .from(classes)
    .where(eq(classes.teacherId, teacherId))
    .orderBy(asc(classes.title));
}

/** Ownership check: a session builder must not create a session under a class the caller does not own. */
export async function getClassForTeacher(classId: string, teacherId: string): Promise<ClassOption | null> {
  const [row] = await getDb()
    .select({ id: classes.id, title: classes.title })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}

export async function listClassesForTeacher(teacherId: string): Promise<TeacherClassSummary[]> {
  const rows = await getDb()
    .select({
      classId: classes.id,
      classTitle: classes.title,
      roster: classes.roster,
      sessionId: sessions.id,
      sessionCode: sessions.code,
      sessionMode: sessions.mode,
      sessionClosesAt: sessions.closesAt,
      sessionTaskIds: sessions.taskIds
    })
    .from(classes)
    .leftJoin(sessions, eq(sessions.classId, classes.id))
    .where(eq(classes.teacherId, teacherId))
    .orderBy(asc(classes.title));

  const byClass = new Map<string, TeacherClassSummary>();
  for (const row of rows) {
    let entry = byClass.get(row.classId);
    if (!entry) {
      entry = { id: row.classId, title: row.classTitle, roster: row.roster, sessions: [] };
      byClass.set(row.classId, entry);
    }
    if (row.sessionId && row.sessionCode && row.sessionMode) {
      entry.sessions.push({
        id: row.sessionId,
        code: row.sessionCode,
        mode: row.sessionMode,
        open: row.sessionClosesAt === null,
        taskCount: (row.sessionTaskIds ?? []).length
      });
    }
  }
  return [...byClass.values()];
}
