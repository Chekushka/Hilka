'use client';

/**
 * The teacher's re-check (docs/HOMEWORK.md, section 5, threat 5): every passed
 * answer in the session is checked again here, in the teacher's browser, by
 * the same checker the student's room used (lib/task/recheck.ts). A stored
 * answer that does not pass is listed as a fact, never a verdict — the
 * teacher opens the student card and decides. Nothing is written anywhere.
 */
import { useState } from 'react';
import { formatClock } from '@/lib/dashboard/time';
import { t } from '@/lib/i18n';
import { createRunner } from '@/lib/runner';
import { recheckAnswer, type RecheckItem } from '@/lib/task/recheck';

type Phase =
  | { kind: 'idle' }
  | { kind: 'running'; done: number; total: number }
  | { kind: 'done'; checked: number; failing: RecheckItem[]; skipped: number }
  | { kind: 'error' };

export function RecheckPanel({ sessionId }: { sessionId: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  async function recheck() {
    setPhase({ kind: 'running', done: 0, total: 0 });
    const runner = createRunner();
    try {
      const response = await fetch(`/api/dashboard/sessions/${sessionId}/recheck`);
      if (!response.ok) throw new Error('recheck list');
      const { items } = (await response.json()) as { items: RecheckItem[] };
      await runner.warmUp();
      const failing: RecheckItem[] = [];
      let checked = 0;
      let skipped = 0;
      for (const [index, item] of items.entries()) {
        setPhase({ kind: 'running', done: index, total: items.length });
        const verdict = item.task
          ? await recheckAnswer(item.task, item.submittedAnswer, (code, options) => runner.run(code, options))
          : 'unreadable';
        if (verdict === 'unreadable') skipped += 1;
        else checked += 1;
        if (verdict === 'fails') failing.push(item);
      }
      setPhase({ kind: 'done', checked, failing, skipped });
    } catch {
      setPhase({ kind: 'error' });
    } finally {
      runner.dispose();
    }
  }

  return (
    <section aria-labelledby="recheck" className="mt-8 rounded-xl border border-line bg-surface p-5" data-testid="recheck">
      <h2 id="recheck" className="text-lg font-semibold text-ink">
        {t('dashboard.recheckTitle')}
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-muted">{t('dashboard.recheckIntro')}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={recheck}
          disabled={phase.kind === 'running'}
          className="rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent disabled:opacity-50"
        >
          {t('dashboard.recheckRun')}
        </button>
        {phase.kind === 'running' && (
          <span className="text-sm text-ink-muted" aria-live="polite">
            {t('dashboard.recheckProgress', { done: phase.done, total: phase.total })}
          </span>
        )}
        {phase.kind === 'error' && <span className="text-sm text-attention">{t('dashboard.recheckError')}</span>}
      </div>
      {phase.kind === 'done' && (
        <div className="mt-4 space-y-2 text-sm" aria-live="polite" data-testid="recheck-result">
          {phase.failing.length === 0 ? (
            <p className="text-growth">{t('dashboard.recheckAllPass', { n: phase.checked })}</p>
          ) : (
            <>
              <p className="font-semibold text-attention">
                {t('dashboard.recheckFailingTitle', { n: phase.failing.length, checked: phase.checked })}
              </p>
              <ul className="list-disc pl-5 text-ink">
                {phase.failing.map((item) => (
                  <li key={item.attemptId}>
                    <a
                      href={`/dashboard/sessions/${sessionId}/students/${encodeURIComponent(item.studentName)}#attempt-${item.attemptId}`}
                      className="hover:text-accent"
                    >
                      {t('dashboard.recheckFailingItem', {
                        name: item.studentName,
                        task: item.taskTitle,
                        time: formatClock(item.createdAt)
                      })}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-ink-muted">{t('dashboard.recheckFailingNote')}</p>
            </>
          )}
          {phase.skipped > 0 && <p className="text-ink-muted">{t('dashboard.recheckSkipped', { n: phase.skipped })}</p>}
        </div>
      )}
    </section>
  );
}
