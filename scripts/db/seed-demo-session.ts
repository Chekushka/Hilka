/**
 * Seeds one demo teacher, class and open session so the join-by-code flow
 * (docs/TASKS.md, "Session create/join/submit") can be exercised end to end
 * without the session builder, which does not exist yet.
 *
 * Idempotent: keyed by the teacher's email, then by (teacher, class title),
 * then by "the class's currently open session" — re-running updates the same
 * rows rather than duplicating them, the same rule scripts/db/seed-content.ts
 * follows for tasks and topics.
 *
 *   DATABASE_URL=... npm run db:seed:demo
 *
 * Requires content to be seeded first — a session needs a published task to
 * assign.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { classes, sessions, tasks, teachers } from '@/lib/db/schema';

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';
const CLASS_TITLE = 'Демонстраційний клас';
const ROSTER = ['Олена', 'Тарас', 'Соломія'];
export const DEMO_SESSION_CODE = 'DEMO01';

async function main() {
  const db = getDb();

  const [teacher] = await db
    .insert(teachers)
    .values({ email: TEACHER_EMAIL, role: 'teacher' })
    .onConflictDoUpdate({ target: teachers.email, set: { email: TEACHER_EMAIL } })
    .returning({ id: teachers.id });

  const [existingClass] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.teacherId, teacher.id), eq(classes.title, CLASS_TITLE)))
    .limit(1);

  let classId: string;
  if (existingClass) {
    classId = existingClass.id;
    await db.update(classes).set({ roster: ROSTER }).where(eq(classes.id, classId));
  } else {
    const [created] = await db
      .insert(classes)
      .values({ teacherId: teacher.id, title: CLASS_TITLE, roster: ROSTER })
      .returning({ id: classes.id });
    classId = created.id;
  }
  console.log(`class: ${CLASS_TITLE} (${classId})`);

  const publishedTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.status, 'published'));
  if (publishedTasks.length === 0) {
    throw new Error('No published tasks found — run "npm run db:seed" before seeding a demo session.');
  }
  const taskIds = publishedTasks.map((row) => row.id);

  const [openSession] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.classId, classId), isNull(sessions.closesAt)))
    .limit(1);

  if (openSession) {
    await db
      .update(sessions)
      .set({ code: DEMO_SESSION_CODE, taskIds })
      .where(eq(sessions.id, openSession.id));
    console.log(`session: ${DEMO_SESSION_CODE} (updated)`);
  } else {
    await db.insert(sessions).values({
      classId,
      code: DEMO_SESSION_CODE,
      mode: 'practice',
      taskIds,
      hintsEnabled: true,
      shuffle: false
    });
    console.log(`session: ${DEMO_SESSION_CODE} (created)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
