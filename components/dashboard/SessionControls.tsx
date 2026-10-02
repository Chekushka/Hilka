'use client';

/**
 * The teacher's actions on a session: move a homework's deadline, and close
 * the session — its code stops working and returns to the pool. Before
 * homework, nothing closed a session at all. Each action re-reads the page.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { t } from '@/lib/i18n';

const pad = (n: number) => String(n).padStart(2, '0');

/** An ISO time as a datetime-local value on this computer's clock. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SessionControls({ sessionId, dueAt }: { sessionId: string; dueAt: string | null }) {
  const router = useRouter();
  const [due, setDue] = useState(dueAt ? toLocalInput(dueAt) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function send(body: object) {
    setBusy(true);
    setError(false);
    const response = await fetch(`/api/dashboard/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError(true);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {dueAt !== null && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (due) void send({ action: 'due', dueAt: new Date(due).toISOString() });
          }}
        >
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            {t('dashboard.dueChangeLabel')}
            <input
              type="datetime-local"
              value={due}
              onChange={(event) => setDue(event.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-ink"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !due}
            className="rounded-lg border border-accent px-3 py-1.5 text-sm text-accent disabled:opacity-50"
          >
            {t('dashboard.dueChangeSave')}
          </button>
        </form>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (window.confirm(t('dashboard.closeSessionConfirm'))) void send({ action: 'close' });
        }}
        className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-muted hover:text-ink disabled:opacity-50"
      >
        {t('dashboard.closeSession')}
      </button>
      {error && <p className="text-sm text-attention">{t('dashboard.actionFailed')}</p>}
    </div>
  );
}
