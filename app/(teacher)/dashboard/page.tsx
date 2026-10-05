import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DeleteSessionButton } from '@/components/dashboard/DeleteSessionButton';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listClassesForTeacher } from '@/lib/db/classes';
import { formatDay } from '@/lib/dashboard/time';
import { t } from '@/lib/i18n';

/**
 * Class overview (docs/TASKS.md, "Results dashboard"). Session and task
 * creation are separate flows linked from here; class creation and roster
 * editing (docs/TASKS.md, "Class + roster management") happen on this
 * page's own /classes/new and /classes/[id]. Each class lists its sessions
 * newest first, each with a way to delete it, and starts a new session with
 * the class already chosen.
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
      {/* Sessions, tasks and lessons are in the app bar (app/(teacher)/layout.tsx). */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">{t('dashboard.title')}</h1>
        <Link href="/classes/new" className="rounded-md border border-accent px-3 py-1.5 text-sm text-accent">
          {t('classForm.newClass')}
        </Link>
      </div>

      {classes.length === 0 ? (
        <p className="mt-4 text-ink-muted">{t('dashboard.empty')}</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {classes.map((klass) => (
            <li key={klass.id} className="rounded-lg border border-line bg-surface p-4" data-class-id={klass.id}>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h2 className="text-lg font-semibold text-ink">
                  {klass.title}
                  {klass.grade !== null && (
                    <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 align-middle text-xs font-normal text-accent">
                      {t('dashboard.classGrade', { grade: klass.grade })}
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-4 text-sm">
                  <Link href={`/sessions/new?class=${klass.id}`} className="text-accent">
                    + {t('dashboard.newSessionForClass')}
                  </Link>
                  <Link href={`/classes/${klass.id}`} className="text-accent">
                    {t('classForm.edit')}
                  </Link>
                </div>
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {t('dashboard.classStudents', { n: klass.students.length })}:{' '}
                {klass.students.map((student) => student.name).join(', ')}
              </p>
              <h3 className="mt-3 text-sm font-semibold text-ink-muted">{t('dashboard.sessionsTitle')}</h3>
              {klass.sessions.length === 0 ? (
                <p className="mt-1 text-sm text-ink-muted">{t('dashboard.sessionsEmpty')}</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {klass.sessions.map((session) => (
                    <li key={session.id} className="flex items-center gap-2" data-session-code={session.code}>
                      <Link
                        href={`/dashboard/sessions/${session.id}`}
                        className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 rounded-md border border-line px-3 py-2 text-sm text-ink hover:border-accent"
                      >
                        <span className="font-mono">{session.code}</span>
                        <span className="text-ink-muted">
                          {session.kind === 'homework' && `${t('dashboard.homeworkBadge')} · `}
                          {session.kind === 'check' && `${t('dashboard.checkBadge')} · `}
                          {session.open ? t('dashboard.sessionOpen') : t('dashboard.sessionClosed')} ·{' '}
                          {t('dashboard.sessionTaskCount', { n: session.taskCount })} ·{' '}
                          {session.dueAt
                            ? t('dashboard.sessionDue', { date: formatDay(session.dueAt) })
                            : t('dashboard.sessionCreated', { date: formatDay(session.createdAt) })}
                        </span>
                      </Link>
                      <DeleteSessionButton sessionId={session.id} code={session.code} homework={session.kind === 'homework'} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
