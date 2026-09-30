import { JoinByCodeForm } from '@/components/entry/JoinByCodeForm';
import { t } from '@/lib/i18n';

/**
 * An unknown or closed session code. Never the student's fault, and never a
 * hint about which of the two it was — that distinction is for the teacher.
 * The code field is right here, so a mistyped letter is one retype away.
 */
export default function SessionNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-ink">{t('session.closedTitle')}</h1>
      <p className="mt-2 text-ink-muted">{t('session.closedNote')}</p>
      <section aria-label={t('session.tryAnotherCode')} className="mt-6 rounded-xl border border-line bg-surface p-6">
        <JoinByCodeForm autoFocus />
      </section>
    </main>
  );
}
