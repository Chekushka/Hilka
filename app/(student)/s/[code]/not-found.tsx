import { t } from '@/lib/i18n';

/**
 * A code that is invalid, unknown, or closed all land here. Which one it was
 * is not the student's problem — same principle as practice's empty state.
 */
export default function SessionNotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-ink">{t('session.unavailableTitle')}</h1>
      <p className="mt-2 text-ink-muted">{t('session.unavailableNote')}</p>
    </main>
  );
}
