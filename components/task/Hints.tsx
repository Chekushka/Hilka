'use client';

/**
 * Hints are revealed one at a time, in order, each more explicit than the last.
 * Using one costs nothing here — a student who asks for help has not failed.
 * Right under the statement in the task panel (WorkspaceFrame), in a honey
 * block that is easy to spot: offered, never pushed — but students in class
 * did not notice it at the bottom of the panel, so it is no longer hidden.
 */
import { useState } from 'react';
import { t } from '@/lib/i18n';

interface HintsProps {
  hints: string[];
  /** Fired each time another hint is revealed, so a session can count it against the attempt. */
  onReveal?: () => void;
}

/** A light bulb. Decorative — the button says what it does. */
function BulbIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 flex-none">
      <path
        d="M10 2.5a5.5 5.5 0 0 0-3.2 10c.5.4.7.9.7 1.5v.5h5v-.5c0-.6.2-1.1.7-1.5A5.5 5.5 0 0 0 10 2.5Z"
        fill="currentColor"
      />
      <rect x="7.5" y="15.5" width="5" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

export function Hints({ hints, onReveal }: HintsProps) {
  const [shown, setShown] = useState(0);
  if (hints.length === 0) return null;

  return (
    <section
      aria-label={t('hints.title')}
      data-testid="hints"
      className="flex flex-col gap-2.5 rounded-xl border-2 border-honey bg-honey-soft p-3"
    >
      {shown === 0 && (
        <p className="flex items-center gap-2 px-1 text-sm font-semibold text-honey-ink">
          <BulbIcon />
          {t('hints.stuck')}
        </p>
      )}
      {shown > 0 && (
        <ol className="flex flex-col gap-2">
          {hints.slice(0, shown).map((hint, index) => (
            <li
              key={hint}
              className="rounded-lg border-l-4 border-honey bg-surface px-3.5 py-3 text-base leading-relaxed text-ink"
            >
              <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-honey-ink">
                <BulbIcon />
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
          className="flex w-full items-center gap-2.5 rounded-lg bg-honey px-3.5 py-2.5 text-left text-sm font-bold text-on-bright hover:brightness-105"
        >
          {shown === 0 ? t('hints.show') : t('hints.next')}
          <span className="flex-1" />
          <span className="text-xs font-semibold">
            {shown}/{hints.length}
          </span>
        </button>
      )}
    </section>
  );
}
