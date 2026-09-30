'use client';

/**
 * Console output for `code`/`fix`/`fill` — plain text, plus a live answer
 * line while the student's own program is inside `input()`. Shared because
 * all three task types run through `useTaskRunner`'s single `pendingInputPrompt`
 * / `submitInput` pair (lib/task/use-task-runner.ts). Lives in the result
 * dock (WorkspaceDock), set large enough to read from the back row.
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
    <div>
      <p className="text-xs font-medium text-ink-muted">{t('workspace.output')}</p>
      <pre className="mt-1 whitespace-pre-wrap font-mono text-base leading-relaxed text-ink">
        {stdout || (waiting ? '' : <span className="font-sans text-sm text-ink-muted">{t('workspace.outputEmpty')}</span>)}
      </pre>
      {waiting && (
        <div className="mt-2 flex items-center gap-2">
          {pendingInputPrompt && <span className="font-mono text-base text-ink">{pendingInputPrompt}</span>}
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
            aria-label={t('workspace.inputLabel')}
            className="flex-1 rounded-md border-2 border-accent bg-surface px-2 py-1 font-mono text-base text-ink"
          />
          <button type="button" onClick={submit} className="rounded-md bg-accent px-3 py-1.5 text-sm text-surface">
            {t('workspace.inputSubmit')}
          </button>
        </div>
      )}
    </div>
  );
}
