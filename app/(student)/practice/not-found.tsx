import { t } from '@/lib/i18n';

/**
 * What a student sees when the task they opened is not published. Calm, and
 * never their fault — the same tone as a failed check.
 */
export default function PracticeNotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-ink">{t('practice.emptyTitle')}</h1>
      <p className="mt-2 text-ink-muted">{t('practice.emptyNote')}</p>
    </main>
  );
}
