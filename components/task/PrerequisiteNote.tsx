'use client';

/**
 * Shown above a file-delivery task whose in-browser prerequisite the student
 * has not passed yet (lib/task/prerequisite.ts). Advice, never a lock: the
 * task below stays fully usable, because the "not passed" it is based on is
 * one browser's memory and can be wrong.
 */
import Link from 'next/link';
import { t } from '@/lib/i18n';

export type PrerequisiteAction =
  | { kind: 'link'; title: string; href: string }
  | { kind: 'button'; title: string; onSelect: () => void };

export function PrerequisiteNote({ action }: { action: PrerequisiteAction }) {
  const label = t('file.prerequisiteOpen', { title: action.title });
  return (
    <aside data-testid="file-prerequisite" className="mx-auto mt-4 max-w-6xl px-6">
      <div className="rounded-md border-l-4 border-accent bg-surface p-4 text-sm text-ink">
        <p>{t('file.prerequisite', { title: action.title })}</p>
        <p className="mt-1 text-ink-muted">{t('file.prerequisiteAnyway')}</p>
        {action.kind === 'link' ? (
          <Link href={action.href} className="mt-2 inline-block text-accent">
            {label}
          </Link>
        ) : (
          <button type="button" onClick={action.onSelect} className="mt-2 text-accent">
            {label}
          </button>
        )}
      </div>
    </aside>
  );
}
