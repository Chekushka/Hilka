/**
 * XP and topic progress for practice mode (docs/TASKS.md, "Meta Layer").
 * Pure: the database layer hands in the tasks a student can open in practice,
 * local progress hands in the slugs already passed, and this decides what the
 * student sees.
 *
 * XP is **derived**, never stored: the sum of `XP_BY_DIFFICULTY` over the
 * completed tasks that still exist. That keeps a progress-code merge (a union
 * of slugs) automatically consistent, lets a difficulty change re-price old
 * work without a migration, and means a slug whose task was removed simply
 * stops counting instead of leaving phantom XP behind.
 */

export type Difficulty = 1 | 2 | 3 | 4 | 5;

/** Harder tasks are worth more, but an easy win still counts — the first reward must come quickly. */
export const XP_BY_DIFFICULTY: Record<Difficulty, number> = { 1: 10, 2: 20, 3: 30, 4: 40, 5: 50 };

export interface PracticeTaskMeta {
  slug: string;
  difficulty: Difficulty;
  topicSlug: string;
  topicTitle: string;
  topicOrder: number;
  /** Grades of the lessons the task sits in — what topic progress is scoped to. */
  grades: number[];
}

export interface TopicProgress {
  slug: string;
  title: string;
  /** `topics.order` — also what picks the topic's kind of plant (lib/meta/garden.ts). */
  order: number;
  done: number;
  total: number;
}

export function taskXp(difficulty: Difficulty): number {
  return XP_BY_DIFFICULTY[difficulty];
}

/** Every task counted once, however many lessons list it; slugs with no matching task earn nothing. */
export function totalXp(tasks: readonly PracticeTaskMeta[], completed: ReadonlySet<string>): number {
  const counted = new Set<string>();
  let xp = 0;
  for (const task of tasks) {
    if (!completed.has(task.slug) || counted.has(task.slug)) continue;
    counted.add(task.slug);
    xp += taskXp(task.difficulty);
  }
  return xp;
}

/** A grade's topics in curriculum order, each with how many of its practice tasks are done. */
export function topicProgress(
  tasks: readonly PracticeTaskMeta[],
  completed: ReadonlySet<string>,
  grade: number
): TopicProgress[] {
  const byTopic = new Map<string, { title: string; order: number; slugs: Set<string> }>();
  for (const task of tasks) {
    if (!task.grades.includes(grade)) continue;
    const topic = byTopic.get(task.topicSlug) ?? { title: task.topicTitle, order: task.topicOrder, slugs: new Set() };
    topic.slugs.add(task.slug);
    byTopic.set(task.topicSlug, topic);
  }
  return [...byTopic.entries()]
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([slug, topic]) => ({
      slug,
      title: topic.title,
      order: topic.order,
      done: [...topic.slugs].filter((taskSlug) => completed.has(taskSlug)).length,
      total: topic.slugs.size
    }));
}
