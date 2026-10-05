/**
 * Class queries, scoped to the owning teacher — a teacher only ever sees
 * their own classes and sessions, never another teacher's.
 */
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { RosterStudent } from '@/lib/classes/roster';
import type { SessionKind, SessionMode } from '@/lib/session/types';
import { getDb } from './client';
import { attempts, classes, sessions } from './schema';

export interface TeacherSessionSummary {
  id: string;
  code: string;
  mode: SessionMode;
  kind: SessionKind;
  open: boolean;
  taskCount: number;
  /** Homework only, ISO. */
  dueAt: string | null;
  createdAt: string;
}

export interface TeacherClassSummary {
  id: string;
  title: string;
  grade: number | null;
  students: RosterStudent[];
  sessions: TeacherSessionSummary[];
}

export interface ClassOption {
  id: string;
  title: string;
  /** Starts the session builder's task bank on this grade. */
  grade: number | null;
}

/** For the session builder's class picker — no roster or session join needed there. */
export async function listClassOptionsForTeacher(teacherId: string): Promise<ClassOption[]> {
  return getDb()
    .select({ id: classes.id, title: classes.title, grade: classes.grade })
    .from(classes)
    .where(eq(classes.teacherId, teacherId))
    .orderBy(asc(classes.title));
}

/** Ownership check: a session builder must not create a session under a class the caller does not own. */
export async function getClassForTeacher(classId: string, teacherId: string): Promise<ClassOption | null> {
  const [row] = await getDb()
    .select({ id: classes.id, title: classes.title, grade: classes.grade })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}

export interface ClassWithRoster {
  id: string;
  title: string;
  grade: number | null;
  students: RosterStudent[];
}

/** For the class edit form: same ownership check as getClassForTeacher, plus the roster to edit. */
export async function getClassWithRosterForTeacher(
  classId: string,
  teacherId: string
): Promise<ClassWithRoster | null> {
  const [row] = await getDb()
    .select({ id: classes.id, title: classes.title, grade: classes.grade, students: classes.students })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}

export interface ClassFields {
  title: string;
  grade: number | null;
  /** Already checked (lib/classes/roster.ts, `cleanStudents`): ids kept or minted, names distinct. */
  students: RosterStudent[];
}

export async function createClass(teacherId: string, fields: ClassFields): Promise<{ id: string }> {
  const [row] = await getDb()
    .insert(classes)
    .values({
      teacherId,
      title: fields.title,
      grade: fields.grade,
      students: fields.students
    })
    .returning({ id: classes.id });
  return row;
}

/**
 * Saves a class. A renamed student keeps their id, so their results follow
 * with nothing else to update; a removed one keeps their attempts, shown under
 * the name stored on them. Returns null if the class does not exist or is not
 * owned by this teacher — same rule as getClassForTeacher.
 */
export async function updateClass(classId: string, teacherId: string, fields: ClassFields): Promise<{ id: string } | null> {
  const [row] = await getDb()
    .update(classes)
    .set({ title: fields.title, grade: fields.grade, students: fields.students })
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
    .returning({ id: classes.id });
  return row ?? null;
}

/**
 * Deletes a class with all its sessions and everything recorded in them.
 * Like deleting a session (lib/db/sessions.ts), the one other place attempts
 * are removed: the teacher withdrawing a whole class, never editing results.
 */
export async function deleteClass(classId: string, teacherId: string): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
      .limit(1);
    if (!row) return false;
    const classSessions = tx.select({ id: sessions.id }).from(sessions).where(eq(sessions.classId, classId));
    await tx.delete(attempts).where(inArray(attempts.sessionId, classSessions));
    // A class check points at its homework, so checks go before the rest.
    await tx
      .delete(sessions)
      .where(and(eq(sessions.classId, classId), sql`${sessions.checksSessionId} is not null`));
    await tx.delete(sessions).where(eq(sessions.classId, classId));
    await tx.delete(classes).where(eq(classes.id, classId));
    return true;
  });
}

/** The students who have counted work in any of the class's sessions — the class form warns before removing one. */
export async function listStudentIdsWithAttempts(classId: string): Promise<string[]> {
  const rows = await getDb()
    .selectDistinct({ id: attempts.studentId })
    .from(attempts)
    .innerJoin(sessions, eq(attempts.sessionId, sessions.id))
    .where(and(eq(sessions.classId, classId), isNull(attempts.voidedAt)));
  return rows.map((row) => row.id);
}

export async function listClassesForTeacher(teacherId: string): Promise<TeacherClassSummary[]> {
  const rows = await getDb()
    .select({
      classId: classes.id,
      classTitle: classes.title,
      classGrade: classes.grade,
      students: classes.students,
      sessionId: sessions.id,
      sessionCode: sessions.code,
      sessionMode: sessions.mode,
      sessionKind: sessions.kind,
      sessionClosesAt: sessions.closesAt,
      sessionTaskIds: sessions.taskIds,
      sessionDueAt: sessions.dueAt,
      sessionCreatedAt: sessions.createdAt
    })
    .from(classes)
    .leftJoin(sessions, eq(sessions.classId, classes.id))
    .where(eq(classes.teacherId, teacherId))
    .orderBy(asc(classes.title), asc(classes.id), desc(sessions.createdAt), asc(sessions.code));

  const byClass = new Map<string, TeacherClassSummary>();
  for (const row of rows) {
    let entry = byClass.get(row.classId);
    if (!entry) {
      entry = { id: row.classId, title: row.classTitle, grade: row.classGrade, students: row.students, sessions: [] };
      byClass.set(row.classId, entry);
    }
    if (row.sessionId && row.sessionCode && row.sessionMode) {
      entry.sessions.push({
        id: row.sessionId,
        code: row.sessionCode,
        mode: row.sessionMode,
        kind: row.sessionKind ?? 'lesson',
        open: row.sessionClosesAt === null,
        taskCount: (row.sessionTaskIds ?? []).length,
        dueAt: row.sessionDueAt?.toISOString() ?? null,
        createdAt: (row.sessionCreatedAt ?? new Date(0)).toISOString()
      });
    }
  }
  return [...byClass.values()];
}
