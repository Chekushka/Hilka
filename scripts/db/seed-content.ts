/**
 * Imports content/ into the database.
 *
 * The database is the source of truth for what students see; the JSON in
 * content/ is the backup, the git history and the handoff format
 * (docs/AI_CONTEXT.md). This script is how the second becomes the first, and
 * it is idempotent: rows are keyed by slug, so re-running it updates rather
 * than duplicating.
 *
 *   DATABASE_URL=... npm run db:seed
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { validateTaskChecks } from '@/lib/checker';
import { getDb } from '@/lib/db/client';
import { tasks, topics } from '@/lib/db/schema';
import type { Check } from '@/lib/checker';
import type { Reference, RunCase, TaskPayload, TaskStatus, TaskType } from '@/lib/task/types';

const root = path.join(process.cwd(), 'content');

interface TopicContent {
  slug: string;
  title: string;
  order: number;
  gradeTags: number[];
  curriculumRef?: string;
  theoryMd?: string;
}

interface TaskContent {
  slug: string;
  topicSlug: string;
  type: TaskType;
  title: string;
  payload: TaskPayload;
  checks: Check[];
  cases?: RunCase[];
  hints: string[];
  reference?: Reference;
  difficulty: number;
  gradeTags: number[];
  version: number;
  status: TaskStatus;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

async function main() {
  const db = getDb();

  const topicContent = await readJson<TopicContent[]>(path.join(root, 'topics.json'));
  const topicIds = new Map<string, string>();
  for (const topic of topicContent) {
    const [row] = await db
      .insert(topics)
      .values({
        slug: topic.slug,
        title: topic.title,
        order: topic.order,
        gradeTags: topic.gradeTags,
        curriculumRef: topic.curriculumRef ?? null,
        theoryMd: topic.theoryMd ?? null
      })
      .onConflictDoUpdate({
        target: topics.slug,
        set: {
          title: topic.title,
          order: topic.order,
          gradeTags: topic.gradeTags,
          curriculumRef: topic.curriculumRef ?? null,
          theoryMd: topic.theoryMd ?? null
        }
      })
      .returning({ id: topics.id });
    topicIds.set(topic.slug, row.id);
  }
  console.log(`topics: ${topicContent.length}`);

  const taskDir = path.join(root, 'seed-tasks');
  const files = (await readdir(taskDir)).filter((file) => file.endsWith('.json')).sort();
  for (const file of files) {
    const task = await readJson<TaskContent>(path.join(taskDir, file));
    const topicId = topicIds.get(task.topicSlug);
    if (!topicId) {
      throw new Error(`${file}: unknown topic "${task.topicSlug}" — add it to content/topics.json`);
    }
    // The same rules the authoring UI enforces. A task that cannot be authored
    // must not be importable either.
    const errors = validateTaskChecks({
      checks: task.checks,
      cases: task.cases,
      reference: task.reference,
      type: task.type
    });
    if (errors.length > 0) {
      throw new Error(`${file}: ${errors.map((error) => error.message).join('; ')}`);
    }

    const values = {
      slug: task.slug,
      topicId,
      type: task.type,
      title: task.title,
      payload: task.payload,
      checks: task.checks,
      cases: task.cases ?? null,
      reference: task.reference ?? null,
      hints: task.hints ?? [],
      difficulty: task.difficulty,
      gradeTags: task.gradeTags,
      version: task.version,
      status: task.status
    };
    await db
      .insert(tasks)
      .values(values)
      .onConflictDoUpdate({ target: tasks.slug, set: values });
    console.log(`task: ${task.slug} (${task.status})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
