'use client';

/**
 * A grade's lessons in order. Client-side only for the "done" counts, which
 * come from localStorage practice progress; everything else was read by the
 * server page (CLAUDE.md rule 4).
 */
import Link from 'next/link';
import { useLocalProgress } from '@/lib/practice/local-progress';
import { t } from '@/lib/i18n';
import type { LessonKind } from '@/lib/lessons/types';

// Mirrors the server's lesson list item — a client component cannot reach the database layer (CLAUDE.md rule 4).
export interface LessonListEntry {
  slug: string;
  order: number;
  kind: LessonKind;
  title: string;
  taskSlugs: string[];
}

export function LessonList({ lessons }: { lessons: LessonListEntry[] }) {
  const [progress] = useLocalProgress();
  const done = new Set(progress.completedTaskSlugs);

  return (
    <ol className="flex flex-col gap-2">
      {lessons.map((lesson) => {
        const doneCount = lesson.taskSlugs.filter((slug) => done.has(slug)).length;
        const complete = lesson.taskSlugs.length > 0 && doneCount === lesson.taskSlugs.length;
        return (
          <li key={lesson.slug}>
            <Link
              href={`/practice/${lesson.slug}`}
              className={`flex items-center gap-4 rounded-lg border bg-surface px-4 py-3 hover:border-accent ${
                lesson.kind === 'practice' ? 'border-dashed border-line' : 'border-line'
              }`}
            >
              <span className="w-16 shrink-0 text-xs text-ink-muted">{t('lessons.lessonNumber', { n: lesson.order })}</span>
              <span className="flex flex-1 flex-col">
                <span className="font-medium text-ink">{lesson.title}</span>
                <span className="text-xs text-ink-muted">
                  {lesson.kind === 'mandatory'
                    ? t('lessons.kindMandatory')
                    : `${t('lessons.kindPractice')} · ${t('lessons.practiceNote')}`}
                </span>
              </span>
              <span className={`text-sm ${complete ? 'text-growth' : 'text-ink-muted'}`}>
                {complete ? '✓ ' : ''}
                {t('lessons.tasksDone', { done: doneCount, total: lesson.taskSlugs.length })}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
