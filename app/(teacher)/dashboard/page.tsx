import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listClassesForTeacher } from '@/lib/db/classes';
import { t } from '@/lib/i18n';

/**
 * Class overview, read-only (docs/TASKS.md, "Results dashboard"). Session
 * creation, roster editing and task authoring are separate, unbuilt work —
 * this only shows what already exists.
 */
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    redirect('/login');
  }

  const classes = await listClassesForTeacher(teacher.id);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">{t('dashboard.title')}</h1>
        <div className="flex items-center gap-4">
          <Link href="/sessions/new" className="text-sm text-accent">
            {t('sessionBuilder.newSession')}
          </Link>
          <Link href="/tasks" className="text-sm text-accent">
            {t('authoring.tasksTitle')}
          </Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="text-sm text-accent">
              {t('auth.logout')}
            </button>
          </form>
        </div>
      </div>

      {classes.length === 0 ? (
        <p className="mt-4 text-ink-muted">{t('dashboard.empty')}</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {classes.map((klass) => (
            <li key={klass.id} className="rounded-md border border-line p-4">
              <h2 className="text-lg font-semibold text-ink">{klass.title}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {t('dashboard.roster')}: {klass.roster.join(', ')}
              </p>
              <h3 className="mt-3 text-sm font-semibold text-ink-muted">{t('dashboard.sessionsTitle')}</h3>
              <ul className="mt-2 space-y-1">
                {klass.sessions.map((session) => (
                  <li key={session.id}>
                    <Link
                      href={`/dashboard/sessions/${session.id}`}
                      className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm text-ink"
                    >
                      <span className="font-mono">{session.code}</span>
                      <span className="text-ink-muted">
                        {session.open ? t('dashboard.sessionOpen') : t('dashboard.sessionClosed')} ·{' '}
                        {t('dashboard.sessionTaskCount', { n: session.taskCount })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
