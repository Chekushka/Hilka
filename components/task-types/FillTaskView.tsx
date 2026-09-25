'use client';

/**
 * `payload.template` renders as code with an inline input at every `{{n}}`
 * gap — the student fills in values instead of typing a program from
 * scratch. Run/Check substitute those values (`lib/task/fill.ts`) into a
 * `code` string and hand it to `useTaskRunner`, the exact hook `code` and
 * `fix` already share via its `RunnableTask` shape, so everything past
 * assembly — the run, the checker, the result panel — is identical to them.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PlaybackScrubber } from '@/components/canvas/PlaybackScrubber';
import { Hints } from '@/components/task/Hints';
import { OutputPanel } from '@/components/task/OutputPanel';
import { ResultPanel } from '@/components/task/ResultPanel';
import { t } from '@/lib/i18n';
import { parseFillTemplate, substituteFillTemplate } from '@/lib/task/fill';
import { useTaskRunner } from '@/lib/task/use-task-runner';
import type { AttemptOutcome, FillTask } from '@/lib/task/types';

interface FillTaskViewProps {
  task: FillTask;
  /** Fired once per completed Check. Absent in plain practice — only a session records attempts. */
  onSubmitAttempt?: (outcome: AttemptOutcome) => void;
  hintsEnabled?: boolean;
}

export function FillTaskView({ task, onSubmitAttempt, hintsEnabled = true }: FillTaskViewProps) {
  const [values, setValues] = useState<Record<number, string>>({});
  const { engine, busy, result, report, target, pendingInputPrompt, run, check, submitInput } = useTaskRunner(task);

  const hintsUsedRef = useRef(0);
  const openedAtRef = useRef(0);
  const onSubmitAttemptRef = useRef(onSubmitAttempt);
  // What was actually submitted to Check, captured at click time — the
  // student can keep editing gaps while a check is in flight.
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
      score: report.score,
      hintsUsed: hintsUsedRef.current,
      durationMs: Date.now() - openedAtRef.current,
      submittedAnswer: { code: lastCheckedCodeRef.current }
    });
  }, [report]);

  const parts = useMemo(() => parseFillTemplate(task.payload.template), [task.payload.template]);
  const code = substituteFillTemplate(task.payload.template, values);

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
        <div className="whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-sm leading-relaxed text-ink">
          {parts.map((part, index) =>
            part.kind === 'text' ? (
              <span key={index}>{part.value}</span>
            ) : (
              <input
                key={index}
                type="text"
                value={values[part.index] ?? ''}
                onChange={(event) => {
                  setValues((previous) => ({ ...previous, [part.index]: event.target.value }));
                }}
                aria-label={t('fill.gapLabel', { n: part.index })}
                size={Math.max(2, (values[part.index] ?? '').length || 2)}
                className="mx-0.5 inline-block rounded border border-accent bg-surface px-1 text-center font-mono text-sm text-ink"
              />
            )
          )}
        </div>

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

          {(result?.stdout ?? '').length > 0 || pendingInputPrompt !== null ? (
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
