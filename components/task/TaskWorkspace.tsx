'use client';

/**
 * The screen that occupies thirty minutes of a lesson.
 *
 * Three zones: the task statement, the editor, and the result. Calm, adult and
 * quiet — closer to a well-made editor than to a game. Nothing bounces, nothing
 * celebrates, nothing distracts. Progress and reward live in a separate warm
 * layer between tasks, and none of it is allowed in here.
 *
 * Laid out for 1366×768 and legible from the back row when a teacher projects
 * it; it stacks to one column when there is not room for two.
 */
import { useEffect, useRef, useState } from 'react';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { TurtleCanvas } from '@/components/canvas/TurtleCanvas';
import { Hints } from './Hints';
import { ResultPanel } from './ResultPanel';
import { t } from '@/lib/i18n';
import { useTaskRunner } from '@/lib/task/use-task-runner';
import type { CodeTask } from '@/lib/task/types';

export interface TaskAttempt {
  code: string;
  passed: boolean;
  hintsUsed: number;
  durationMs: number;
}

interface TaskWorkspaceProps {
  task: CodeTask;
  /** Fired once per completed check (a run alone judges nothing, so it never
   *  fires for one) — the session runner uses this to record an attempt.
   *  Practice mode leaves it unset. A check that errors or times out is not
   *  reported here yet: report stays null for those, so there is nothing to
   *  attach (docs/TASKS.md). */
  onAttempt?: (attempt: TaskAttempt) => void;
}

export function TaskWorkspace({ task, onAttempt }: TaskWorkspaceProps) {
  const [code, setCode] = useState(task.payload.starter);
  const [hintsUsed, setHintsUsed] = useState(0);
  const startedAt = useRef(0);
  const { engine, busy, result, report, target, run, check } = useTaskRunner(task);

  useEffect(() => {
    // Date.now() is impure, so it belongs in an effect rather than in the
    // initial useRef() call — this runs once, on mount, before a student can
    // possibly have clicked Check yet.
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (!report) {
      return;
    }
    onAttempt?.({
      code,
      passed: report.passed,
      hintsUsed,
      durationMs: Date.now() - startedAt.current
    });
    // Only a fresh check (a new report object) should count as an attempt —
    // code/hintsUsed are read at that moment, not watched on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  const loading = engine === 'loading';
  const disabled = loading || busy;

  return (
    <main className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[minmax(280px,1fr)_minmax(420px,1.4fr)]">
      <section>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('task.statement')}</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">{task.title}</h1>
        <p className="mt-2 text-ink">{task.payload.prompt}</p>
        <Hints hints={task.hints} onReveal={setHintsUsed} />
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
            onClick={() => check(code)}
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
            <TurtleCanvas
              drawing={result?.drawing ?? []}
              target={target}
              label={t('workspace.yourDrawing')}
            />
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
          <ResultPanel result={result} report={report} code={code} onRetry={() => check(code)} />
        )}
      </section>
    </main>
  );
}
