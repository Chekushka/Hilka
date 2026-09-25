'use client';

/**
 * What the file-upload linter would reject in a file-delivery task's own
 * programs (components/authoring/file-lint-gate.ts). Publish stays off until
 * this is empty. Reuses the student-facing construct names from `file.*`.
 */
import { t } from '@/lib/i18n';
import type { LintedSource } from './file-lint-gate';

export function FileLintReport({ result }: { result: LintedSource[] | null }) {
  if (result !== null && result.length === 0) return null;
  return (
    <div role="alert" className="flex flex-col gap-2 text-sm text-attention">
      {result === null ? (
        <p>{t('authoring.deliveryLintFailed')}</p>
      ) : (
        <>
          <p className="font-semibold">{t('authoring.deliveryLintTitle')}</p>
          {result.map(({ source, findings }) => (
            <div key={source}>
              <p>{t(`authoring.deliveryLintSource.${source}`)}</p>
              <ul className="list-disc pl-5">
                {findings.map((finding) => (
                  <li key={`${finding.kind}:${finding.name}`}>
                    {finding.line !== null && t('file.unsupported.line', { line: finding.line })}
                    <code className="font-code">{t(`file.unsupported.${finding.kind}`, { name: finding.name })}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
