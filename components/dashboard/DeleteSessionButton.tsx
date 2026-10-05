'use client';

/**
 * Deletes a session with everything recorded in it (DELETE
 * /api/dashboard/sessions/[id]), after the teacher confirms. Used in a
 * class's session list on the dashboard and on the session's own page, which
 * it leaves for the dashboard once the session is gone.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { t } from '@/lib/i18n';

export function DeleteSessionButton({
  sessionId,
  code,
  homework,
  leaveTo,
  className
}: {
  sessionId: string;
  code: string;
  homework: boolean;
  /** Where to go once deleted; the current page is refreshed when absent. */
  leaveTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove() {
    const question = homework ? 'dashboard.deleteHomeworkConfirm' : 'dashboard.deleteSessionConfirm';
    if (!window.confirm(t(question, { code }))) return;
    setBusy(true);
    setFailed(false);
    const response = await fetch(`/api/dashboard/sessions/${sessionId}`, { method: 'DELETE' }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setFailed(true);
      return;
    }
    if (leaveTo) router.push(leaveTo);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        aria-label={t('dashboard.deleteSessionLabel', { code })}
        className={
          className ??
          'rounded-lg border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-attention hover:text-attention disabled:opacity-50'
        }
      >
        {t('dashboard.deleteSession')}
      </button>
      {failed && (
        <span className="text-sm text-attention" role="status">
          {t('dashboard.actionFailed')}
        </span>
      )}
    </>
  );
}
