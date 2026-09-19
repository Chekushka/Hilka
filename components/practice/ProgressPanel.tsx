'use client';

/**
 * Progress codes (docs/AI_CONTEXT.md, "Progress Codes"): save practice
 * progress under a portable 8-character code, or restore one from another
 * machine. `localStorage` stays the primary store — this panel is the
 * backup/portability path, not the everyday one, which is why nothing here
 * blocks working the task above it.
 */
import { useState, type FormEvent } from 'react';
import { formatProgressCode, normalizeProgressCode } from '@/lib/practice/code';
import { loadLocalProgressCode, saveLocalProgressCode, useLocalProgressCode } from '@/lib/practice/local-progress';
import { hasCompletedTask, mergeProgress, type PracticeProgress } from '@/lib/practice/progress';
import { t } from '@/lib/i18n';

interface ProgressPanelProps {
  progress: PracticeProgress;
  setProgress: (updater: (previous: PracticeProgress) => PracticeProgress) => void;
  currentTaskSlug: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type RestoreStatus = 'idle' | 'restoring' | 'done' | 'error';

export function ProgressPanel({ progress, setProgress, currentTaskSlug }: ProgressPanelProps) {
  const cachedCode = useLocalProgressCode();
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const [restoreInput, setRestoreInput] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<RestoreStatus>('idle');
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  const displayCode = savedCode ?? (cachedCode ? formatProgressCode(cachedCode) : null);

  async function handleSave() {
    setSaveStatus('saving');
    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: loadLocalProgressCode() ?? undefined, state: progress })
      });
      if (!response.ok) throw new Error('save failed');
      const data: { code: string } = await response.json();
      saveLocalProgressCode(normalizeProgressCode(data.code));
      setSavedCode(data.code);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  async function handleRestore(event: FormEvent) {
    event.preventDefault();
    setRestoreStatus('restoring');
    setRestoreMessage(null);
    try {
      const response = await fetch('/api/progress/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: restoreInput })
      });
      if (response.status === 404) {
        setRestoreStatus('error');
        setRestoreMessage(t('practice.restoreNotFound'));
        return;
      }
      if (response.status === 400) {
        setRestoreStatus('error');
        setRestoreMessage(t('practice.restoreInvalidFormat'));
        return;
      }
      if (response.status === 429) {
        setRestoreStatus('error');
        setRestoreMessage(t('practice.restoreRateLimited'));
        return;
      }
      if (!response.ok) throw new Error('restore failed');
      const data: { state: PracticeProgress } = await response.json();
      setProgress((previous) => mergeProgress(previous, data.state));
      saveLocalProgressCode(normalizeProgressCode(restoreInput));
      setRestoreInput('');
      setRestoreStatus('done');
      setRestoreMessage(t('practice.restoreSuccess'));
    } catch {
      setRestoreStatus('error');
      setRestoreMessage(t('practice.restoreError'));
    }
  }

  return (
    <section className="mx-auto mt-2 max-w-6xl px-6 pb-10">
      <div className="rounded-md border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">{t('practice.progressTitle')}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t('practice.progressCount', { n: progress.completedTaskSlugs.length })}
        </p>
        {hasCompletedTask(progress, currentTaskSlug) && (
          <p className="mt-1 text-sm text-growth">{t('practice.taskCompletedBefore')}</p>
        )}

        <div className="mt-4 flex flex-wrap items-start gap-6">
          <div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="rounded-md border border-accent px-3 py-1.5 text-sm text-accent disabled:opacity-50"
            >
              {saveStatus === 'saving' ? t('practice.saving') : t('practice.saveCode')}
            </button>
            {saveStatus === 'error' && <p className="mt-1 text-sm text-attention">{t('practice.saveError')}</p>}
            {displayCode && (
              <div className="mt-2">
                <p className="text-xs text-ink-muted">{t('practice.codeLabel')}</p>
                <p className="font-mono text-lg tracking-wide text-ink">{displayCode}</p>
                <p className="mt-1 max-w-xs text-xs text-ink-muted">{t('practice.codeSavedNote')}</p>
              </div>
            )}
          </div>

          <form onSubmit={handleRestore} className="flex flex-col gap-2">
            <label className="text-xs text-ink-muted" htmlFor="restore-code">
              {t('practice.restoreInputLabel')}
            </label>
            <div className="flex gap-2">
              <input
                id="restore-code"
                type="text"
                value={restoreInput}
                onChange={(event) => setRestoreInput(event.target.value)}
                placeholder="ABCD-EFGH"
                className="rounded-md border border-line bg-code-bg px-3 py-1.5 font-mono text-sm text-ink"
              />
              <button
                type="submit"
                disabled={restoreStatus === 'restoring' || restoreInput.trim().length === 0}
                className="rounded-md bg-accent px-3 py-1.5 text-sm text-surface disabled:opacity-50"
              >
                {restoreStatus === 'restoring' ? t('practice.restoring') : t('practice.restoreButton')}
              </button>
            </div>
            {restoreMessage && (
              <p className={`text-sm ${restoreStatus === 'done' ? 'text-growth' : 'text-attention'}`}>
                {restoreMessage}
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
