'use client';

/**
 * Same screen as `code` (CodeTaskView) — the only difference is what the
 * editor starts with: `payload.broken` instead of `payload.starter`. Kept as
 * its own file rather than a shared component, same as quiz/predict's
 * near-identical result panels — one file per task type
 * (docs/AI_CONTEXT.md, "Every task type implements one shared component
 * interface").
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { GridRunNote } from '@/components/canvas/GridView';
import { CodePane, CodeVisual } from '@/components/task/CodePane';
import { FileDelivery } from '@/components/task/FileDelivery';
import type { NextTaskAction } from '@/components/task/NextTaskButton';
import { OutputPanel } from '@/components/task/OutputPanel';
import { ResultPanel } from '@/components/task/ResultPanel';
import { RunCheckActions, RunDockIdle, WorkspaceDock } from '@/components/task/WorkspaceDock';
import { SuccessPanel } from '@/components/task/SuccessPanel';
import { WorkspaceFrame, type WorkspaceChrome } from '@/components/task/WorkspaceFrame';
import { t } from '@/lib/i18n';
import { gridWorldOf } from '@/lib/task/grid';
import { showsTurtleCanvas } from '@/lib/task/surface';
import { useTaskRunner } from '@/lib/task/use-task-runner';
import type { AttemptOutcome, FixTask } from '@/lib/task/types';

interface FixTaskViewProps {
  task: FixTask;
  /** Fired once per completed Check. Absent in plain practice — only a session records attempts. */
  onSubmitAttempt?: (outcome: AttemptOutcome) => void;
  hintsEnabled?: boolean;
  next?: NextTaskAction;
  chrome?: WorkspaceChrome;
}

export function FixTaskView({ task, onSubmitAttempt, hintsEnabled = true, next, chrome }: FixTaskViewProps) {
  // File delivery: the code arrives by upload, not typing — nothing to run until it does.
  const fileSpec = task.payload.delivery === 'file' ? task.payload.file : undefined;
  const [code, setCode] = useState(fileSpec ? '' : task.payload.broken);
  const world = gridWorldOf(task);
  const runnable = useMemo(() => ({ ...task, grid: world }), [task, world]);
  const { engine, busy, result, report, target, pendingInputPrompt, run, check, submitInput, parse } = useTaskRunner(runnable);

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
      score: report.score,
      hintsUsed: hintsUsedRef.current,
      durationMs: Date.now() - openedAtRef.current,
      submittedAnswer: { code: lastCheckedCodeRef.current }
    });
  }, [report]);

  const loading = engine === 'loading';
  const disabled = loading || busy || (fileSpec !== undefined && code.length === 0);

  const retry = () => {
    lastCheckedCodeRef.current = code;
    check(code);
  };
  const showsOutput =
    task.payload.surface === 'console' || (result?.stdout ?? '').length > 0 || pendingInputPrompt !== null;

  return (
    <WorkspaceFrame
      task={task}
      chrome={chrome}
      hints={hintsEnabled ? task.hints : []}
      onRevealHint={() => (hintsUsedRef.current += 1)}
      success={report?.passed ? <SuccessPanel next={next} /> : undefined}
      dock={
        <WorkspaceDock
          actions={<RunCheckActions busy={busy} disabled={disabled} onRun={() => run(code)} onCheck={retry} />}
        >
          {showsOutput && !loading ? (
            <OutputPanel stdout={result?.stdout ?? ''} pendingInputPrompt={pendingInputPrompt} onSubmitInput={submitInput} />
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
        before={
          fileSpec && (
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
          )
        }
        visual={
          world || showsTurtleCanvas(task, result?.drawing ?? []) ? (
            <CodeVisual world={world} grid={result?.grid ?? null} drawing={result?.drawing ?? []} target={target} />
          ) : undefined
        }
      >
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
            variant="fill"
          />
        )}
      </CodePane>
    </WorkspaceFrame>
  );
}
