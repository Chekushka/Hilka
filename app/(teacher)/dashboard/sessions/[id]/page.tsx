import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AutoRefresh } from '@/components/dashboard/AutoRefresh';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listAttemptsForSession } from '@/lib/db/attempts';
import { getSessionForTeacher } from '@/lib/db/sessions';
import { buildRollup, type CellStatus } from '@/lib/dashboard/rollup';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/** Shape and icon carry the meaning, not colour alone (design-brief-python-platform.md). */
function RollupCell({ status, attempts }: { status: CellStatus; attempts: number }) {
  if (status === 'passed') {
    return (
      <span className="text-growth" aria-label={t('dashboard.resultPassed')} title={t('dashboard.resultPassed')}>
        ✓
      </span>
    );
  }
  if (status === 'stuck') {
    const label = t('dashboard.rollupStuck', { n: attempts });
    return (
      <span className="text-attention" aria-label={label} title={label}>
        ○ {attempts}
      </span>
    );
  }
  return (
    <span className="text-ink-muted" aria-label={t('dashboard.rollupNotStarted')}>
      —
    </span>
  );
}

export default async function SessionDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    redirect('/login');
  }

  const { id } = await params;
  // Scoped to this teacher's own classes — another teacher's session id 404s
  // exactly like one that does not exist.
  const session = await getSessionForTeacher(id, teacher.id);
  if (!session) {
    notFound();
  }

  const rows = await listAttemptsForSession(session.id);
  const rollup = buildRollup(session.roster, session.tasks, rows);

  return (
    <main className="mx-auto max-w-3xl p-6">
      {session.open && <AutoRefresh everyMs={5000} />}
      <Link href="/dashboard" className="text-sm text-accent">
        ← {t('dashboard.backToDashboard')}
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">
          {t('dashboard.sessionDetailTitle', { code: session.code })}
        </h1>
        {rows.length > 0 && (
          <a href={`/api/dashboard/sessions/${session.id}/export`} className="text-sm text-accent">
            {t('dashboard.exportCsv')}
          </a>
        )}
      </div>
      {session.open && <p className="mt-1 text-xs text-ink-muted">{t('dashboard.liveUpdating')}</p>}

      {session.tasks.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-ink">{t('dashboard.rollupTitle')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('dashboard.rollupNote')}</p>
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                <th className="py-2 pr-3">{t('dashboard.columnStudent')}</th>
                {session.tasks.map((task) => (
                  <th key={task.id} className="px-2 py-2 text-center font-normal" title={task.title}>
                    {task.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rollup.map((studentRow) => (
                <tr key={studentRow.studentName} className="border-b border-line">
                  <td className="py-2 pr-3 text-ink">
                    {studentRow.studentName}
                    {studentRow.stuckCount > 0 && (
                      <span className="ml-2 text-xs text-attention">
                        {t('dashboard.rollupAttentionCount', { n: studentRow.stuckCount })}
                      </span>
                    )}
                  </td>
                  {studentRow.cells.map((cell, index) => (
                    <td key={session.tasks[index].id} className="px-2 py-2 text-center">
                      <RollupCell status={cell.status} attempts={cell.attempts} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <h2 className="mt-6 text-lg font-semibold text-ink">{t('dashboard.attemptsLogTitle')}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-ink-muted">{t('dashboard.attemptsEmpty')}</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              <th className="py-2">{t('dashboard.columnStudent')}</th>
              <th className="py-2">{t('dashboard.columnTask')}</th>
              <th className="py-2">{t('dashboard.columnResult')}</th>
              <th className="py-2">{t('dashboard.columnHints')}</th>
              <th className="py-2">{t('dashboard.columnDuration')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line">
                <td className="py-2 text-ink">{row.studentName}</td>
                <td className="py-2 text-ink">{row.taskTitle}</td>
                <td className={`py-2 ${row.passed ? 'text-growth' : 'text-attention'}`}>
                  {row.passed ? t('dashboard.resultPassed') : t('dashboard.resultNotYet')}
                </td>
                <td className="py-2 text-ink">{row.hintsUsed}</td>
                <td className="py-2 text-ink">
                  {row.durationMs !== null
                    ? t('dashboard.durationSeconds', { n: Math.round(row.durationMs / 1000) })
                    : t('dashboard.durationUnknown')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
