/**
 * The topic map (docs/mockups, the topic-map screen): a grade's topics in
 * curriculum order, each with its progress, a state, and where tapping it
 * leads. Pure, like the rest of lib/meta/: the server hands in the grade's
 * lessons and the practice tasks, local progress hands in what is done.
 *
 * Nothing is locked (app/(student)/practice/page.tsx) — content is not tied
 * to the timetable — so every topic leads somewhere. "Current" only says
 * where to carry on: the first topic in order that is not finished.
 */
import { topicProgress, type PracticeTaskMeta } from './progress';

export type TopicState = 'done' | 'current' | 'started' | 'ahead';

export interface TopicMapNode {
  slug: string;
  title: string;
  done: number;
  total: number;
  state: TopicState;
  /** The topic's first unfinished task in lesson order; its first task once all are done, to revisit. */
  href: string;
}

export interface MapLesson {
  slug: string;
  /** In step order, as the lesson list counts them (lib/db/lessons.ts's `LessonListItem`). */
  taskSlugs: string[];
}

export function topicMap(
  lessons: readonly MapLesson[],
  tasks: readonly PracticeTaskMeta[],
  completed: ReadonlySet<string>,
  grade: number
): TopicMapNode[] {
  const topicOf = new Map(tasks.map((task) => [task.slug, task.topicSlug]));

  // Each topic's tasks in the order a student meets them, with the lesson
  // that first lists each one — a task listed twice opens in its first lesson.
  const stepsByTopic = new Map<string, { lesson: string; task: string }[]>();
  const seen = new Set<string>();
  for (const lesson of lessons) {
    for (const task of lesson.taskSlugs) {
      const topic = topicOf.get(task);
      if (!topic || seen.has(task)) continue;
      seen.add(task);
      stepsByTopic.set(topic, [...(stepsByTopic.get(topic) ?? []), { lesson: lesson.slug, task }]);
    }
  }

  let currentFound = false;
  return topicProgress(tasks, completed, grade).flatMap((topic) => {
    const steps = stepsByTopic.get(topic.slug) ?? [];
    const target = steps.find((step) => !completed.has(step.task)) ?? steps[0];
    if (!target) return [];

    let state: TopicState;
    if (topic.done >= topic.total) {
      state = 'done';
    } else if (!currentFound) {
      state = 'current';
      currentFound = true;
    } else {
      state = topic.done > 0 ? 'started' : 'ahead';
    }
    return [{ ...topic, state, href: `/practice/${target.lesson}/${target.task}` }];
  });
}
