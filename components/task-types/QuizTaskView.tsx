'use client';

/**
 * A single/multiple-choice quiz. Nothing executes, so — same as parsons —
 * Check runs the declarative evaluator directly against the selected
 * options, no runner involved, no delay.
 */
import { useEffect, useRef, useState } from 'react';
import { evaluateChecks, type CheckReport } from '@/lib/checker';
import { Hints } from '@/components/task/Hints';
import { t } from '@/lib/i18n';
import type { AttemptOutcome, QuizTask } from '@/lib/task/types';

interface QuizTaskViewProps {
  task: QuizTask;
  onSubmitAttempt?: (outcome: AttemptOutcome) => void;
}

export function QuizTaskView({ task, onSubmitAttempt }: QuizTaskViewProps) {
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
    <main className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[minmax(280px,1fr)_minmax(420px,1.4fr)]">
      <section>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('task.statement')}</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">{task.title}</h1>
        <p className="mt-2 text-ink">{task.payload.prompt}</p>
        <Hints hints={task.hints} onReveal={() => (hintsUsedRef.current += 1)} />
      </section>

      <section className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{task.payload.prompt}</legend>
          {task.payload.options.map((option, index) => (
            <label
              key={index}
              className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-ink"
            >
              <input
                type={task.payload.multiple ? 'checkbox' : 'radio'}
                name="quiz-option"
                checked={selected.includes(index)}
                onChange={() => toggle(index)}
              />
              {option}
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          onClick={check}
          disabled={selected.length === 0}
          className="self-start rounded-md bg-accent px-4 py-2 text-sm text-surface disabled:opacity-50"
        >
          {t('workspace.check')}
        </button>

        {report && (
          <section
            className={`rounded-md border-l-4 ${report.passed ? 'border-growth' : 'border-attention'} bg-surface p-4`}
            aria-live="polite"
          >
            <h3
              className={`flex items-center gap-2 font-semibold ${report.passed ? 'text-growth' : 'text-attention'}`}
            >
              <span aria-hidden="true">{report.passed ? '✓' : '○'}</span>
              {report.passed ? t('result.passed') : t('result.notYet')}
            </h3>
            <div className="mt-1 text-sm text-ink">
              {report.passed ? (
                <p>{t('result.passedNote')}</p>
              ) : (
                <>
                  <ul className="space-y-1">
                    {report.results
                      .filter((r) => !r.passed)
                      .map((r, index) => (
                        <li key={`${r.check.kind}-${index}`}>{r.message}</li>
                      ))}
                  </ul>
                  <p className="mt-2 text-ink-muted">{t('result.notYetNote')}</p>
                </>
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
