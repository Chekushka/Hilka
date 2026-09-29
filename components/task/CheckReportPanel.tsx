'use client';

/**
 * The Check result for the task types where nothing runs — quiz, predict,
 * parsons. Same frame and wording as ResultPanel, minus the interpreter
 * errors those types cannot raise.
 */
import { NextTaskButton, type NextTaskAction } from './NextTaskButton';
import { ResultFrame } from './ResultFrame';
import type { CheckReport } from '@/lib/checker';
import { t } from '@/lib/i18n';

export function CheckReportPanel({ report, next }: { report: CheckReport; next?: NextTaskAction }) {
  if (report.passed) {
    return (
      <ResultFrame tone="growth" icon="✓" title={t('result.passed')}>
        <p>{t('result.passedNote')}</p>
        {next && <NextTaskButton action={next} />}
      </ResultFrame>
    );
  }
  return (
    <ResultFrame tone="attention" icon="○" title={t('result.notYet')}>
      <ul className="space-y-1">
        {report.results
          .filter((result) => !result.passed)
          .map((result, index) => (
            <li key={`${result.check.kind}-${index}`}>{result.message}</li>
          ))}
      </ul>
      <p className="mt-2 text-ink-muted">{t('result.notYetNote')}</p>
    </ResultFrame>
  );
}
