'use client';

/**
 * The download/upload half of a file-delivery task (docs/TASK_SCHEMA.md,
 * "File Delivery"). Replaces typing in the editor: the student gets a
 * generated `.py`, works on it in IDLE, and sends it back. Validation is
 * `lib/task/file.ts` (steps 1–8) then `lib/task/file-lint.ts` (step 9, on
 * the engine's parse); every message here is an instruction for what to do
 * next, never a verdict on the student's code.
 */
import { useState } from 'react';
import { t } from '@/lib/i18n';
import type { ParseResult } from '@/lib/runner';
import { generateStarterFile, validateUpload, type UploadRejection, type UploadWarning } from '@/lib/task/file';
import { lintFile, type LintFinding } from '@/lib/task/file-lint';
import type { FileSpec } from '@/lib/task/types';

interface FileDeliveryProps {
  taskId: string;
  version: number;
  spec: FileSpec;
  prompt: string;
  /** `payload.starter` for `code`, `payload.broken` for `fix`. */
  starterCode: string;
  /**
   * The latest upload's normalized source once it passed every step, ready
   * to run and check — or `''` when it was rejected, so what is on screen is
   * always the file the student sent last.
   */
  onAccepted: (source: string) => void;
  /** The runner's parse (`useTaskRunner`), for step 9. */
  parse: (code: string) => Promise<ParseResult>;
  disabled?: boolean;
}

type Notice =
  | { kind: 'rejection'; key: UploadRejection | 'unreadable' | 'lintFailed' }
  | { kind: 'warning'; text: string }
  | { kind: 'unsupported'; findings: LintFinding[] };

function warningText(warning: UploadWarning, spec: FileSpec): string {
  return warning === 'filename'
    ? t('file.warning.filename', { expected: spec.filename })
    : t(`file.warning.${warning}`);
}

export function FileDelivery({ taskId, version, spec, prompt, starterCode, onAccepted, parse, disabled }: FileDeliveryProps) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [acceptedName, setAcceptedName] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const reject = (notice: Notice) => {
    setNotices([notice]);
    setAcceptedName(null);
    onAccepted('');
  };

  const download = () => {
    const text = generateStarterFile({ header: { taskId, version }, spec, prompt, code: starterCode });
    const url = URL.createObjectURL(new Blob([text], { type: 'text/x-python;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = spec.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file: File) => {
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      reject({ kind: 'rejection', key: 'unreadable' });
      return;
    }
    const result = validateUpload(file.name, bytes, spec);
    if (!result.ok) {
      reject({ kind: 'rejection', key: result.rejection });
      return;
    }

    // Step 9, last: the only step that needs a parse, which 1–3 make possible.
    let findings: LintFinding[];
    setChecking(true);
    try {
      findings = lintFile(await parse(result.source), result.source);
    } catch {
      // Fail closed: a file the linter never saw is not let through.
      reject({ kind: 'rejection', key: 'lintFailed' });
      return;
    } finally {
      setChecking(false);
    }
    if (findings.length > 0) {
      reject({ kind: 'unsupported', findings });
      return;
    }

    const next: Notice[] = result.warnings.map((w) => ({ kind: 'warning', text: warningText(w, spec) }));
    // Uploading from inside the task already tells us which task it is, so a
    // missing or altered header needs no picker here — only a header that
    // positively names another task is worth a word.
    if (spec.headerComment) {
      if (result.header.status === 'ok' && result.header.header.taskId !== taskId) {
        next.push({ kind: 'warning', text: t('file.warning.headerOtherTask') });
      } else if (result.header.status !== 'ok') {
        next.push({ kind: 'warning', text: t('file.warning.headerMissing') });
      }
    }
    setNotices(next);
    setAcceptedName(file.name);
    onAccepted(result.source);
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-line p-4">
      <p className="text-sm text-ink">{t('file.intro')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={download}
          className="rounded-md border border-accent px-4 py-2 text-sm text-accent"
        >
          {t('file.download', { filename: spec.filename })}
        </button>
        <label className="text-sm text-ink">
          <span className="mr-2">{t('file.uploadLabel')}</span>
          <input
            type="file"
            accept=".py"
            disabled={disabled || checking}
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Clear so choosing the same (re-saved) file again still fires.
              event.target.value = '';
              if (file) void upload(file);
            }}
            className="text-sm"
          />
        </label>
      </div>
      {checking && (
        <p role="status" className="text-sm text-ink-muted">
          {t('file.checking')}
        </p>
      )}
      {notices.map((notice, i) =>
        notice.kind === 'unsupported' ? (
          // FILE_UNSUPPORTED (TASK_SCHEMA.md): a platform limitation, never a
          // wrong answer — so the same quiet tone as a warning, not a failure.
          <div key={i} role="alert" className="flex flex-col gap-2 text-sm text-ink">
            <p className="font-semibold">{t('file.unsupported.title')}</p>
            <p>{t('file.unsupported.intro')}</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {notice.findings.map((finding) => (
                <li key={`${finding.kind}:${finding.name}`}>
                  {finding.line !== null && t('file.unsupported.line', { line: finding.line })}
                  <code className="font-code">{t(`file.unsupported.${finding.kind}`, { name: finding.name })}</code>
                  {finding.replacement && (
                    <span className="block text-ink-muted">{t(`file.replacement.${finding.replacement}`)}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-ink-muted">{t('file.unsupported.footer')}</p>
          </div>
        ) : (
          <p
            key={i}
            role={notice.kind === 'rejection' ? 'alert' : 'status'}
            className={notice.kind === 'rejection' ? 'text-sm text-attention' : 'text-sm text-ink-muted'}
          >
            {notice.kind === 'rejection' ? t(`file.rejection.${notice.key}`) : notice.text}
          </p>
        )
      )}
      {acceptedName && (
        <p className="text-sm text-ink-muted">
          {t('file.uploaded', { filename: acceptedName })} {t('file.uploadAgain')}
        </p>
      )}
    </div>
  );
}
