'use client';

/**
 * Hints are revealed one at a time, in order, each more explicit than the last.
 * Using one costs nothing here — a student who asks for help has not failed.
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
    <section className="mt-4">
      <h3 className="text-sm font-semibold text-ink-muted">{t('hints.title')}</h3>
      <ol className="mt-2 space-y-2">
        {hints.slice(0, shown).map((hint, index) => (
          <li key={hint} className="rounded-md bg-accent-soft px-3 py-2 text-sm text-ink">
            <span className="mr-2 text-xs text-ink-muted">
              {t('hints.counter', { n: index + 1, total: hints.length })}
            </span>
            {hint}
          </li>
        ))}
      </ol>
      {shown < hints.length && (
        <button
          type="button"
          onClick={() => {
            setShown(shown + 1);
            onReveal?.();
          }}
          className="mt-2 rounded-md border border-accent px-3 py-1.5 text-sm text-accent"
        >
          {shown === 0 ? t('hints.show') : t('hints.next')}
        </button>
      )}
    </section>
  );
}
