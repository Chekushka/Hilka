/**
 * Proves migration 0009 (student ids) on data shaped the way production's is
 * before it: a scratch database is migrated to 0008, filled with a roster,
 * attempts under names on it and one under a name since removed, then taken
 * to the latest migration. Checks the backfill — every roster name gets an
 * id and keeps its name as the seed, every attempt gets a student id, the
 * removed name its own — and the two temporary triggers that keep code from
 * before 0009 working while a deploy rolls out.
 *
 * Needs `DATABASE_URL` pointing at a server where it may create and drop a
 * database (CI's throwaway Postgres, or a local one). Never point it at Neon
 * production: it only touches its own scratch database, but there is no
 * reason to try.
 */
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

const BEFORE = '0008_add_class_grade_and_session_created';

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/** drizzle/ cut off after `lastTag`, in a temporary folder. */
function migrationsUpTo(lastTag: string): string {
  const folder = mkdtempSync(path.join(tmpdir(), 'hilka-migrations-'));
  cpSync('drizzle', folder, { recursive: true });
  const journalPath = path.join(folder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] };
  const last = journal.entries.findIndex((entry) => entry.tag === lastTag);
  assert.notEqual(last, -1, `no migration ${lastTag}`);
  journal.entries = journal.entries.slice(0, last + 1);
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
}

async function main() {
  const serverUrl = process.env.DATABASE_URL;
  if (!serverUrl) throw new Error('DATABASE_URL is not set');
  const scratch = `hilka_migration_check_${Date.now()}`;

  const admin = new Client({ connectionString: serverUrl });
  await admin.connect();
  await admin.query(`create database ${scratch}`);
  const client = new Client({ connectionString: withDatabase(serverUrl, scratch) });
  const partial = migrationsUpTo(BEFORE);
  try {
    await client.connect();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: partial });

    // Old-shape data, written the way code from before 0009 writes it.
    const { rows: [teacher] } = await client.query(`insert into teachers (email) values ('check@hilka.dev') returning id`);
    const { rows: [klass] } = await client.query(
      `insert into classes (teacher_id, title, roster) values ($1, '7-А', array['Оля', 'Марко', 'Іван']) returning id`,
      [teacher.id]
    );
    const { rows: [session] } = await client.query(
      `insert into sessions (class_id, code, mode) values ($1, 'CHK001', 'graded') returning id`,
      [klass.id]
    );
    const { rows: [topic] } = await client.query(`insert into topics (slug, title, "order") values ('t', 'T', 1) returning id`);
    const { rows: [task] } = await client.query(
      `insert into tasks (slug, topic_id, type, title, payload, checks, difficulty) values ('t1', $1, 'quiz', 'T', '{}', '[]', 1) returning id`,
      [topic.id]
    );
    for (const name of ['Оля', 'Оля', 'Марко', 'Петро']) {
      await client.query(
        `insert into attempts (session_id, student_name, task_id, task_version, passed) values ($1, $2, $3, 1, true)`,
        [session.id, name, task.id]
      );
    }

    await migrate(db, { migrationsFolder: 'drizzle' });

    // Every roster name: a 12-hex id, its name, and the name as its seed.
    const { rows: [{ students }] } = await client.query(`select students from classes where id = $1`, [klass.id]);
    assert.deepEqual(
      students.map((student: { name: string; seed: string }) => [student.name, student.seed]),
      [['Оля', 'Оля'], ['Марко', 'Марко'], ['Іван', 'Іван']]
    );
    const ids = students.map((student: { id: string }) => student.id);
    for (const id of ids) assert.match(id, /^[0-9a-f]{12}$/);
    assert.equal(new Set(ids).size, ids.length);
    const idOf = (name: string) => students.find((student: { name: string }) => student.name === name).id as string;

    // Every attempt: its student's id; the removed name one of its own, off the roster.
    const { rows: backfilled } = await client.query(`select student_name, student_id from attempts order by student_name`);
    assert.ok(backfilled.every((row) => row.student_id !== null));
    const byName = (name: string) => backfilled.filter((row) => row.student_name === name).map((row) => row.student_id);
    assert.deepEqual(byName('Оля'), [idOf('Оля'), idOf('Оля')]);
    assert.deepEqual(byName('Марко'), [idOf('Марко')]);
    const [petro] = byName('Петро');
    assert.match(petro, /^[0-9a-f]{12}$/);
    assert.ok(!ids.includes(petro));

    // Old code inserting an attempt without a student id: the trigger fills it.
    const { rows: [inserted] } = await client.query(
      `insert into attempts (session_id, student_name, task_id, task_version, passed) values ($1, 'Марко', $2, 1, false) returning student_id`,
      [session.id, task.id]
    );
    assert.equal(inserted.student_id, idOf('Марко'));

    // Old code renaming through the roster: names it keeps keep their ids, a new one gets one.
    await client.query(`update classes set roster = array['Оля', 'Марко', 'Іванко'] where id = $1`, [klass.id]);
    const { rows: [{ students: mirrored }] } = await client.query(`select students from classes where id = $1`, [klass.id]);
    assert.equal(mirrored[0].id, idOf('Оля'));
    assert.equal(mirrored[0].seed, 'Оля');
    assert.equal(mirrored[1].id, idOf('Марко'));
    assert.equal(mirrored[2].name, 'Іванко');
    assert.match(mirrored[2].id, /^[0-9a-f]{12}$/);
    assert.ok(!ids.includes(mirrored[2].id));

    // Old code creating a class: `students` is built from its roster.
    const { rows: [created] } = await client.query(
      `insert into classes (teacher_id, title, roster) values ($1, '7-Б', array['Ліна']) returning students`,
      [teacher.id]
    );
    assert.equal(created.students.length, 1);
    assert.equal(created.students[0].name, 'Ліна');

    // New code writes both columns: `students` is taken as given.
    await client.query(
      `update classes set roster = array['Х'], students = '[{"id":"aaaaaaaaaaaa","name":"Х"}]' where id = $1`,
      [klass.id]
    );
    const { rows: [{ students: given }] } = await client.query(`select students from classes where id = $1`, [klass.id]);
    assert.deepEqual(given, [{ id: 'aaaaaaaaaaaa', name: 'Х' }]);

    console.log('migration 0009: backfill and transition triggers behave');
  } finally {
    await client.end().catch(() => undefined);
    await admin.query(`drop database if exists ${scratch}`);
    await admin.end();
    rmSync(partial, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
