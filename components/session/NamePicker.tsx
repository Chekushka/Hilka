'use client';

/**
 * Step two of joining: pick a name from the class list. No typing, no
 * password, no email — the roster is the whole identity model
 * (docs/AI_CONTEXT.md, "Progress Codes" / no accounts for students).
 */
import { t } from '@/lib/i18n';

export function NamePicker({ roster, onPick }: { roster: string[]; onPick: (name: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <h2 className="text-lg font-semibold text-ink">{t('session.pickName')}</h2>
      <ul className="flex max-w-xl flex-wrap justify-center gap-2">
        {roster.map((name) => (
          <li key={name}>
            <button
              type="button"
              onClick={() => onPick(name)}
              className="rounded-md border border-line bg-surface px-4 py-2 text-sm text-ink hover:border-accent"
            >
              {name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
