'use client';

/**
 * Requests a magic link. No email provider is wired up yet (docs/TASKS.md),
 * so a non-production response includes the link directly — shown here as an
 * honest "this isn't emailed yet" note rather than pretending it was sent.
 */
import { useState, type FormEvent } from 'react';
import { t } from '@/lib/i18n';

interface RequestLinkResponse {
  ok: boolean;
  devLoginUrl?: string;
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [devLoginUrl, setDevLoginUrl] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('sending');
    const response = await fetch('/api/auth/request-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data: RequestLinkResponse = await response.json();
    setDevLoginUrl(data.devLoginUrl ?? null);
    setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <div className="mt-4">
        <p className="text-ink">{t('auth.requested')}</p>
        {devLoginUrl && (
          <div className="mt-4 rounded-md border border-line bg-code-bg p-3">
            <p className="text-xs text-ink-muted">{t('auth.devNote')}</p>
            <a href={devLoginUrl} className="mt-1 block break-all font-mono text-sm text-accent">
              {devLoginUrl}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
      <label className="text-sm text-ink-muted" htmlFor="teacher-email">
        {t('auth.emailLabel')}
      </label>
      <input
        id="teacher-email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
      />
      <button
        type="submit"
        disabled={status === 'sending'}
        className="rounded-md bg-accent px-4 py-2 text-sm text-surface disabled:opacity-50"
      >
        {status === 'sending' ? t('auth.submitting') : t('auth.submit')}
      </button>
    </form>
  );
}
