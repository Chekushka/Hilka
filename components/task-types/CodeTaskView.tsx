'use client';

/**
 * Write from scratch: the editor in the work area, the canvas beside it when
 * the task draws, output and result in the dock. The three zones themselves
 * are WorkspaceFrame's, shared by every task type.
 */
import { useEffect, useRef, useState } from 'react';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { CodePane } from '@/components/task/CodePane';
import { FileDelivery } from '@/components/task/FileDelivery';
import type { NextTaskAction } from '@/components/task/NextTaskButton';
import { OutputPanel } from '@/components/task/OutputPanel';
import { ResultPanel } from '@/components/task/ResultPanel';
import { RunCheckActions, RunDockIdle, WorkspaceDock } from '@/components/task/WorkspaceDock';
import { SuccessPanel } from '@/components/task/SuccessPanel';
import { WorkspaceFrame, type WorkspaceChrome } from '@/components/task/WorkspaceFrame';
import { t } from '@/lib/i18n';
import { showsTurtleCanvas } from '@/lib/task/surface';
import { useTaskRunner } from '@/lib/task/use-task-runner';
import type { AttemptOutcome, CodeTask } from '@/lib/task/types';

interface CodeTaskViewProps {
  task: CodeTask;
  /** Fired once per completed Check. Absent in plain practice — only a session records attempts. */
  onSubmitAttempt?: (outcome: AttemptOutcome) => void;
  hintsEnabled?: boolean;
  next?: NextTaskAction;
  chrome?: WorkspaceChrome;
}

export function CodeTaskView({ task, onSubmitAttempt, hintsEnabled = true, next, chrome }: CodeTaskViewProps) {
  // File delivery: the code arrives by upload, not typing — nothing to run until it does.
  const fileSpec = task.payload.delivery === 'file' ? task.payload.file : undefined;
  const [code, setCode] = useState(fileSpec ? '' : task.payload.starter);
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
              starterCode={task.payload.starter}
              onAccepted={setCode}
              parse={parse}
              disabled={loading || busy}
            />
          )
        }
        canvas={showsTurtleCanvas(task, result?.drawing ?? []) ? { drawing: result?.drawing ?? [], target } : undefined}
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
