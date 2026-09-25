'use client';

/**
 * The three outcomes, none of which is punishment.
 *
 * Nothing here is red, nothing shakes, nothing says "Error" as a heading, and
 * failure never costs progress — there is always an obvious way to try again.
 * Meaning is carried by shape and wording as well as colour, because a class of
 * twenty-five contains someone who cannot separate red from green.
 *
 * Interpreter messages never reach the student: lib/errors/ rewrites them into
 * an explanation and a next step, with the student's own line shown inline.
 */
import { useEffect } from 'react';
import { NextTaskButton, type NextTaskAction } from './NextTaskButton';
import { humanize, humanizeTimeout, setUnmatchedReporter } from '@/lib/errors';
import { t } from '@/lib/i18n';
import type { CheckReport } from '@/lib/checker';
import type { RunResult } from '@/lib/runner';

interface ResultPanelProps {
  result: RunResult;
  report: CheckReport | null;
  code: string;
  onRetry: () => void;
  /** Offered once the Check passed; absent where there is nowhere to go. */
  next?: NextTaskAction;
}

/**
 * Installed once this panel is ever on screen — every task type that can run
 * Python renders one (CodeTaskView, FixTaskView, FillTaskView), so this is
 * the one place all of them cross. Re-registering on remount is harmless:
 * the reporter itself is stateless.
 */
function useUnmatchedErrorReporting() {
  useEffect(() => {
    setUnmatchedReporter((error) => {
      fetch('/api/errors/unmatched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error)
      }).catch(() => undefined);
    });
  }, []);
}

function Frame({
  tone,
  icon,
  title,
  children
}: {
  tone: 'growth' | 'attention';
  icon: string;
  title: string;
  children?: React.ReactNode;
}) {
  const border = tone === 'growth' ? 'border-growth' : 'border-attention';
  const text = tone === 'growth' ? 'text-growth' : 'text-attention';
  return (
    <section className={`rounded-md border-l-4 ${border} bg-surface p-4`} aria-live="polite">
      <h3 className={`flex items-center gap-2 font-semibold ${text}`}>
        <span aria-hidden="true">{icon}</span>
        {title}
      </h3>
      <div className="mt-1 text-sm text-ink">{children}</div>
    </section>
  );
}

export function ResultPanel({ result, report, code, onRetry, next }: ResultPanelProps) {
  useUnmatchedErrorReporting();

  if (result.timedOut || result.error) {
    const human = result.timedOut ? humanizeTimeout() : humanize(result.error!, code);
    return (
      <Frame tone="attention" icon={result.timedOut ? '◷' : '◆'} title={human.title}>
        <p>{human.explanation}</p>
        {human.sourceLine && (
          <p className="mt-2 rounded-md bg-code-bg px-3 py-2 font-mono text-xs">
            {human.line !== null && (
              <span className="mr-3 text-ink-muted">{t('result.errorLine', { line: human.line })}</span>
            )}
            {human.sourceLine}
          </p>
        )}
        {human.hint && <p className="mt-2 text-ink-muted">{human.hint}</p>}
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md bg-accent px-3 py-1.5 text-sm text-surface"
        >
          {t('workspace.tryAgain')}
        </button>
      </Frame>
    );
  }

  if (!report) {
    return null;
  }

  if (report.passed) {
    return (
      <Frame tone="growth" icon="✓" title={t('result.passed')}>
        <p>{t('result.passedNote')}</p>
        {next && <NextTaskButton action={next} />}
      </Frame>
    );
  }

  const failures = report.results.filter((check) => !check.passed);
  return (
    <Frame tone="attention" icon="○" title={t('result.notYet')}>
      <ul className="space-y-1">
        {failures.map((check, index) => (
          <li key={`${check.check.kind}-${index}`}>{check.message}</li>
        ))}
      </ul>
      <p className="mt-2 text-ink-muted">{t('result.notYetNote')}</p>
    </Frame>
  );
}
