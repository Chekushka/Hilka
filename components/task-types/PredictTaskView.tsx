'use client';

/**
 * "What does this print?" — the student reads a fixed snippet and answers
 * either by typing the predicted output (`answerMode: 'text'`) or by
 * picking one of `payload.options` (`answerMode: 'choice'`, graded like
 * quiz's single-answer mode). Like quiz, nothing executes for the student
 * either way: Check runs the declarative evaluator directly against the
 * submitted text or index, no runner involved. `payload.code` already ran
 * once, at publish time, to confirm the checks' expected value — or chosen
 * option — actually matches its real output (lib/task/types.ts).
 */
import { useEffect, useRef, useState } from 'react';
import { evaluateChecks, type CheckReport } from '@/lib/checker';
import { CheckReportPanel } from '@/components/task/CheckReportPanel';
import type { NextTaskAction } from '@/components/task/NextTaskButton';
import { CheckAction, DockIdle, WorkspaceDock } from '@/components/task/WorkspaceDock';
import { WorkspaceFrame, type WorkspaceChrome } from '@/components/task/WorkspaceFrame';
import { t } from '@/lib/i18n';
import type { AttemptOutcome, PredictTask } from '@/lib/task/types';

interface PredictTaskViewProps {
  task: PredictTask;
  onSubmitAttempt?: (outcome: AttemptOutcome) => void;
  hintsEnabled?: boolean;
  next?: NextTaskAction;
  chrome?: WorkspaceChrome;
}

export function PredictTaskView({ task, onSubmitAttempt, hintsEnabled = true, next, chrome }: PredictTaskViewProps) {
  const isChoice = task.payload.answerMode === 'choice';
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [report, setReport] = useState<CheckReport | null>(null);

  const hintsUsedRef = useRef(0);
  const openedAtRef = useRef(0);
  useEffect(() => {
    openedAtRef.current = Date.now();
  }, []);

  function check() {
    const submission = isChoice ? { choiceIndices: selected === null ? [] : [selected] } : { text };
    const nextReport = evaluateChecks(task.checks, { submission });
    setReport(nextReport);
    onSubmitAttempt?.({
      passed: nextReport.passed,
      hintsUsed: hintsUsedRef.current,
      durationMs: Date.now() - openedAtRef.current,
      submittedAnswer: submission
    });
  }

  const ready = isChoice ? selected !== null : text.trim().length > 0;

  return (
    <WorkspaceFrame
      task={task}
      chrome={chrome}
      hints={hintsEnabled ? task.hints : []}
      onRevealHint={() => (hintsUsedRef.current += 1)}
      dock={
        <WorkspaceDock actions={<CheckAction disabled={!ready} onCheck={check} />}>
          {report ? <CheckReportPanel report={report} next={next} /> : <DockIdle>{t('workspace.checkIdle')}</DockIdle>}
        </WorkspaceDock>
      }
    >
      <div className="flex-none border-b border-line bg-code-bg px-5 py-4">
        <p className="mb-2 text-xs font-medium text-ink-muted">{t('workspace.readOnlyCode')}</p>
        <pre className="overflow-x-auto font-mono text-base leading-[1.7] text-ink">{task.payload.code}</pre>
      </div>

      <div className="px-6 py-6 lg:px-8">
        {isChoice ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-base font-semibold text-ink">{t('predict.answerLabel')}</legend>
            {(task.payload.options ?? []).map((option, index) => (
              <label
                key={index}
                className={`flex cursor-pointer items-center gap-4 rounded-xl border-[1.5px] px-4 py-3 text-ink ${
                  selected === index ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent'
                }`}
              >
                <input
                  type="radio"
                  name="predict-option"
                  checked={selected === index}
                  onChange={() => {
                    setReport(null);
                    setSelected(index);
                  }}
                  className="h-5 w-5 flex-none accent-accent"
                />
                {/* Output is what the program printed — the code face, same as the output panel. */}
                <span className="whitespace-pre-wrap font-mono text-base">{option}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-base font-semibold text-ink" htmlFor="predict-answer">
              {t('predict.answerLabel')}
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="predict-answer"
                value={text}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  setReport(null);
                  setText(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && ready) check();
                }}
                className="w-full max-w-md rounded-lg border-[1.5px] border-line bg-surface px-4 py-3 font-mono text-base text-ink focus:border-accent focus:outline-none"
              />
              <span className="text-sm text-ink-muted">{t('workspace.predictEnter')}</span>
            </div>
          </div>
        )}
      </div>
    </WorkspaceFrame>
  );
}
