'use client';

/**
 * The download/upload half of a file-delivery task (docs/TASK_SCHEMA.md,
 * "File Delivery"). Replaces typing in the editor: the student gets a
 * generated `.py`, works on it in IDLE, and sends it back. Validation is
 * `lib/task/file.ts`; every message here is an instruction for what to do
 * next, never a verdict on the student's code.
 */
import { useState } from 'react';
import { t } from '@/lib/i18n';
import { generateStarterFile, validateUpload, type UploadRejection, type UploadWarning } from '@/lib/task/file';
import type { FileSpec } from '@/lib/task/types';

interface FileDeliveryProps {
  taskId: string;
  version: number;
  spec: FileSpec;
  prompt: string;
  /** `payload.starter` for `code`, `payload.broken` for `fix`. */
  starterCode: string;
  /** A file that passed validation — normalized source, ready to run and check. */
  onAccepted: (source: string) => void;
  disabled?: boolean;
}

type Notice = { kind: 'rejection'; key: UploadRejection | 'unreadable' } | { kind: 'warning'; text: string };

function warningText(warning: UploadWarning, spec: FileSpec): string {
  return warning === 'filename'
    ? t('file.warning.filename', { expected: spec.filename })
    : t(`file.warning.${warning}`);
}

export function FileDelivery({ taskId, version, spec, prompt, starterCode, onAccepted, disabled }: FileDeliveryProps) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [acceptedName, setAcceptedName] = useState<string | null>(null);

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
      setNotices([{ kind: 'rejection', key: 'unreadable' }]);
      return;
    }
    const result = validateUpload(file.name, bytes, spec);
    if (!result.ok) {
      setNotices([{ kind: 'rejection', key: result.rejection }]);
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
            disabled={disabled}
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
      {notices.map((notice, i) => (
        <p
          key={i}
          role={notice.kind === 'rejection' ? 'alert' : 'status'}
          className={notice.kind === 'rejection' ? 'text-sm text-attention' : 'text-sm text-ink-muted'}
        >
          {notice.kind === 'rejection' ? t(`file.rejection.${notice.key}`) : notice.text}
        </p>
      ))}
      {acceptedName && (
        <p className="text-sm text-ink-muted">
          {t('file.uploaded', { filename: acceptedName })} {t('file.uploadAgain')}
        </p>
      )}
    </div>
  );
}
