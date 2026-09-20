'use client';

/**
 * Console output for `code`/`fix`/`fill` — plain text, plus a live answer
 * line while the student's own program is inside `input()`. Shared because
 * all three task types run through `useTaskRunner`'s single `pendingInputPrompt`
 * / `submitInput` pair (lib/task/use-task-runner.ts).
 */
import { useState } from 'react';
import { t } from '@/lib/i18n';

interface OutputPanelProps {
  stdout: string;
  /** From `useTaskRunner`. `null` outside of an `input()` wait. */
  pendingInputPrompt: string | null;
  onSubmitInput: (value: string) => void;
}

export function OutputPanel({ stdout, pendingInputPrompt, onSubmitInput }: OutputPanelProps) {
  const [draft, setDraft] = useState('');
  const waiting = pendingInputPrompt !== null;

  function submit() {
    onSubmitInput(draft);
    setDraft('');
  }

  return (
    <div className="min-w-[220px] flex-1">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{t('workspace.output')}</p>
      <pre className="mt-1 min-h-[3rem] whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
        {stdout || (waiting ? '' : t('workspace.outputEmpty'))}
      </pre>
      {waiting && (
        <div className="mt-2 flex items-center gap-2">
          {pendingInputPrompt && <span className="font-mono text-sm text-ink">{pendingInputPrompt}</span>}
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
            aria-label={t('workspace.inputLabel')}
            className="flex-1 rounded-md border border-accent bg-surface px-2 py-1 font-mono text-sm text-ink"
          />
          <button
            type="button"
            onClick={submit}
            className="rounded-md bg-accent px-3 py-1 text-sm text-surface"
          >
            {t('workspace.inputSubmit')}
          </button>
        </div>
      )}
    </div>
  );
}
