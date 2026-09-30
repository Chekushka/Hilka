'use client';

/**
 * A teacher asks for access (POST /api/auth/signup). The answer never says
 * whether the address was already known — the same "request received" for
 * everyone — so this form cannot be used to find out who has an account.
 */
import { useState, type FormEvent } from 'react';
import { t } from '@/lib/i18n';

type Status = 'idle' | 'sending' | 'done' | 'invalid' | 'rate_limited' | 'error';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('sending');
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    }).catch(() => null);
    if (response?.ok) setStatus('done');
    else if (response?.status === 429) setStatus('rate_limited');
    else if (response?.status === 400) setStatus('invalid');
    else setStatus('error');
  }

  if (status === 'done') {
    return (
      <p role="status" className="mt-4 text-ink">
        {t('auth.signupDone')}
      </p>
    );
  }

  const message =
    status === 'invalid'
      ? t('auth.signupInvalid')
      : status === 'rate_limited'
        ? t('auth.signupRateLimited')
        : status === 'error'
          ? t('auth.signupError')
          : null;

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
      <label className="text-sm text-ink-muted" htmlFor="signup-email">
        {t('auth.emailLabel')}
      </label>
      <input
        id="signup-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
      />
      {message && <p className="text-sm text-attention">{message}</p>}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="rounded-md bg-accent px-4 py-2 text-sm text-surface disabled:opacity-50"
      >
        {status === 'sending' ? t('auth.submitting') : t('auth.signupSubmit')}
      </button>
    </form>
  );
}
