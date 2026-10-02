'use client';

/**
 * On a homework's page: create a class check of it (docs/HOMEWORK.md, section
 * 4a) and see the ones already made. A check is a short graded session in
 * class on some of the homework's tasks; hints start off, since the point is
 * what the student can do alone. Its code is shown large, for the projector.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { t } from '@/lib/i18n';

interface CheckTask {
  id: string;
  title: string;
}

interface ExistingCheck {
  id: string;
  code: string;
  open: boolean;
  taskCount: number;
}

const TIME_PRESETS = [10, 15, null] as const;

export function ClassCheckPanel({
  homeworkId,
  tasks,
  checks,
  fixCreditPercent
}: {
  homeworkId: string;
  tasks: CheckTask[];
  checks: ExistingCheck[];
  fixCreditPercent: number;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<string[]>(() => tasks.map((task) => task.id));
  const [minutes, setMinutes] = useState<number | null>(10);
  const [hints, setHints] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);

  async function create() {
    if (chosen.length === 0) {
      setError(t('dashboard.checkNoTasks'));
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/dashboard/sessions/${homeworkId}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds: chosen, timeLimitS: minutes === null ? null : minutes * 60, hintsEnabled: hints })
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError(t('dashboard.actionFailed'));
      return;
    }
    setCreated((await response.json()) as { id: string; code: string });
    router.refresh();
  }

  return (
    <section aria-labelledby="class-check" className="mt-8 rounded-xl border border-line bg-surface p-5" data-testid="class-check">
      <h2 id="class-check" className="text-lg font-semibold text-ink">
        {t('dashboard.checkTitle')}
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-muted">{t('dashboard.checkIntro', { credit: fixCreditPercent })}</p>

      {checks.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label={t('dashboard.checkList')}>
          {checks.map((check) => (
            <li key={check.id}>
              <Link
                href={`/dashboard/sessions/${check.id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:border-accent"
              >
                <span className="font-mono">{check.code}</span>
                <span className="text-ink-muted">
                  {check.open ? t('dashboard.sessionOpen') : t('dashboard.sessionClosed')} ·{' '}
                  {t('dashboard.sessionTaskCount', { n: check.taskCount })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {created ? (
        <div className="mt-5 rounded-lg bg-bg p-5 text-center">
          <p className="text-ink">{t('dashboard.checkCreated')}</p>
          <p className="mt-2 font-mono text-4xl font-semibold tracking-[0.2em] text-ink" data-testid="check-code">
            {created.code}
          </p>
          <Link href={`/dashboard/sessions/${created.id}`} className="mt-3 inline-block text-sm text-accent">
            {t('dashboard.checkOpen')}
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
          <fieldset>
            <legend className="text-sm text-ink-muted">{t('dashboard.checkTasks')}</legend>
            <ul className="mt-2 space-y-1.5">
              {tasks.map((task) => (
                <li key={task.id}>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={chosen.includes(task.id)}
                      onChange={() =>
                        setChosen((previous) =>
                          previous.includes(task.id) ? previous.filter((id) => id !== task.id) : [...previous, task.id]
                        )
                      }
                    />
                    {task.title}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm text-ink-muted">{t('sessionBuilder.timeLimitLabel')}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset ?? 'none'}
                    type="button"
                    aria-pressed={minutes === preset}
                    onClick={() => setMinutes(preset)}
                    className={`rounded-lg border px-2.5 py-1.5 text-sm ${
                      minutes === preset ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-muted hover:text-ink'
                    }`}
                  >
                    {preset === null
                      ? t('sessionBuilder.timePresetNone')
                      : t('sessionBuilder.timePresetMinutes', { n: preset })}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={hints} onChange={(event) => setHints(event.target.checked)} />
              {t('sessionBuilder.hintsEnabledLabel')}
            </label>
            {error && <p className="text-sm text-attention">{error}</p>}
            <button
              type="button"
              onClick={create}
              disabled={busy}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-surface disabled:opacity-50"
            >
              {t('dashboard.checkCreate')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
