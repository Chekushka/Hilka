'use client';

/**
 * The Check result for the task types where nothing runs — quiz, predict,
 * parsons. Same frame and wording as ResultPanel, minus the interpreter
 * errors those types cannot raise. A pass is only noted here; SuccessPanel
 * celebrates it in the task panel.
 */
import { PassedNote, ResultFrame } from './ResultFrame';
import type { CheckReport } from '@/lib/checker';
import { t } from '@/lib/i18n';
import { notYetNote } from '@/lib/task/not-yet-note';

export function CheckReportPanel({ report }: { report: CheckReport }) {
  if (report.passed) {
    return <PassedNote />;
  }
  const failures = report.results.filter((result) => !result.passed);
  return (
    <ResultFrame icon="○" title={t('result.notYet')}>
      <ul className="space-y-1">
        {failures.map((result, index) => (
          <li key={`${result.check.kind}-${index}`}>{result.message}</li>
        ))}
      </ul>
      <p className="mt-2 text-ink-muted">{t(`result.notYetNote.${notYetNote(failures.map((failure) => failure.check))}`)}</p>
    </ResultFrame>
  );
}
