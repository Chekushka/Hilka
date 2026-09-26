/**
 * JSON export/import of all content (docs/TASKS.md, "JSON export/import
 * of all tasks") — backup, git history, and handoff to another teacher. The
 * bundle shape matches `content/topics.json` + `content/seed-tasks/*.json` +
 * `content/lessons/grade<N>.json` (each explanation inlined as
 * `explanationMd`), so an export can be split into those files by hand and
 * an import round-trips either one back into any database. Distinct from
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
import { resolveTaskSlugs, validateLessonImport } from '@/lib/lessons/content';
import type { LessonContent } from '@/lib/lessons/types';
import type { Check } from '@/lib/checker';
import type { ParamSpec } from '@/lib/seed';
import type { Reference, RunCase, TaskPayload, TaskStatus, TaskType } from '@/lib/task/types';
import { getDb } from './client';
import { lessons, tasks, topics } from './schema';

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
  /** `code` only (docs/TASK_SCHEMA.md, "Parameterization"). */
  params?: ParamSpec;
  difficulty: number;
  gradeTags: number[];
  version: number;
  status: TaskStatus;
}

/**
 * A lesson as content/lessons/grade<N>.json lists it, with the explanation
 * inlined — in git it is content/lessons/grade<N>/<slug>.md, which a single
 * JSON file cannot carry.
 */
export interface LessonExport extends LessonContent {
  explanationMd: string;
}

export interface ContentBundle {
  topics: TopicContent[];
  tasks: TaskContent[];
  /** Optional on import: a bundle exported before lessons were added still imports. */
  lessons?: LessonExport[];
}

export interface ImportResult {
  topicsImported: number;
  tasksImported: number;
  lessonsImported: number;
}

export interface ContentIssue {
  taskSlug?: string;
  lessonSlug?: string;
  message: string;
}

/** Thrown by `importContent` before anything is written — nothing is half-imported. */
export class ImportValidationError extends Error {
  constructor(public readonly issues: ContentIssue[]) {
    super(`invalid content bundle: ${issues.map((issue) => issue.message).join('; ')}`);
    this.name = 'ImportValidationError';
  }
}

/** Every topic, task (draft, published, archived) and lesson, in the same shape `content/` uses. */
export async function exportContent(): Promise<ContentBundle> {
  const db = getDb();

  const topicRows = await db.select().from(topics).orderBy(asc(topics.order));
  const taskRows = await db
    .select({ task: tasks, topicSlug: topics.slug })
    .from(tasks)
    .innerJoin(topics, eq(tasks.topicId, topics.id))
    .orderBy(asc(topics.order), asc(tasks.slug));

  const lessonRows = await db.select().from(lessons).orderBy(asc(lessons.grade), asc(lessons.order));
  const slugById = new Map(taskRows.map(({ task }) => [task.id, task.slug]));
  // Every reader already skips an id that no longer resolves; the export does the same.
  const toSlugs = (ids: string[]) => ids.flatMap((id) => slugById.get(id) ?? []);

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
      params: task.params ?? undefined,
      difficulty: task.difficulty,
      gradeTags: task.gradeTags,
      version: task.version,
      status: task.status
    })),
    lessons: lessonRows.map((lesson) => ({
      slug: lesson.slug,
      grade: lesson.grade,
      order: lesson.order,
      kind: lesson.kind,
      title: lesson.title,
      curriculumRef: lesson.curriculumRef ?? undefined,
      explanationMd: lesson.explanationMd,
      coreTaskSlugs: toSlugs(lesson.coreTaskIds),
      additionalTaskSlugs: toSlugs(lesson.additionalTaskIds)
    }))
  };
}

/**
 * Upserts every topic, task and lesson by slug. Validated in full before any write —
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

  // Lessons reference tasks by slug: the bundle's own, or ones already in the database.
  const bundleLessons = bundle.lessons ?? [];
  const existingTaskRows = await db.select({ slug: tasks.slug }).from(tasks);
  const knownTaskSlugs = new Set([...existingTaskRows.map((row) => row.slug), ...bundle.tasks.map((task) => task.slug)]);
  const existingLessons = await db.select({ slug: lessons.slug, grade: lessons.grade, order: lessons.order }).from(lessons);
  for (const error of validateLessonImport(bundleLessons, existingLessons, knownTaskSlugs)) {
    issues.push({ lessonSlug: error.lesson, message: error.message });
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
      params: task.params ?? null,
      hints: task.hints ?? [],
      difficulty: task.difficulty,
      gradeTags: task.gradeTags,
      version: task.version,
      status: task.status
    };
    await db.insert(tasks).values(values).onConflictDoUpdate({ target: tasks.slug, set: values });
  }

  if (bundleLessons.length > 0) {
    const taskIdRows = await db.select({ id: tasks.id, slug: tasks.slug }).from(tasks);
    const idsBySlug = new Map(taskIdRows.map((row) => [row.slug, row.id]));
    for (const lesson of bundleLessons) {
      const values = {
        slug: lesson.slug,
        grade: lesson.grade,
        order: lesson.order,
        kind: lesson.kind,
        title: lesson.title,
        curriculumRef: lesson.curriculumRef ?? null,
        explanationMd: lesson.explanationMd,
        coreTaskIds: resolveTaskSlugs(lesson.coreTaskSlugs, idsBySlug),
        additionalTaskIds: resolveTaskSlugs(lesson.additionalTaskSlugs, idsBySlug)
      };
      await db.insert(lessons).values(values).onConflictDoUpdate({ target: lessons.slug, set: values });
    }
  }

  return {
    topicsImported: bundle.topics.length,
    tasksImported: bundle.tasks.length,
    lessonsImported: bundleLessons.length
  };
}

async function getTopicId(db: ReturnType<typeof getDb>, slug: string): Promise<string> {
  const [row] = await db.select({ id: topics.id }).from(topics).where(eq(topics.slug, slug)).limit(1);
  // Guaranteed to exist — importContent already validated every task's
  // topicSlug against providedTopicSlugs ∪ existingTopicSlugs before writing.
  return row!.id;
}
