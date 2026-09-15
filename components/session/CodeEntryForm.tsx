'use client';

/**
 * Join-by-code, step one: the teacher projects a six-character code, and a
 * student types it here. Large and legible per the design brief — this is the
 * field that has to read from the back of the room, even though it is the
 * student's screen rather than the projector doing the reading.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isValidSessionCode, normalizeSessionCode } from '@/lib/session/code';
import { t } from '@/lib/i18n';

export function CodeEntryForm() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [showError, setShowError] = useState(false);

  const normalized = normalizeSessionCode(value);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidSessionCode(normalized)) {
      setShowError(true);
      return;
    }
    router.push(`/s/${normalized}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
      <label htmlFor="session-code" className="text-sm text-ink-muted">
        {t('join.codeLabel')}
      </label>
      <input
        id="session-code"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setShowError(false);
        }}
        placeholder={t('join.codePlaceholder')}
        autoComplete="off"
        autoCapitalize="characters"
        maxLength={9}
        className="w-full max-w-xs rounded-md border border-line bg-surface px-4 py-3 text-center text-3xl font-semibold uppercase tracking-[0.3em] text-ink"
      />
      {showError && <p className="text-sm text-attention">{t('join.invalidCode')}</p>}
      <button
        type="submit"
        className="rounded-md bg-accent px-6 py-2 text-sm text-surface disabled:opacity-50"
      >
        {t('join.submit')}
      </button>
    </form>
  );
}
