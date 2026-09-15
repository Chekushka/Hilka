import { t } from '@/lib/i18n';

/**
 * An unknown or closed session code. Never the student's fault, and never a
 * hint about which of the two it was — that distinction is for the teacher.
 */
export default function SessionNotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-ink">{t('session.closedTitle')}</h1>
      <p className="mt-2 text-ink-muted">{t('session.closedNote')}</p>
    </main>
  );
}
