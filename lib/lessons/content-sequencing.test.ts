import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isFileDelivery, unsequencedFileTasks, type SequencedTask } from '@/lib/task/prerequisite';
import type { TaskType } from '@/lib/task/types';
import type { LessonContent } from './types';

/**
 * The file-delivery sequencing rule (lib/task/prerequisite.ts) held against
 * the lessons committed in content/ — the authoring forms only warn, so this
 * is what stops seeded content from breaking the rule.
 */

const contentDir = path.join(process.cwd(), 'content');

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

const tasksBySlug = new Map<string, SequencedTask>();
for (const file of readdirSync(path.join(contentDir, 'seed-tasks')).filter((name) => name.endsWith('.json'))) {
  const task = readJson<{ slug: string; topicSlug: string; type: TaskType; payload: unknown }>(
    path.join(contentDir, 'seed-tasks', file)
  );
  tasksBySlug.set(task.slug, {
    id: task.slug,
    topicKey: task.topicSlug,
    type: task.type,
    fileDelivery: isFileDelivery(task.payload)
  });
}

const lessons = readdirSync(path.join(contentDir, 'lessons'))
  .filter((name) => name.endsWith('.json'))
  .flatMap((file) => readJson<LessonContent[]>(path.join(contentDir, 'lessons', file)));

describe('content lessons', () => {
  it('include at least one file-delivery task, so the rule below is not vacuous', () => {
    const slugs = lessons.flatMap((lesson) => [...lesson.coreTaskSlugs, ...lesson.additionalTaskSlugs]);
    expect(slugs.some((slug) => tasksBySlug.get(slug)?.fileDelivery)).toBe(true);
  });

  it.each(lessons.map((lesson) => [lesson.slug, lesson] as const))(
    '%s places every file-delivery task after an in-browser task on its topic',
    (_slug, lesson) => {
      const sequence = [...lesson.coreTaskSlugs, ...lesson.additionalTaskSlugs]
        .map((slug) => tasksBySlug.get(slug))
        .filter((task): task is SequencedTask => task !== undefined);
      expect(unsequencedFileTasks(sequence).map((task) => task.id)).toEqual([]);
    }
  );
});
