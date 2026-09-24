'use client';

/**
 * Same screen as `code` (CodeTaskView) — the only difference is what the
 * editor starts with: `payload.broken` instead of `payload.starter`. Kept as
 * its own file rather than a shared component, same as quiz/predict's
 * near-identical result panels — one file per task type
 * (docs/AI_CONTEXT.md, "Every task type implements one shared component
 * interface").
 */
import { useEffect, useRef, useState } from 'react';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { PlaybackScrubber } from '@/components/canvas/PlaybackScrubber';
import { FileDelivery } from '@/components/task/FileDelivery';
import { Hints } from '@/components/task/Hints';
import { OutputPanel } from '@/components/task/OutputPanel';
import { ResultPanel } from '@/components/task/ResultPanel';
import { t } from '@/lib/i18n';
import { useTaskRunner } from '@/lib/task/use-task-runner';
import type { AttemptOutcome, FixTask } from '@/lib/task/types';

interface FixTaskViewProps {
  task: FixTask;
  /** Fired once per completed Check. Absent in plain practice — only a session records attempts. */
  onSubmitAttempt?: (outcome: AttemptOutcome) => void;
  hintsEnabled?: boolean;
}

export function FixTaskView({ task, onSubmitAttempt, hintsEnabled = true }: FixTaskViewProps) {
  // File delivery: the code arrives by upload, not typing — nothing to run until it does.
  const fileSpec = task.payload.delivery === 'file' ? task.payload.file : undefined;
  const [code, setCode] = useState(fileSpec ? '' : task.payload.broken);
  const { engine, busy, result, report, target, pendingInputPrompt, run, check, submitInput, parse } = useTaskRunner(task);

  const hintsUsedRef = useRef(0);
  const openedAtRef = useRef(0);
  const onSubmitAttemptRef = useRef(onSubmitAttempt);
  // What was actually submitted to Check, captured at click time rather than
  // read from `code` inside the effect below — the student can keep typing
  // while a check is in flight, and the attempt must record what was tested.
  const lastCheckedCodeRef = useRef('');

  useEffect(() => {
    openedAtRef.current = Date.now();
  }, []);
  useEffect(() => {
    onSubmitAttemptRef.current = onSubmitAttempt;
  }, [onSubmitAttempt]);

  useEffect(() => {
    if (!report) return;
    onSubmitAttemptRef.current?.({
      passed: report.passed,
      hintsUsed: hintsUsedRef.current,
      durationMs: Date.now() - openedAtRef.current,
      submittedAnswer: { code: lastCheckedCodeRef.current }
    });
  }, [report]);

  const loading = engine === 'loading';
  const disabled = loading || busy || (fileSpec !== undefined && code.length === 0);

  return (
    <main className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[minmax(280px,1fr)_minmax(420px,1.4fr)]">
      <section>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('task.statement')}</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">{task.title}</h1>
        <p className="mt-2 text-ink">{task.payload.prompt}</p>
        <Hints hints={hintsEnabled ? task.hints : []} onReveal={() => (hintsUsedRef.current += 1)} />
      </section>

      <section className="flex flex-col gap-4">
        {fileSpec && (
          <FileDelivery
            taskId={task.id}
            version={task.version}
            spec={fileSpec}
            prompt={task.payload.prompt}
            starterCode={task.payload.broken}
            onAccepted={setCode}
            parse={parse}
            disabled={loading || busy}
          />
        )}
        {(!fileSpec || code.length > 0) && (
          // Read-only in file mode: what gets checked must be exactly the file
          // the student sent, so edits go through IDLE and a new upload.
          <CodeEditor
            // CodeMirror owns its document after mount; a new upload remounts it.
            key={fileSpec ? code : undefined}
            value={code}
            onChange={setCode}
            errorLine={result?.error?.line ?? null}
            readOnly={fileSpec !== undefined}
            ariaLabel={t('workspace.editorLabel')}
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => run(code)}
            disabled={disabled}
            className="rounded-md border border-accent px-4 py-2 text-sm text-accent disabled:opacity-50"
          >
            {busy ? t('workspace.running') : t('workspace.run')}
          </button>
          <button
            type="button"
            onClick={() => {
              lastCheckedCodeRef.current = code;
              check(code);
            }}
            disabled={disabled}
            className="rounded-md bg-accent px-4 py-2 text-sm text-surface disabled:opacity-50"
          >
            {busy ? t('workspace.checking') : t('workspace.check')}
          </button>
          {loading && (
            // Several seconds on a classroom machine. Without this the student
            // sees a dead button and presses F5.
            <span className="text-sm text-ink-muted">
              {t('workspace.loadingEngine')}{' '}
              <span className="text-xs">{t('workspace.loadingHint')}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          <figure>
            <PlaybackScrubber drawing={result?.drawing ?? []} target={target} />
            <figcaption className="mt-1 text-xs text-ink-muted">
              {t('workspace.yourDrawing')} · {t('workspace.target')}
            </figcaption>
          </figure>

          {task.payload.surface === 'console' || (result?.stdout ?? '').length > 0 || pendingInputPrompt !== null ? (
            <OutputPanel stdout={result?.stdout ?? ''} pendingInputPrompt={pendingInputPrompt} onSubmitInput={submitInput} />
          ) : null}
        </div>

        {result && (
          <ResultPanel
            result={result}
            report={report}
            code={code}
            onRetry={() => {
              lastCheckedCodeRef.current = code;
              check(code);
            }}
          />
        )}
      </section>
    </main>
  );
}
