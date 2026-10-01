'use client';

/**
 * Console output for `code`/`fix`/`fill` — plain text, plus a live answer
 * line while the student's own program is inside `input()`. Shared because
 * all three task types run through `useTaskRunner`'s single `pendingInput`
 * / `submitInput` pair (lib/task/use-task-runner.ts). The answer line names
 * the program line that is asking: with two bare `input()` calls in a row,
 * an empty field alone does not say whether it wants the first number or
 * the second. Lives in the result
 * dock (WorkspaceDock), set large enough to read from the back row.
 */
import { useState } from 'react';
import { t } from '@/lib/i18n';
import type { PendingInput } from '@/lib/task/use-task-runner';

interface OutputPanelProps {
  stdout: string;
  /** From `useTaskRunner`. `null` outside of an `input()` wait. */
  pendingInput: PendingInput | null;
  onSubmitInput: (value: string) => void;
}

export function OutputPanel({ stdout, pendingInput, onSubmitInput }: OutputPanelProps) {
  const [draft, setDraft] = useState('');
  const waiting = pendingInput !== null;

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
      {pendingInput && (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm text-ink-muted" data-testid="input-asking">
          <span>
            {pendingInput.line === null
              ? t('workspace.inputWaiting')
              : t('workspace.inputWaitingLine', { line: pendingInput.line })}
          </span>
          {pendingInput.source && (
            <code className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-base text-ink">{pendingInput.source}</code>
          )}
        </p>
      )}
      {pendingInput && (
        <div className="mt-2 flex items-center gap-2">
          {pendingInput.prompt && <span className="font-mono text-base text-ink">{pendingInput.prompt}</span>}
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
