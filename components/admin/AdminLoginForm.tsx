'use client';

/** The superuser's login and password (POST /api/admin/login). One message for any refusal. */
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { t } from '@/lib/i18n';

export function AdminLoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password })
    }).catch(() => null);
    setSending(false);
    if (response?.ok) {
      router.push('/admin');
      router.refresh();
      return;
    }
    setPassword('');
    setError(
      response?.status === 429
        ? t('admin.rateLimited')
        : response?.status === 503
          ? t('admin.notConfigured')
          : response?.status === 401
            ? t('admin.invalid')
            : t('admin.error')
    );
  }

  const field = 'rounded-md border border-line bg-surface px-3 py-2 text-ink';
  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
      <label className="text-sm text-ink-muted" htmlFor="admin-login">
        {t('admin.loginLabel')}
      </label>
      <input
        id="admin-login"
        required
        autoComplete="username"
        value={login}
        onChange={(event) => setLogin(event.target.value)}
        className={field}
      />
      <label className="text-sm text-ink-muted" htmlFor="admin-password">
        {t('admin.passwordLabel')}
      </label>
      <input
        id="admin-password"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className={field}
      />
      {error && (
        <p role="alert" className="text-sm text-attention">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="rounded-md bg-accent px-4 py-2 text-sm text-surface disabled:opacity-50"
      >
        {sending ? t('admin.submitting') : t('admin.submit')}
      </button>
    </form>
  );
}
