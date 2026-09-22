/**
 * JSON export/import of all task content (docs/TASKS.md, "JSON export/import
 * of all tasks") — backup, git history, and handoff to another teacher. The
 * bundle shape matches `content/topics.json` + `content/seed-tasks/*.json`
 * exactly, so an export can be split into those files by hand and an import
 * round-trips either one back into any database. Distinct from
 * `scripts/db/seed-content.ts`, which reads the same shape from the
 * filesystem at build/ops time rather than from a teacher-facing route.
 *
 * Rows are upserted by slug, never by uuid — the same reason
 * `tasks.slug`/`topics.slug` exist at all (docs/AI_CONTEXT.md): uuids are
 * not stable across databases, so a handoff or a restore must key on content
 * identity instead.
 */
import { asc, eq } from 'drizzle-orm';
import { validateTaskChecks } from '@/lib/checker';
import type { Check } from '@/lib/checker';
import type { Reference, RunCase, TaskPayload, TaskStatus, TaskType } from '@/lib/task/types';
import { getDb } from './client';
import { tasks, topics } from './schema';

export interface TopicContent {
  slug: string;
  title: string;
  order: number;
  gradeTags: number[];
  curriculumRef?: string;
  theoryMd?: string;
}

export interface TaskContent {
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

export interface ContentBundle {
  topics: TopicContent[];
  tasks: TaskContent[];
}

export interface ImportResult {
  topicsImported: number;
  tasksImported: number;
}

export interface ContentIssue {
  taskSlug?: string;
  message: string;
}

/** Thrown by `importContent` before anything is written — nothing is half-imported. */
export class ImportValidationError extends Error {
  constructor(public readonly issues: ContentIssue[]) {
    super(`invalid content bundle: ${issues.map((issue) => issue.message).join('; ')}`);
    this.name = 'ImportValidationError';
  }
}

/** Every topic and every task — draft, published, archived — in the same shape `content/` uses. */
export async function exportContent(): Promise<ContentBundle> {
  const db = getDb();

  const topicRows = await db.select().from(topics).orderBy(asc(topics.order));
  const taskRows = await db
    .select({ task: tasks, topicSlug: topics.slug })
    .from(tasks)
    .innerJoin(topics, eq(tasks.topicId, topics.id))
    .orderBy(asc(topics.order), asc(tasks.slug));

  return {
    topics: topicRows.map((topic) => ({
      slug: topic.slug,
      title: topic.title,
      order: topic.order,
      gradeTags: topic.gradeTags,
      curriculumRef: topic.curriculumRef ?? undefined,
      theoryMd: topic.theoryMd ?? undefined
    })),
    tasks: taskRows.map(({ task, topicSlug }) => ({
      slug: task.slug,
      topicSlug,
      type: task.type,
      title: task.title,
      payload: task.payload,
      checks: task.checks,
      cases: task.cases ?? undefined,
      hints: task.hints,
      reference: task.reference ?? undefined,
      difficulty: task.difficulty,
      gradeTags: task.gradeTags,
      version: task.version,
      status: task.status
    }))
  };
}

/**
 * Upserts every topic and task by slug. Validated in full before any write —
 * the same rule the authoring UI enforces per task (a task that cannot be
 * authored must not be importable either), applied to the whole bundle so an
 * import never leaves the database half-updated.
 */
export async function importContent(bundle: ContentBundle): Promise<ImportResult> {
  const db = getDb();

  const providedTopicSlugs = new Set(bundle.topics.map((topic) => topic.slug));
  const existingTopicRows = await db.select({ slug: topics.slug }).from(topics);
  const existingTopicSlugs = new Set(existingTopicRows.map((row) => row.slug));

  const issues: ContentIssue[] = [];
  for (const task of bundle.tasks) {
    if (!providedTopicSlugs.has(task.topicSlug) && !existingTopicSlugs.has(task.topicSlug)) {
      issues.push({ taskSlug: task.slug, message: `unknown topic "${task.topicSlug}"` });
    }
    const errors = validateTaskChecks({
      checks: task.checks,
      cases: task.cases,
      reference: task.reference,
      type: task.type
    });
    for (const error of errors) {
      issues.push({ taskSlug: task.slug, message: error.message });
    }
  }
  if (issues.length > 0) {
    throw new ImportValidationError(issues);
  }

  const topicIds = new Map<string, string>();
  for (const topic of bundle.topics) {
    const values = {
      slug: topic.slug,
      title: topic.title,
      order: topic.order,
      gradeTags: topic.gradeTags,
      curriculumRef: topic.curriculumRef ?? null,
      theoryMd: topic.theoryMd ?? null
    };
    const [row] = await db
      .insert(topics)
      .values(values)
      .onConflictDoUpdate({ target: topics.slug, set: values })
      .returning({ id: topics.id });
    topicIds.set(topic.slug, row.id);
  }

  for (const task of bundle.tasks) {
    const topicId = topicIds.get(task.topicSlug) ?? (await getTopicId(db, task.topicSlug));
    const values = {
      slug: task.slug,
      topicId,
      type: task.type,
      title: task.title,
      payload: task.payload,
      checks: task.checks,
      cases: task.cases?.length ? task.cases : null,
      reference: task.reference ?? null,
      hints: task.hints ?? [],
      difficulty: task.difficulty,
      gradeTags: task.gradeTags,
      version: task.version,
      status: task.status
    };
    await db.insert(tasks).values(values).onConflictDoUpdate({ target: tasks.slug, set: values });
  }

  return { topicsImported: bundle.topics.length, tasksImported: bundle.tasks.length };
}

async function getTopicId(db: ReturnType<typeof getDb>, slug: string): Promise<string> {
  const [row] = await db.select({ id: topics.id }).from(topics).where(eq(topics.slug, slug)).limit(1);
  // Guaranteed to exist — importContent already validated every task's
  // topicSlug against providedTopicSlugs ∪ existingTopicSlugs before writing.
  return row!.id;
}
