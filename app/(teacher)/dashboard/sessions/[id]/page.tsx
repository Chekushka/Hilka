import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listAttemptsForSession } from '@/lib/db/attempts';
import { getSessionForTeacher } from '@/lib/db/sessions';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

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

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/dashboard" className="text-sm text-accent">
        ← {t('dashboard.backToDashboard')}
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-ink">
        {t('dashboard.sessionDetailTitle', { code: session.code })}
      </h1>

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
