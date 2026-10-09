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
        // Numbered and typed, a done task ticked — the same row as a session's task list.
        const label = (
          <>
            <span
              aria-hidden="true"
              className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm font-bold ${
                isDone ? 'bg-growth text-surface' : 'bg-accent-soft text-accent'
              }`}
            >
              {isDone ? '✓' : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink">{task.title}</span>
              <span className="block text-xs text-ink-muted">{t(`task.types.${task.type}`)}</span>
            </span>
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
              <div className="flex items-center gap-3 rounded-lg border-2 border-line px-3 py-2 opacity-70">{label}</div>
            ) : (
              <Link
                href={`/practice/${lessonSlug}/${task.slug}`}
                className={`flex items-center gap-3 rounded-lg border-2 bg-surface px-3 py-2 hover:border-accent ${
                  isDone ? 'border-growth/60' : 'border-line'
                }`}
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
