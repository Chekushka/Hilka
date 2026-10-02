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
import { GridRunNote } from '@/components/canvas/GridView';
import { CodePane, CodeVisual } from '@/components/task/CodePane';
import type { NextTaskAction } from '@/components/task/NextTaskButton';
import { OutputPanel } from '@/components/task/OutputPanel';
import { ResultPanel } from '@/components/task/ResultPanel';
import { RunCheckActions, RunDockIdle, WorkspaceDock } from '@/components/task/WorkspaceDock';
import { SuccessPanel } from '@/components/task/SuccessPanel';
import { WorkspaceFrame, type WorkspaceChrome } from '@/components/task/WorkspaceFrame';
import { t } from '@/lib/i18n';
import { parseFillTemplate, substituteFillTemplate } from '@/lib/task/fill';
import { gridWorldOf } from '@/lib/task/grid';
import { showsTurtleCanvas } from '@/lib/task/surface';
import { useTaskRunner } from '@/lib/task/use-task-runner';
import type { AttemptOutcome, FillTask } from '@/lib/task/types';

interface FillTaskViewProps {
  task: FillTask;
  /** Fired once per completed Check. Absent in plain practice — only a session records attempts. */
  onSubmitAttempt?: (outcome: AttemptOutcome) => void;
  hintsEnabled?: boolean;
  next?: NextTaskAction;
  chrome?: WorkspaceChrome;
}

export function FillTaskView({ task, onSubmitAttempt, hintsEnabled = true, next, chrome }: FillTaskViewProps) {
  const [values, setValues] = useState<Record<number, string>>({});
  const world = gridWorldOf(task);
  const runnable = useMemo(() => ({ ...task, grid: world }), [task, world]);
  const { engine, busy, result, report, target, pendingInput, run, check, submitInput } = useTaskRunner(runnable);

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

  const retry = () => {
    lastCheckedCodeRef.current = code;
    check(code);
  };
  const showsOutput = (result?.stdout ?? '').length > 0 || pendingInput !== null;

  return (
    <WorkspaceFrame
      task={task}
      chrome={chrome}
      hints={hintsEnabled ? task.hints : []}
      onRevealHint={() => (hintsUsedRef.current += 1)}
      success={report?.passed ? <SuccessPanel next={next} /> : undefined}
      dock={
        <WorkspaceDock
          actions={
            <RunCheckActions
              busy={busy}
              disabled={disabled}
              passed={report?.passed}
              onRun={() => run(code)}
              onCheck={retry}
            />
          }
          next={report?.passed ? next : undefined}
        >
          {showsOutput ? (
            <OutputPanel stdout={result?.stdout ?? ''} pendingInput={pendingInput} onSubmitInput={submitInput} />
          ) : (
            !result && <RunDockIdle engine={engine} />
          )}
          {world && result && !result.error && !result.timedOut && !report?.passed && (
            <GridRunNote run={result.grid} />
          )}
          {result && <ResultPanel result={result} report={report} code={code} onRetry={retry} />}
        </WorkspaceDock>
      }
    >
      <CodePane
        visual={
          world || showsTurtleCanvas(task, result?.drawing ?? []) ? (
            <CodeVisual world={world} grid={result?.grid ?? null} drawing={result?.drawing ?? []} target={target} />
          ) : undefined
        }
      >
        {/* Same size and face as the editor, so a gap reads as part of the program. */}
        <div className="flex-1 overflow-auto whitespace-pre-wrap px-5 py-4 font-mono text-base leading-[2.1] text-ink">
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
                size={Math.max(3, (values[part.index] ?? '').length || 3)}
                className="mx-0.5 inline-block rounded-md border-[1.5px] border-dashed border-accent bg-accent-soft px-1.5 py-0.5 text-center font-mono text-base text-ink focus:border-solid focus:outline-none"
              />
            )
          )}
        </div>
      </CodePane>
    </WorkspaceFrame>
  );
}
