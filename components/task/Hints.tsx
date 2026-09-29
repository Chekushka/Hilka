'use client';

/**
 * Hints are revealed one at a time, in order, each more explicit than the last.
 * Using one costs nothing here — a student who asks for help has not failed.
 * Pinned to the bottom of the task panel (WorkspaceFrame), honey-marked like
 * the mockups: help is offered, never pushed.
 */
import { useState } from 'react';
import { t } from '@/lib/i18n';

interface HintsProps {
  hints: string[];
  /** Fired each time another hint is revealed, so a session can count it against the attempt. */
  onReveal?: () => void;
}

export function Hints({ hints, onReveal }: HintsProps) {
  const [shown, setShown] = useState(0);
  if (hints.length === 0) return null;

  return (
    <section aria-label={t('hints.title')} className="flex flex-col gap-2">
      {shown > 0 && (
        <ol className="flex flex-col gap-2">
          {hints.slice(0, shown).map((hint, index) => (
            <li
              key={hint}
              className="rounded-lg border border-line bg-bg px-3.5 py-3 text-sm leading-relaxed text-ink"
            >
              <span className="mb-1 block text-xs text-ink-muted">
                {t('hints.counter', { n: index + 1, total: hints.length })}
              </span>
              {hint}
            </li>
          ))}
        </ol>
      )}
      {shown < hints.length && (
        <button
          type="button"
          onClick={() => {
            setShown(shown + 1);
            onReveal?.();
          }}
          className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-bg px-3.5 py-2.5 text-left text-sm font-semibold text-ink hover:border-honey"
        >
          <span aria-hidden="true" className="h-4 w-4 flex-none rounded-full bg-honey" />
          {shown === 0 ? t('hints.show') : t('hints.next')}
          <span className="flex-1" />
          <span className="text-xs font-normal text-ink-muted">
            {shown}/{hints.length}
          </span>
        </button>
      )}
    </section>
  );
}
