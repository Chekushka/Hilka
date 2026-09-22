'use client';

/**
 * Catches anything a server component throws below the root layout —
 * notably a Neon connection failure mid-lesson (docs/TASKS.md Open
 * Questions: "What a student should see when the database is unreachable").
 * Without this, Next falls back to its own generic error page, in English.
 *
 * Deliberately generic: there is no reliable way to tell a connection
 * failure from any other unexpected error at this boundary, and guessing
 * wrong would mislead more than saying nothing specific. A task that is
 * merely unpublished or a session that is closed are different, calmer,
 * more specific screens reached through next/navigation's notFound()
 * (app/(student)/practice/not-found.tsx, app/(student)/s/[code]/not-found.tsx),
 * not through this boundary — this one is only for the unexpected.
 *
 * The root layout (app/layout.tsx) does not touch the database, so an error
 * there — which this boundary cannot catch — is not a case this needs to
 * cover yet.
 */
import { useEffect } from 'react';
import { t } from '@/lib/i18n';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-ink">{t('error.title')}</h1>
      <p className="mt-2 text-ink-muted">{t('error.note')}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 w-fit rounded-md bg-accent px-4 py-2 text-sm text-surface"
      >
        {t('error.retry')}
      </button>
    </main>
  );
}
