import { CodeEntryForm } from '@/components/session/CodeEntryForm';
import { t } from '@/lib/i18n';

/**
 * Join-by-code landing page. No task content lives here — this is purely the
 * hand-off from "the teacher read out a code" to `/s/[code]`.
 */
export default function JoinPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold text-ink">{t('join.title')}</h1>
      <CodeEntryForm />
    </main>
  );
}
