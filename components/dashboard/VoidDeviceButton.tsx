'use client';

/**
 * Cancels what one device did under a student's name (docs/HOMEWORK.md,
 * section 2) — for when someone else worked as them. Asks first; the attempts
 * stay visible on the card, marked, and stop counting.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { t } from '@/lib/i18n';

export function VoidDeviceButton({
  sessionId,
  studentName,
  deviceId,
  number
}: {
  sessionId: string;
  studentName: string;
  deviceId: string;
  number: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function cancel() {
    if (!window.confirm(t('dashboard.deviceVoidConfirm', { n: number, name: studentName }))) return;
    setBusy(true);
    setError(false);
    const response = await fetch(`/api/dashboard/sessions/${sessionId}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName, deviceId })
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError(true);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-muted hover:border-attention hover:text-ink disabled:opacity-50"
      >
        {t('dashboard.deviceVoid', { n: number })}
      </button>
      {error && <span className="text-xs text-attention">{t('dashboard.actionFailed')}</span>}
    </>
  );
}
