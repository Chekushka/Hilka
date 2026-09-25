'use client';

/** One section of a lesson's tasks (core or additional), each marked done from localStorage practice progress. */
import Link from 'next/link';
import { useLocalProgress } from '@/lib/practice/local-progress';
import { t } from '@/lib/i18n';
import type { LessonTaskSummary } from '@/lib/lessons/view';

interface LessonTaskListProps {
  lessonSlug: string;
  tasks: LessonTaskSummary[];
}

export function LessonTaskList({ lessonSlug, tasks }: LessonTaskListProps) {
  const [progress] = useLocalProgress();
  const done = new Set(progress.completedTaskSlugs);

  return (
    <ol className="flex flex-col gap-1.5">
      {tasks.map((task, i) => {
        const isDone = done.has(task.slug);
        const label = (
          <>
            <span className="w-6 shrink-0 text-sm text-ink-muted">{i + 1}.</span>
            <span className="flex-1 text-ink">{task.title}</span>
            {task.sessionOnly ? (
              <span className="text-xs text-ink-muted">{t('lessons.sessionOnly')}</span>
            ) : isDone ? (
              <span className="text-sm text-growth">✓ {t('lessons.taskDone')}</span>
            ) : null}
          </>
        );
        return (
          <li key={task.slug}>
            {task.sessionOnly ? (
              <div className="flex items-center gap-3 rounded-md border border-line px-3 py-2 opacity-70">{label}</div>
            ) : (
              <Link
                href={`/practice/${lessonSlug}/${task.slug}`}
                className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 hover:border-accent"
              >
                {label}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
