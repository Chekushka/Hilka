'use client';

/**
 * "Continue with a progress code" on the entry page: a student who practised
 * on another machine types their code here and lands on the lessons with
 * that progress merged into this device (docs/AI_CONTEXT.md, "Progress
 * Codes") — the same restore the practice page offers, one step sooner.
 */
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { t } from '@/lib/i18n';
import { normalizeProgressCode } from '@/lib/practice/code';
import { saveLocalProgressCode, useLocalProgress } from '@/lib/practice/local-progress';
import { mergeProgress } from '@/lib/practice/progress';
import { RESTORE_FAILURE_MESSAGE, requestRestore } from '@/lib/practice/restore';

export function ContinueWithCodeForm() {
  const router = useRouter();
  const [, setProgress] = useLocalProgress();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const outcome = await requestRestore(code);
    if (!outcome.ok) {
      setBusy(false);
      setError(t(RESTORE_FAILURE_MESSAGE[outcome.reason]));
      return;
    }
    setProgress((previous) => mergeProgress(previous, outcome.state));
    saveLocalProgressCode(normalizeProgressCode(code));
    router.push('/practice');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="continue-code" className="text-sm text-ink-muted">
        {t('home.continueLabel')}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="continue-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABCD-EFGH"
          className="w-36 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 font-mono text-base tracking-wider text-ink uppercase placeholder:text-ink-muted/60"
        />
        <button
          type="submit"
          disabled={busy || code.trim() === ''}
          className="rounded-lg bg-accent px-4 py-2 font-semibold text-surface disabled:opacity-50"
        >
          {busy ? t('practice.restoring') : t('home.continueButton')}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-attention">
          {error}
        </p>
      )}
    </form>
  );
}
