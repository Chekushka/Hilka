'use client';

/**
 * The superuser's page (docs/AI_CONTEXT.md, "Teacher Auth"): requests to
 * approve or reject, teachers with access to disable, disabled ones to let
 * back in, and an address to add directly. Every action is one request and
 * a refresh of the server-rendered lists — no client copy of the data.
 */
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { t } from '@/lib/i18n';

export interface TeacherRow {
  id: string;
  email: string;
  status: 'pending' | 'active' | 'disabled';
  /** Already formatted for display. */
  date: string;
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {note && <p className="text-xs text-ink-muted">{note}</p>}
      {children}
    </section>
  );
}

function Row({ row, dateKey, children }: { row: TeacherRow; dateKey: string; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-2.5 last:border-b-0">
      <span className="min-w-0 flex-1 break-all text-ink">{row.email}</span>
      <span className="text-xs text-ink-muted">{t(dateKey, { date: row.date })}</span>
      <span className="flex gap-2">{children}</span>
    </li>
  );
}

export function TeacherAccessPanel({ teachers }: { teachers: TeacherRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);

  async function act(id: string, request: RequestInit) {
    setBusyId(id);
    setError(null);
    const response = await fetch(`/api/admin/teachers/${id}`, request).catch(() => null);
    setBusyId(null);
    if (!response?.ok) {
      setError(t('admin.actionError'));
      return;
    }
    router.refresh();
  }

  const setStatus = (id: string, status: 'active' | 'disabled') =>
    act(id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setAdding(true);
    setError(null);
    const response = await fetch('/api/admin/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    }).catch(() => null);
    setAdding(false);
    if (!response?.ok) {
      setError(response?.status === 400 ? t('admin.addInvalid') : t('admin.actionError'));
      return;
    }
    setEmail('');
    router.refresh();
  }

  const pending = teachers.filter((row) => row.status === 'pending');
  const active = teachers.filter((row) => row.status === 'active');
  const disabled = teachers.filter((row) => row.status === 'disabled');
  const button = 'rounded-md border px-3 py-1.5 text-sm disabled:opacity-50';

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p role="alert" className="text-sm text-attention">
          {error}
        </p>
      )}

      <Section title={t('admin.pendingTitle')}>
        {pending.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('admin.pendingEmpty')}</p>
        ) : (
          <ul>
            {pending.map((row) => (
              <Row key={row.id} row={row} dateKey="admin.requestedAt">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => setStatus(row.id, 'active')}
                  aria-label={`${t('admin.approve')}: ${row.email}`}
                  className={`${button} border-accent bg-accent text-surface`}
                >
                  {t('admin.approve')}
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => act(row.id, { method: 'DELETE' })}
                  aria-label={`${t('admin.reject')}: ${row.email}`}
                  className={`${button} border-line text-ink`}
                >
                  {t('admin.reject')}
                </button>
              </Row>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('admin.activeTitle')}>
        {active.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('admin.activeEmpty')}</p>
        ) : (
          <ul>
            {active.map((row) => (
              <Row key={row.id} row={row} dateKey="admin.addedAt">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => setStatus(row.id, 'disabled')}
                  aria-label={`${t('admin.disable')}: ${row.email}`}
                  className={`${button} border-line text-ink`}
                >
                  {t('admin.disable')}
                </button>
              </Row>
            ))}
          </ul>
        )}
        <form onSubmit={handleAdd} className="mt-2 flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
            <label className="text-sm text-ink-muted" htmlFor="add-teacher-email">
              {t('admin.addLabel')}
            </label>
            <input
              id="add-teacher-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="rounded-md border border-accent px-4 py-2 text-sm text-accent disabled:opacity-50"
          >
            {t('admin.addSubmit')}
          </button>
          <p className="w-full text-xs text-ink-muted">{t('admin.addHint')}</p>
        </form>
      </Section>

      {disabled.length > 0 && (
        <Section title={t('admin.disabledTitle')} note={t('admin.disabledNote')}>
          <ul>
            {disabled.map((row) => (
              <Row key={row.id} row={row} dateKey="admin.addedAt">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => setStatus(row.id, 'active')}
                  aria-label={`${t('admin.enable')}: ${row.email}`}
                  className={`${button} border-accent text-accent`}
                >
                  {t('admin.enable')}
                </button>
              </Row>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
