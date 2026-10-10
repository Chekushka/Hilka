'use client';

/**
 * The one obvious way into a lesson: its first task, or — once some are
 * solved — the first one not solved yet, read from local practice progress.
 */
import Link from 'next/link';
import { useLocalProgress } from '@/lib/practice/local-progress';
import { t } from '@/lib/i18n';

export function LessonStart({ steps }: { steps: { slug: string; href: string }[] }) {
  const [progress] = useLocalProgress();
  if (steps.length === 0) return null;
  const done = new Set(progress.completedTaskSlugs);
  const firstOpen = steps.findIndex((step) => !done.has(step.slug));
  const started = steps.some((step) => done.has(step.slug));

  if (firstOpen < 0) {
    return (
      <p className="flex items-center gap-2 text-base font-semibold text-growth" data-testid="lesson-start">
        <span aria-hidden="true">✓</span>
        {t('lessons.lessonAllDone')}
      </p>
    );
  }
  return (
    <Link
      href={steps[firstOpen].href}
      data-testid="lesson-start"
      className="inline-flex min-h-12 items-center gap-2.5 rounded-xl bg-accent px-6 py-3 text-base font-bold text-surface hover:brightness-110"
    >
      {started ? t('lessons.continueLesson', { n: firstOpen + 1 }) : t('lessons.startLesson')}
      <span aria-hidden="true">→</span>
    </Link>
  );
}
