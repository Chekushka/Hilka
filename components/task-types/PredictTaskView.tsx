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
import { Hints } from '@/components/task/Hints';
import { t } from '@/lib/i18n';
import type { AttemptOutcome, PredictTask } from '@/lib/task/types';

interface PredictTaskViewProps {
  task: PredictTask;
  onSubmitAttempt?: (outcome: AttemptOutcome) => void;
  hintsEnabled?: boolean;
}

export function PredictTaskView({ task, onSubmitAttempt, hintsEnabled = true }: PredictTaskViewProps) {
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

  return (
    <main className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[minmax(280px,1fr)_minmax(420px,1.4fr)]">
      <section>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('task.statement')}</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">{task.title}</h1>
        <p className="mt-2 text-ink">{task.payload.prompt}</p>
        <Hints hints={hintsEnabled ? task.hints : []} onReveal={() => (hintsUsedRef.current += 1)} />
      </section>

      <section className="flex flex-col gap-4">
        <pre className="whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
          {task.payload.code}
        </pre>

        {isChoice ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm text-ink-muted">{t('predict.answerLabel')}</legend>
            {(task.payload.options ?? []).map((option, index) => (
              <label
                key={index}
                className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-ink"
              >
                <input
                  type="radio"
                  name="predict-option"
                  checked={selected === index}
                  onChange={() => {
                    setReport(null);
                    setSelected(index);
                  }}
                />
                {option}
              </label>
            ))}
          </fieldset>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-ink-muted" htmlFor="predict-answer">
              {t('predict.answerLabel')}
            </label>
            <input
              id="predict-answer"
              value={text}
              onChange={(event) => {
                setReport(null);
                setText(event.target.value);
              }}
              className="rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm text-ink"
            />
          </div>
        )}

        <button
          type="button"
          onClick={check}
          disabled={isChoice ? selected === null : text.trim().length === 0}
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
