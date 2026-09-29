'use client';

/**
 * Join-by-code (docs/design-brief-python-platform.md, "Entry"): the teacher
 * puts a six-character code on the projector and the student types it here.
 * The field is the largest thing on the page and set in the code face — it is
 * something the student typed, and 0/O and 1/I must not blur together.
 *
 * Only navigates: whether the session exists is for /s/[code] to say, on the
 * same calm screen for an unknown and a closed code.
 */
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { t } from '@/lib/i18n';
import { isCompleteSessionCode, normalizeSessionCode, SESSION_CODE_LENGTH } from '@/lib/session/code';

export function JoinByCodeForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [going, setGoing] = useState(false);
  const ready = isCompleteSessionCode(code);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setGoing(true);
    router.push(`/s/${code}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="session-code" className="text-sm font-medium text-ink">
        {t('home.codeLabel')}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="session-code"
          name="code"
          value={code}
          onChange={(event) => setCode(normalizeSessionCode(event.target.value))}
          placeholder={'·'.repeat(SESSION_CODE_LENGTH)}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="session-code-hint"
          className="min-w-0 flex-1 rounded-lg border-2 border-line bg-code-bg px-4 py-3 text-center font-mono text-4xl font-medium uppercase tracking-[0.3em] text-ink placeholder:text-line focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={!ready || going}
          className="rounded-lg bg-accent px-6 py-3 text-lg font-semibold text-surface disabled:opacity-50"
        >
          {going ? t('home.joining') : t('home.join')}
        </button>
      </div>
      <p id="session-code-hint" className="text-sm text-ink-muted">
        {t('home.codeHint')}
      </p>
    </form>
  );
}
