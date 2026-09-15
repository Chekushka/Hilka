/**
 * Mints one session — a stopgap until the teacher session builder exists
 * (docs/TASKS.md, Teacher Flow). The builder will pick tasks by grade tag and
 * topic through a UI; this does the same thing from the command line, so the
 * join/submit/attempts flow can be built and tested before that UI exists.
 *
 * Usage:
 *   DATABASE_URL=... npm run db:create-session -- \
 *     --teacher you@example.com --class "7-А" \
 *     --roster "Оля,Іван,Петро" --tasks g7-turtle-square \
 *     [--code ABC123] [--mode graded] [--limit 900] [--no-hints]
 *
 * A class is created fresh on every run — there is no "find or reuse" here,
 * matching the size of this tool: mint a session, don't manage a roster over
 * time. --code is optional; omit it to get a random one from an alphabet that
 * excludes visually ambiguous characters, the same reasoning as progress_codes
 * (docs/AI_CONTEXT.md), even though a session code is not itself a bearer
 * credential for anything private.
 */
import { randomInt } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { classes, sessions, tasks, teachers } from '@/lib/db/schema';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0 O 1 I l

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function randomCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const teacherEmail = args.teacher;
  const className = args.class;
  const rosterArg = args.roster;
  const taskSlugsArg = args.tasks;
  if (typeof teacherEmail !== 'string') fail('--teacher <email> is required');
  if (typeof className !== 'string') fail('--class <title> is required');
  if (typeof rosterArg !== 'string') fail('--roster "Name1,Name2" is required');
  if (typeof taskSlugsArg !== 'string') fail('--tasks slug1,slug2 is required');

  const roster = rosterArg.split(',').map((name) => name.trim()).filter(Boolean);
  if (roster.length === 0) fail('--roster produced an empty list');

  const taskSlugs = taskSlugsArg.split(',').map((slug) => slug.trim()).filter(Boolean);
  const mode = args.mode === 'graded' ? 'graded' : 'practice';
  const hintsEnabled = args['no-hints'] !== true;
  const limitArg = args.limit;
  const timeLimitS = typeof limitArg === 'string' ? Number.parseInt(limitArg, 10) : null;
  const requestedCode = typeof args.code === 'string' ? args.code.toUpperCase() : null;
  if (requestedCode && !/^[A-Z0-9]{6}$/.test(requestedCode)) {
    fail('--code must be exactly 6 letters/digits');
  }

  const db = getDb();

  const [teacher] = await db
    .insert(teachers)
    .values({ email: teacherEmail })
    .onConflictDoUpdate({ target: teachers.email, set: { email: teacherEmail } })
    .returning({ id: teachers.id });

  const [klass] = await db.insert(classes).values({ teacherId: teacher.id, title: className, roster }).returning({ id: classes.id });

  const taskRows = await db
    .select({ id: tasks.id, slug: tasks.slug })
    .from(tasks)
    .where(and(inArray(tasks.slug, taskSlugs), eq(tasks.status, 'published')));
  const found = new Set(taskRows.map((row) => row.slug));
  const missing = taskSlugs.filter((slug) => !found.has(slug));
  if (missing.length > 0) {
    fail(`unknown or unpublished task slug(s): ${missing.join(', ')}`);
  }
  // Preserve the order the teacher asked for, not whatever the query returned.
  const taskIds = taskSlugs.map((slug) => taskRows.find((row) => row.slug === slug)!.id);

  const code = requestedCode ?? randomCode();
  try {
    await db.insert(sessions).values({
      classId: klass.id,
      code,
      mode,
      taskIds,
      timeLimitS: Number.isFinite(timeLimitS) ? timeLimitS : null,
      hintsEnabled
    });
  } catch (error) {
    // drizzle wraps the driver's error: the constraint name is on the pg
    // error (error.cause), not in the wrapper's own .message.
    const cause = error instanceof Error ? error.cause : undefined;
    const constraint = cause && typeof cause === 'object' && 'constraint' in cause ? cause.constraint : undefined;
    if (constraint === 'sessions_open_code_idx') {
      fail(`code ${code} is already in use by another open session — pass a different --code`);
    }
    throw error;
  }

  console.log(`session created: code ${code}, class "${className}", ${roster.length} students, ${taskIds.length} task(s), mode ${mode}`);
  console.log(`join at: /s/${code}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
