/**
 * Writes a JSON export back into content/ — the way tasks and lessons
 * authored in the UI reach git. The inverse of `npm run db:seed`.
 *
 *   npm run content:write -- hilka-content.json      a file downloaded from /tasks or /lessons
 *   DATABASE_URL=... npm run content:write -- --db   straight from a database
 *   add --dry-run to list what would change without writing
 *
 * What gets written is decided by lib/content/write-plan.ts: only files whose
 * content changed are rewritten, nothing is deleted, and only a reference's
 * code is kept. Review the result with `git diff` before committing — an
 * export of a development database also carries whatever tests created there.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { planContentWrite, type ExistingContent } from '@/lib/content/write-plan';
import type { ContentBundle } from '@/lib/db/content-io';
import type { LessonContent } from '@/lib/lessons/types';

const root = path.join(process.cwd(), 'content');

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

async function readIfExists<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function readExisting(): Promise<ExistingContent> {
  const topics = await readIfExists(() => readJson<ExistingContent['topics']>(path.join(root, 'topics.json')));

  const tasks = new Map<string, { file: string; content: unknown }>();
  const taskDir = path.join(root, 'seed-tasks');
  for (const file of ((await readIfExists(() => readdir(taskDir))) ?? []).filter((name) => name.endsWith('.json')).sort()) {
    const content = await readJson<{ slug?: unknown }>(path.join(taskDir, file));
    if (typeof content.slug === 'string') tasks.set(content.slug, { file, content });
  }

  const lessons = new Map<number, LessonContent[]>();
  const explanations = new Map<string, string>();
  const lessonDir = path.join(root, 'lessons');
  for (const file of (await readIfExists(() => readdir(lessonDir))) ?? []) {
    const match = /^grade(\d+)\.json$/.exec(file);
    if (!match) continue;
    const grade = Number(match[1]);
    const list = await readJson<LessonContent[]>(path.join(lessonDir, file));
    lessons.set(grade, list);
    for (const lesson of list) {
      const md = await readIfExists(() => readFile(path.join(lessonDir, `grade${grade}`, `${lesson.slug}.md`), 'utf8'));
      if (md !== null) explanations.set(`${grade}/${lesson.slug}`, md);
    }
  }

  return { topics, tasks, lessons, explanations };
}

async function readBundle(args: string[]): Promise<ContentBundle> {
  if (args.includes('--db')) {
    // Imported here so the file mode never needs a database driver or DATABASE_URL.
    const { exportContent } = await import('@/lib/db/content-io');
    return exportContent();
  }
  const file = args.find((arg) => !arg.startsWith('--'));
  if (!file) {
    throw new Error('usage: npm run content:write -- <export.json> | --db  [--dry-run]');
  }
  const bundle = await readJson<ContentBundle>(path.resolve(file));
  if (!Array.isArray(bundle.topics) || !Array.isArray(bundle.tasks)) {
    throw new Error(`${file} is not a Hilka export: it needs "topics" and "tasks" arrays`);
  }
  return bundle;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const bundle = await readBundle(args);
  const plan = planContentWrite(bundle, await readExisting());

  for (const write of plan.writes) {
    console.log(`${dryRun ? 'would write' : 'write'}: content/${write.path}`);
    if (dryRun) continue;
    const target = path.join(root, write.path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, write.content, 'utf8');
  }
  console.log(`${plan.writes.length} file(s) ${dryRun ? 'to write' : 'written'}, ${plan.unchanged} unchanged.`);

  const { topics, tasks, lessons } = plan.notInExport;
  if (topics.length + tasks.length + lessons.length > 0) {
    console.log('In content/ but not in this export (kept, not deleted):');
    if (topics.length > 0) console.log(`  topics: ${topics.join(', ')}`);
    if (tasks.length > 0) console.log(`  tasks: ${tasks.join(', ')}`);
    if (lessons.length > 0) console.log(`  lessons: ${lessons.join(', ')}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
