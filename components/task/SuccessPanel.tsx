'use client';

/**
 * The success moment (docs/design-brief-python-platform.md, "The success
 * state"; docs/mockups, the success screen): the one place generosity is
 * allowed. When a Check passes, the top of the task panel opens into this —
 * a large badge, the word, what the pass earned, and the way on — while the
 * code and the drawing stay where they were, because for a turtle task the
 * drawing itself is the reward. Nothing covers the screen and nothing has to
 * be dismissed.
 *
 * It should feel like something opened, not like a scoreboard incremented:
 * one short opening movement when it appears (app/globals.css, off under
 * reduced motion), then stillness. No confetti, no sound, no counter
 * ticking up.
 */
import { useEffect, useRef } from 'react';
import { Plant } from '@/components/meta/Plant';
import { NextTaskButton, type NextTaskAction } from './NextTaskButton';
import { t } from '@/lib/i18n';

export function SuccessPanel({ next }: { next?: NextTaskAction }) {
  const reward = next?.reward;
  const nextRef = useRef<HTMLDivElement>(null);

  // The way on is the obvious next thing, so it takes the keyboard focus —
  // Enter moves on without hunting for the button.
  useEffect(() => {
    nextRef.current?.querySelector<HTMLElement>('a, button')?.focus({ preventScroll: true });
  }, []);

  return (
    <section
      aria-labelledby="success-title"
      aria-live="polite"
      className="success-open border-b border-line bg-surface px-5 pb-6 pt-7"
    >
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden="true"
          className="success-badge flex h-20 w-20 items-center justify-center rounded-full bg-growth text-4xl font-bold text-surface"
        >
          ✓
        </span>
        <h2 id="success-title" className="mt-4 text-3xl font-bold tracking-tight text-ink">
          {t('result.passed')}
        </h2>
        <p className="mt-1 text-base text-ink-muted">{t('result.passedNote')}</p>
      </div>

      {reward && (
        <div className="mt-5 flex flex-col gap-2.5">
          <div className="rounded-lg bg-bg px-4 py-3">
            <p className="text-xs text-ink-muted">{t('result.earned')}</p>
            <p className="mt-1 flex items-center gap-2.5 text-xl font-bold text-ink">
              <span aria-hidden="true" className="h-3.5 w-3.5 rounded bg-honey" />
              <span data-testid="xp-earned">{reward.xp}</span>
            </p>
          </div>
          {reward.growth && (
            <div className="flex items-center gap-3 rounded-lg bg-bg px-4 py-3">
              <Plant stage={reward.growth.stage} size={36} />
              <div className="min-w-0">
                <p className="text-xs text-ink-muted">{t('result.garden')}</p>
                <p className="mt-0.5 text-sm font-medium text-growth" data-testid="garden-growth">
                  {reward.growth.label}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {next && (
        <div ref={nextRef} className="mt-5">
          <NextTaskButton
            action={next}
            className="flex w-full items-center justify-center rounded-lg bg-accent px-5 py-3 text-base font-semibold text-surface"
          />
        </div>
      )}
    </section>
  );
}
