'use client';

/**
 * Where a practice task sits, at the top of the task panel: the way back (all
 * lessons › this lesson), every task of the lesson as a numbered step — solved
 * ones ticked from local progress, the current one filled — and two plain
 * buttons, back and on. On the last task "on" leads to the next lesson, so a
 * student never reaches a dead end. Students in class could not tell where they
 * were or where to click from the small text links this replaces.
 */
import Link from 'next/link';
import { useLocalProgress } from '@/lib/practice/local-progress';
import { t } from '@/lib/i18n';

export interface PracticeNavStep {
  slug: string;
  title: string;
  href: string;
  additional: boolean;
}

interface PracticeTaskNavProps {
  grade: number;
  lesson: { title: string; href: string; number: number | null };
  steps: PracticeNavStep[];
  current: string;
  /** The previous task, or the lesson itself before the first one. */
  back: { href: string; label: string };
  /** The next task, the next lesson after the last one, or the lesson when there is none. */
  on: { href: string; label: string };
}

const navButton =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-accent bg-surface px-3 py-1.5 text-sm font-bold text-accent hover:bg-accent-soft';

export function PracticeTaskNav({ grade, lesson, steps, current, back, on }: PracticeTaskNavProps) {
  const [progress] = useLocalProgress();
  const done = new Set(progress.completedTaskSlugs);
  const position = steps.findIndex((step) => step.slug === current) + 1;

  return (
    <nav aria-label={t('lessons.navLabel')} className="flex w-full flex-col gap-2.5" data-testid="practice-nav">
      <p className="flex min-w-0 items-center gap-1.5 text-sm">
        <Link href={`/practice?grade=${grade}`} className="flex-none text-accent hover:underline">
          {t('lessons.navLessons')}
        </Link>
        <span aria-hidden="true" className="text-ink-muted">
          ›
        </span>
        <Link href={lesson.href} className="min-w-0 truncate font-semibold text-ink hover:underline">
          {lesson.number === null ? lesson.title : t('lessons.navLesson', { n: lesson.number, title: lesson.title })}
        </Link>
      </p>

      {position > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-ink">{t('task.position', { n: position, total: steps.length })}</p>
          <ol className="flex flex-wrap items-center gap-1.5">
            {steps.map((step, index) => {
              const isCurrent = step.slug === current;
              const isDone = done.has(step.slug);
              const label = t(isDone ? 'lessons.navStepDone' : 'lessons.navStep', { n: index + 1, title: step.title });
              const firstAdditional = step.additional && !steps[index - 1]?.additional;
              return (
                <li key={step.slug} className="flex items-center gap-1.5">
                  {firstAdditional && (
                    <span className="ml-1 text-xs text-ink-muted" aria-hidden="true">
                      {t('lessons.navAdditional')}:
                    </span>
                  )}
                  <Link
                    href={step.href}
                    aria-label={label}
                    title={step.title}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      isCurrent
                        ? 'bg-accent text-surface ring-2 ring-accent ring-offset-2 ring-offset-surface'
                        : isDone
                          ? 'bg-growth text-on-bright hover:brightness-105'
                          : `border-2 bg-surface text-ink hover:border-accent ${
                              step.additional ? 'border-dashed border-ink-muted' : 'border-line'
                            }`
                    }`}
                  >
                    {isDone && !isCurrent ? '✓' : index + 1}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="flex gap-2">
        <Link href={back.href} className={navButton}>
          <span aria-hidden="true">←</span>
          {back.label}
        </Link>
        <Link href={on.href} className={`${navButton} flex-1`}>
          {on.label}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </nav>
  );
}
