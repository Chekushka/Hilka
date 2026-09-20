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
import { Hints } from '@/components/task/Hints';
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
  const [code, setCode] = useState(task.payload.broken);
  const { engine, busy, result, report, target, run, check } = useTaskRunner(task);

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
  const disabled = loading || busy;

  return (
    <main className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[minmax(280px,1fr)_minmax(420px,1.4fr)]">
      <section>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('task.statement')}</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">{task.title}</h1>
        <p className="mt-2 text-ink">{task.payload.prompt}</p>
        <Hints hints={hintsEnabled ? task.hints : []} onReveal={() => (hintsUsedRef.current += 1)} />
      </section>

      <section className="flex flex-col gap-4">
        <CodeEditor
          value={code}
          onChange={setCode}
          errorLine={result?.error?.line ?? null}
          ariaLabel={t('workspace.editorLabel')}
        />

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

          {task.payload.surface === 'console' || (result?.stdout ?? '').length > 0 ? (
            <div className="min-w-[220px] flex-1">
              <p className="text-xs uppercase tracking-wide text-ink-muted">{t('workspace.output')}</p>
              <pre className="mt-1 min-h-[3rem] whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
                {result?.stdout || t('workspace.outputEmpty')}
              </pre>
            </div>
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
