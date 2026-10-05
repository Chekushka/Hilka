/**
 * Turns a JSON export (lib/db/content-io.ts's ContentBundle) back into the
 * files under content/ — how a lesson or task authored in the UI reaches git
 * (docs/TASKS.md, "JSON export/import of all tasks"). Pure: the script
 * (scripts/content/write-export.ts) reads the current files and writes the
 * plan; everything deciding *what* to write lives here and is unit-tested.
 *
 * Three rules keep the git diff honest:
 * - A file is rewritten only when its content changed in meaning. The files
 *   in content/ are hand-formatted, and a re-export of untouched content must
 *   not reformat all of them.
 * - Nothing is deleted. A bundle may be partial, and a task missing from it is
 *   not proof it should go; what content/ has and the export lacks is reported.
 * - Derived data stays out of git: `reference` keeps only `code`, because
 *   `computedAt` and `artifacts` are recomputed on publish (docs/AI_CONTEXT.md).
 */
import type { ContentBundle, LessonExport, TaskContent, TopicContent } from '@/lib/db/content-io';
import type { LessonContent } from '@/lib/lessons/types';

export interface ExistingContent {
  /** content/topics.json, parsed; null when the file does not exist. */
  topics: TopicContent[] | null;
  /** Every content/seed-tasks/*.json, by the slug inside it. */
  tasks: ReadonlyMap<string, { file: string; content: unknown }>;
  /** content/lessons/grade<N>.json, parsed, by grade. */
  lessons: ReadonlyMap<number, LessonContent[]>;
  /** content/lessons/grade<N>/<slug>.md, keyed `${grade}/${slug}`. */
  explanations: ReadonlyMap<string, string>;
}

export interface FileWrite {
  /** Relative to content/. */
  path: string;
  content: string;
}

export interface WritePlan {
  writes: FileWrite[];
  /** Files whose content already matches the export. */
  unchanged: number;
  /** In content/ but not in the export — kept, only reported. */
  notInExport: { topics: string[]; tasks: string[]; lessons: string[] };
}

const TASK_KEY_ORDER = [
  'slug',
  'topicSlug',
  'type',
  'title',
  'payload',
  'params',
  'cases',
  'checks',
  'hints',
  'reference',
  'difficulty',
  'gradeTags',
  'tags',
  'version',
  'status'
] as const;

const TOPIC_KEY_ORDER = ['slug', 'title', 'order', 'gradeTags', 'curriculumRef', 'theoryMd'] as const;

const LESSON_KEY_ORDER = [
  'slug',
  'grade',
  'order',
  'kind',
  'title',
  'curriculumRef',
  'coreTaskSlugs',
  'additionalTaskSlugs'
] as const;

function pick(source: object, keys: readonly string[]): Record<string, unknown> {
  const record = source as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (record[key] !== undefined) out[key] = record[key];
  }
  return out;
}

/** A task as content/seed-tasks/ holds it: canonical key order, derived reference data dropped. */
export function taskFileContent(task: TaskContent): Record<string, unknown> {
  const out = pick(task, TASK_KEY_ORDER);
  if (task.cases && task.cases.length === 0) delete out.cases;
  if (task.reference) out.reference = { code: task.reference.code };
  return out;
}

function lessonEntry(lesson: LessonExport | LessonContent): Record<string, unknown> {
  return pick(lesson, LESSON_KEY_ORDER);
}

/** content/seed-tasks/ names files `grade7-…` for slugs `g7-…`; any other slug is used as is. */
export function taskFileName(slug: string): string {
  const match = /^g(\d+)-(.+)$/.exec(slug);
  return match ? `grade${match[1]}-${match[2]}.json` : `${slug}.json`;
}

/** Deep equality of parsed JSON, ignoring key order. */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameJson(item, b[index]));
  }
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord).filter((key) => aRecord[key] !== undefined);
  const bKeys = Object.keys(bRecord).filter((key) => bRecord[key] !== undefined);
  return aKeys.length === bKeys.length && aKeys.every((key) => sameJson(aRecord[key], bRecord[key]));
}

/** One line: `["a", "b"]`, `{ "k": 1 }` (or `{"k": 1}` without brace spacing). */
export function inlineJson(value: unknown, braceSpacing = true): string {
  if (Array.isArray(value)) return `[${value.map((item) => inlineJson(item, braceSpacing)).join(', ')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined);
    if (entries.length === 0) return '{}';
    const body = entries.map(([key, item]) => `${JSON.stringify(key)}: ${inlineJson(item, braceSpacing)}`).join(', ');
    return braceSpacing ? `{ ${body} }` : `{${body}}`;
  }
  return JSON.stringify(value);
}

/**
 * Two-space JSON in the hand-written style of content/: an array or object
 * stays on one line when it fits in `width`, and breaks one item per line
 * when it does not. The top level always breaks.
 */
export function formatJson(value: unknown, width = 100): string {
  const pad = (n: number) => ' '.repeat(n);
  const render = (item: unknown, indent: number, prefix: number, top: boolean): string => {
    const flat = inlineJson(item);
    const isContainer = typeof item === 'object' && item !== null;
    if (!isContainer || (!top && indent + prefix + flat.length <= width)) return flat;
    if (Array.isArray(item)) {
      if (item.length === 0) return '[]';
      const lines = item.map((element) => pad(indent + 2) + render(element, indent + 2, 0, false));
      return `[\n${lines.join(',\n')}\n${pad(indent)}]`;
    }
    const entries = Object.entries(item).filter(([, element]) => element !== undefined);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([key, element]) => {
      const keyText = `${JSON.stringify(key)}: `;
      return pad(indent + 2) + keyText + render(element, indent + 2, keyText.length, false);
    });
    return `{\n${lines.join(',\n')}\n${pad(indent)}}`;
  };
  return `${render(value, 0, 0, true)}\n`;
}

/** A list file with one entry per line — how topics.json and lessons/grade<N>.json are written by hand. */
function formatEntryList(entries: readonly object[], braceSpacing: boolean): string {
  if (entries.length === 0) return '[]\n';
  return `[\n${entries.map((entry) => `  ${inlineJson(entry, braceSpacing)}`).join(',\n')}\n]\n`;
}

/** Bundle entries replace existing ones with the same slug; existing ones the bundle lacks are kept. */
function mergeBySlug<T extends { slug: string }>(existing: readonly T[], incoming: readonly T[]): T[] {
  const bySlug = new Map(existing.map((item) => [item.slug, item]));
  for (const item of incoming) bySlug.set(item.slug, item);
  return [...bySlug.values()];
}

export function planContentWrite(bundle: ContentBundle, existing: ExistingContent): WritePlan {
  const writes: FileWrite[] = [];
  let unchanged = 0;
  const record = (path: string, content: string, same: boolean) => {
    if (same) unchanged += 1;
    else writes.push({ path, content });
  };

  // Topics: one file, merged by slug, in curriculum order.
  const existingTopics = existing.topics ?? [];
  const topics = mergeBySlug(existingTopics, bundle.topics)
    .sort((a, b) => a.order - b.order)
    .map((topic) => pick(topic, TOPIC_KEY_ORDER));
  if (bundle.topics.length > 0 || existing.topics === null) {
    record(
      'topics.json',
      formatEntryList(topics, true),
      existing.topics !== null && sameJson(topics, existingTopics.map((topic) => pick(topic, TOPIC_KEY_ORDER)))
    );
  }

  // Tasks: one file each, keeping the file an existing slug already lives in.
  for (const task of bundle.tasks) {
    const content = taskFileContent(task);
    const current = existing.tasks.get(task.slug);
    const file = current?.file ?? taskFileName(task.slug);
    record(`seed-tasks/${file}`, formatJson(content), current !== undefined && sameJson(content, current.content));
  }

  // Lessons: one list per grade, merged by slug and ordered by ministry number, plus one .md each.
  const bundleLessons = bundle.lessons ?? [];
  const grades = new Set([...bundleLessons.map((lesson) => lesson.grade)]);
  for (const grade of [...grades].sort((a, b) => a - b)) {
    const current = existing.lessons.get(grade);
    const incoming = bundleLessons.filter((lesson) => lesson.grade === grade);
    const merged = mergeBySlug<LessonContent>(current ?? [], incoming)
      .sort((a, b) => a.order - b.order)
      .map(lessonEntry);
    record(
      `lessons/grade${grade}.json`,
      formatEntryList(merged, false),
      current !== undefined && sameJson(merged, current.map(lessonEntry))
    );
  }
  for (const lesson of bundleLessons) {
    const key = `${lesson.grade}/${lesson.slug}`;
    record(`lessons/grade${key}.md`, lesson.explanationMd, existing.explanations.get(key) === lesson.explanationMd);
  }

  const exportedTopics = new Set(bundle.topics.map((topic) => topic.slug));
  const exportedTasks = new Set(bundle.tasks.map((task) => task.slug));
  const exportedLessons = new Set(bundleLessons.map((lesson) => lesson.slug));
  return {
    writes,
    unchanged,
    notInExport: {
      topics: existingTopics.map((topic) => topic.slug).filter((slug) => !exportedTopics.has(slug)),
      tasks: [...existing.tasks.keys()].filter((slug) => !exportedTasks.has(slug)).sort(),
      lessons: [...existing.lessons.values()]
        .flat()
        .map((lesson) => lesson.slug)
        .filter((slug) => !exportedLessons.has(slug))
    }
  };
}
