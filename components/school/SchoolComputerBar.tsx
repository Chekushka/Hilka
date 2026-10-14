'use client';

/**
 * Under the app bar on a school computer (docs/AI_CONTEXT.md, "School
 * Computers"): says nothing stays on this PC, shows the progress code autosave
 * keeps up to date, and Finish — show the code once more, then forget the
 * student. It also watches for activity, so a student who walked away does
 * not hand their progress to the next one (`SCHOOL_IDLE_MS`). Renders nothing
 * on any other computer.
 */
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSchoolComputer } from '@/lib/device/school-client';
import { t } from '@/lib/i18n';
import { formatProgressCode } from '@/lib/practice/code';
import {
  clearLocalPractice,
  dropIfIdleAndNotify,
  flushSave,
  noteActivity,
  saveProgressNow,
  useLocalProgress,
  useLocalProgressCode,
  useSaveStatus
} from '@/lib/practice/local-progress';

/** Activity is written at most this often; idleness is measured in minutes. */
const ACTIVITY_THROTTLE_MS = 15_000;
const IDLE_CHECK_MS = 60_000;

export function SchoolComputerBar() {
  const school = useSchoolComputer();
  const router = useRouter();
  const [progress] = useLocalProgress();
  const code = useLocalProgressCode();
  const status = useSaveStatus();
  const [finishing, setFinishing] = useState<'no' | 'saving' | 'confirm'>('no');

  useEffect(() => {
    if (!school) return;
    let last = 0;
    const onActivity = () => {
      // The check reads the stored time, so it runs every time; only writing the time is throttled.
      dropIfIdleAndNotify();
      const now = Date.now();
      if (now - last < ACTIVITY_THROTTLE_MS) return;
      last = now;
      noteActivity();
    };
    onActivity();
    window.addEventListener('pointerdown', onActivity, true);
    window.addEventListener('keydown', onActivity, true);
    document.addEventListener('visibilitychange', dropIfIdleAndNotify);
    const timer = setInterval(dropIfIdleAndNotify, IDLE_CHECK_MS);
    return () => {
      window.removeEventListener('pointerdown', onActivity, true);
      window.removeEventListener('keydown', onActivity, true);
      document.removeEventListener('visibilitychange', dropIfIdleAndNotify);
      clearInterval(timer);
    };
  }, [school]);

  if (!school) return null;

  const hasProgress = progress.completedTaskSlugs.length > 0 || progress.look !== undefined;
  const shownCode = code ? formatProgressCode(code) : null;

  function finish() {
    clearLocalPractice();
    setFinishing('no');
    router.push('/');
  }

  async function startFinishing() {
    if (!hasProgress && !code) {
      finish();
      return;
    }
    setFinishing('saving');
    await flushSave();
    setFinishing('confirm');
  }

  return (
    <div
      className="flex-none border-b border-line bg-shell px-5 py-2 text-sm text-ink"
      role="region"
      aria-label={t('school.barLabel')}
      data-testid="school-bar"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-ink-muted">{t('school.barNote')}</span>
        <span className="flex-1" />
        {shownCode ? (
          <span>
            {t('school.codeLabel')}{' '}
            <span className="font-mono font-semibold tracking-wide" data-testid="school-code">
              {shownCode}
            </span>
          </span>
        ) : (
          !hasProgress && <span className="text-ink-muted">{t('school.noCodeYet')}</span>
        )}
        {status === 'saving' && <span className="text-ink-muted">{t('school.saving')}</span>}
        {status === 'error' && (
          <button type="button" onClick={() => void saveProgressNow()} className="text-attention underline">
            {t('school.saveFailed')}
          </button>
        )}
        {finishing === 'no' && (
          <button
            type="button"
            onClick={() => void startFinishing()}
            className="rounded-lg border border-accent px-3 py-1 font-semibold text-accent"
          >
            {t('school.finish')}
          </button>
        )}
        {finishing === 'saving' && <span className="text-ink-muted">{t('school.saving')}</span>}
      </div>

      {finishing === 'confirm' && (
        <div className="mx-auto mt-2 flex max-w-6xl flex-col gap-2 rounded-lg border border-accent bg-surface p-3" role="alertdialog" aria-label={t('school.finish')}>
          {code ? (
            <>
              <p>
                {t('school.finishWriteDown')}{' '}
                <span className="font-mono text-lg font-semibold tracking-wide">{shownCode}</span>
              </p>
              <p className="text-ink-muted">{t('school.finishNote')}</p>
            </>
          ) : (
            <p className="text-attention">{t('school.finishUnsaved')}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={finish} className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-surface">
              {code ? t('school.finishConfirm') : t('school.finishAnyway')}
            </button>
            {!code && (
              <button type="button" onClick={() => void saveProgressNow()} className="rounded-lg border border-line px-3 py-1.5">
                {t('school.retry')}
              </button>
            )}
            <button type="button" onClick={() => setFinishing('no')} className="rounded-lg border border-line px-3 py-1.5">
              {t('school.back')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
