'use client';

/**
 * A single/multiple-choice quiz. Nothing executes, so — same as parsons —
 * Check runs the declarative evaluator directly against the selected
 * options, no runner involved, no delay.
 */
import { useEffect, useRef, useState } from 'react';
import { evaluateChecks, type CheckReport } from '@/lib/checker';
import { CheckReportPanel } from '@/components/task/CheckReportPanel';
import type { NextTaskAction } from '@/components/task/NextTaskButton';
import { CheckAction, DockIdle, WorkspaceDock } from '@/components/task/WorkspaceDock';
import { SuccessPanel } from '@/components/task/SuccessPanel';
import { WorkspaceFrame, type WorkspaceChrome } from '@/components/task/WorkspaceFrame';
import { t } from '@/lib/i18n';
import type { AttemptOutcome, QuizTask } from '@/lib/task/types';

interface QuizTaskViewProps {
  task: QuizTask;
  onSubmitAttempt?: (outcome: AttemptOutcome) => void;
  hintsEnabled?: boolean;
  next?: NextTaskAction;
  chrome?: WorkspaceChrome;
}

export function QuizTaskView({ task, onSubmitAttempt, hintsEnabled = true, next, chrome }: QuizTaskViewProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [report, setReport] = useState<CheckReport | null>(null);

  const hintsUsedRef = useRef(0);
  const openedAtRef = useRef(0);
  useEffect(() => {
    openedAtRef.current = Date.now();
  }, []);

  function toggle(index: number) {
    setReport(null);
    if (task.payload.multiple) {
      setSelected((previous) =>
        previous.includes(index) ? previous.filter((i) => i !== index) : [...previous, index].sort((a, b) => a - b)
      );
    } else {
      setSelected([index]);
    }
  }

  function check() {
    const submission = { choiceIndices: selected };
    const nextReport = evaluateChecks(task.checks, { submission });
    setReport(nextReport);
    onSubmitAttempt?.({
      passed: nextReport.passed,
      hintsUsed: hintsUsedRef.current,
      durationMs: Date.now() - openedAtRef.current,
      submittedAnswer: submission
    });
  }

  return (
    <WorkspaceFrame
      task={task}
      chrome={chrome}
      hints={hintsEnabled ? task.hints : []}
      onRevealHint={() => (hintsUsedRef.current += 1)}
      success={report?.passed ? <SuccessPanel next={next} /> : undefined}
      dock={
        <WorkspaceDock
          scrollKey={report ?? undefined}
          actions={<CheckAction disabled={selected.length === 0} passed={report?.passed} onCheck={check} />}
          next={report?.passed ? next : undefined}
        >
          {report ? <CheckReportPanel report={report} /> : <DockIdle>{t('workspace.checkIdle')}</DockIdle>}
        </WorkspaceDock>
      }
    >
      <div className="px-6 py-6 lg:px-8">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm text-ink-muted">
            {task.payload.multiple ? t('workspace.quizMultiple') : t('workspace.quizSingle')}
          </legend>
          {task.payload.options.map((option, index) => {
            const checked = selected.includes(index);
            return (
              <label
                key={index}
                className={`flex cursor-pointer items-center gap-4 rounded-xl border-[1.5px] px-4 py-3.5 text-base text-ink ${
                  checked ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent'
                }`}
              >
                <input
                  type={task.payload.multiple ? 'checkbox' : 'radio'}
                  name="quiz-option"
                  checked={checked}
                  onChange={() => toggle(index)}
                  className="h-5 w-5 flex-none accent-accent"
                />
                <span>{option}</span>
              </label>
            );
          })}
        </fieldset>
      </div>
    </WorkspaceFrame>
  );
}
