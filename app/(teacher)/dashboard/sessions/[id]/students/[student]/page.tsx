import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AutoRefresh } from '@/components/dashboard/AutoRefresh';
import { CellMark, STATE_TEXT_CLASS, StateMark, agoText, stateLabel } from '@/components/dashboard/StateMark';
import { SubmittedAnswer } from '@/components/dashboard/SubmittedAnswer';
import { VoidDeviceButton } from '@/components/dashboard/VoidDeviceButton';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listAttemptsForStudent, type StudentAttemptRow } from '@/lib/db/attempts';
import { getSessionForTeacher, listCheckAttempts, type TeacherSessionDetail } from '@/lib/db/sessions';
import { listTaskContent } from '@/lib/db/tasks';
import { summarizeStudents, taskTotalsFor } from '@/lib/dashboard/class-status';
import type { CellStatus } from '@/lib/dashboard/rollup';
import { describeSubmittedAnswer } from '@/lib/dashboard/submitted-answer';
import { agoFrom, formatClock, formatDate, formatDuration } from '@/lib/dashboard/time';
import { DEFAULT_GRADING } from '@/lib/grading/config';
import { summarizeDevices } from '@/lib/homework/devices';
import type { SessionTaskSummary } from '@/lib/session/types';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/** A roster name arrives percent-encoded in the path; tolerate either form. */
function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}

/**
 * Everything the card shows, read once per request. `now` is taken here, the
 * moment the data is read, so "last activity" and the stuck rule agree.
 * Null when the name is neither on the roster nor in the attempts.
 */
async function loadStudentCard(session: TeacherSessionDetail, rawName: string) {
  const studentName = session.roster.includes(rawName) ? rawName : decodeName(rawName);
  const attempts = await listAttemptsForStudent(session.id, studentName);
  if (!session.roster.includes(studentName) && attempts.length === 0) {
    return null;
  }

  const now = Date.now();
  // Voided attempts are shown, marked, but never counted.
  const counted = attempts.filter((attempt) => attempt.voidedAt === null);
  const [summary] = summarizeStudents([studentName], session.tasks, counted, {
    mode: session.mode,
    kind: session.kind,
    open: session.open,
    now
  });
  const allTasks = [...session.tasks, ...session.improvementTasks];
  const content = new Map((await listTaskContent(allTasks.map((task) => task.id))).map((row) => [row.id, row]));
  const taskNumber = new Map(allTasks.map((task, index) => [task.id, index + 1]));
  // Numbered per task, oldest first, the way a student would count their tries.
  const attemptNumber = new Map<string, number>();
  for (const task of allTasks) {
    attempts
      .filter((attempt) => attempt.taskId === task.id)
      .reverse()
      .forEach((attempt, index) => attemptNumber.set(attempt.id, index + 1));
  }
  const devices = session.kind === 'homework' ? summarizeDevices(attempts) : [];
  const deviceNumber = new Map(devices.map((device) => [device.deviceId, device.number]));
  // Per task, whether the first Check in a class check of this homework passed (lib/homework/grade.ts).
  const checkResult = new Map<string, boolean>();
  if (session.kind === 'homework') {
    const own = (await listCheckAttempts(session.id))
      .filter((check) => check.studentName === studentName)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    for (const check of own) if (!checkResult.has(check.taskId)) checkResult.set(check.taskId, check.passed);
  }
  return { studentName, attempts, summary, content, taskNumber, attemptNumber, devices, deviceNumber, checkResult, now };
}

/**
 * The student card (the mockups' student card screen): one student in one session —
 * where they stand, every attempt with what they submitted, the hints they
 * opened and the time they spent. Scoped to the owning teacher exactly like
 * the session page; a name that is neither on the roster nor in the attempts
 * 404s.
 */
export default async function StudentCardPage({
  params
}: {
  params: Promise<{ id: string; student: string }>;
}) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    redirect('/login');
  }

  const { id, student } = await params;
  const session = await getSessionForTeacher(id, teacher.id);
  if (!session) {
    notFound();
  }

  const card = await loadStudentCard(session, student);
  if (!card) {
    notFound();
  }
  const { studentName, attempts, summary, content, taskNumber, attemptNumber, devices, deviceNumber, checkResult, now } =
    card;
  const dueMs = session.dueAt ? Date.parse(session.dueAt) : null;

  function cellFor(own: StudentAttemptRow[]): { status: CellStatus; attempts: number } {
    const live = own.filter((attempt) => attempt.voidedAt === null);
    if (live.length === 0) return { status: 'not_started', attempts: 0 };
    return { status: live.some((attempt) => attempt.passed) ? 'passed' : 'stuck', attempts: live.length };
  }

  function taskArticle(task: SessionTaskSummary, heading: string, cell: { status: CellStatus; attempts: number }) {
    const own = attempts.filter((attempt) => attempt.taskId === task.id);
    const totals = taskTotalsFor(
      own.filter((attempt) => attempt.voidedAt === null),
      task.id
    );
    const payload = content.get(task.id);
    return (
      <article key={task.id} className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-start gap-3">
          <span className="mt-1">
            <CellMark status={cell.status} attempts={cell.attempts} size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-ink">{heading}</h3>
            <p className="mt-0.5 text-sm text-ink-muted">
              {own.length === 0
                ? t('studentCard.taskNoAttempts')
                : t('studentCard.taskMeta', {
                    attempts: own.length,
                    hints: totals.hints,
                    time: formatDuration(totals.timeMs)
                  })}
            </p>
            {checkResult.has(task.id) && (
              <p
                data-testid="check-result"
                className={`mt-1 text-sm font-medium ${checkResult.get(task.id) ? 'text-growth' : 'text-attention'}`}
              >
                {checkResult.get(task.id)
                  ? t('studentCard.checkPassed')
                  : t('studentCard.checkFailed', { credit: Math.round(DEFAULT_GRADING.fixCredit * 100) })}
              </p>
            )}
          </div>
        </div>

        {own.length > 0 && (
          <div className="mt-3 space-y-2">
            {own.map((attempt, attemptIndex) => {
              const oldVersion = payload && attempt.taskVersion !== payload.version;
              const score =
                !attempt.passed && attempt.score !== null && attempt.score > 0
                  ? t('studentCard.attemptScore', { pct: Math.round(attempt.score * 100) })
                  : null;
              const late = dueMs !== null && Date.parse(attempt.createdAt) > dueMs;
              const device = attempt.deviceId ? deviceNumber.get(attempt.deviceId) : undefined;
              return (
                <details
                  key={attempt.id}
                  id={`attempt-${attempt.id}`}
                  open={attemptIndex === 0}
                  data-voided={attempt.voidedAt !== null || undefined}
                  className={`group rounded-lg border border-line bg-bg/40 open:bg-surface ${
                    attempt.voidedAt !== null ? 'opacity-60' : ''
                  }`}
                >
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    <span aria-hidden="true" className="w-3 text-ink-muted transition-transform group-open:rotate-90">
                      ›
                    </span>
                    <span className="font-medium text-ink">
                      {t('studentCard.attemptSummary', {
                        n: attemptNumber.get(attempt.id) ?? 0,
                        time: formatClock(attempt.createdAt)
                      })}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 font-semibold ${attempt.passed ? 'text-growth' : 'text-attention'}`}
                    >
                      <CellMark status={attempt.passed ? 'passed' : 'stuck'} attempts={1} size={11} decorative />
                      {t(attempt.passed ? 'studentCard.attemptPassed' : 'studentCard.attemptNotYet')}
                    </span>
                    {score && <span className="text-ink-muted">{score}</span>}
                    {attempt.hintsUsed > 0 && (
                      <span className="text-ink-muted">{t('studentCard.attemptHints', { n: attempt.hintsUsed })}</span>
                    )}
                    {late && <span className="text-attention">{t('dashboard.attemptLate')}</span>}
                    {devices.length > 1 && device !== undefined && (
                      <span className="text-ink-muted">{t('dashboard.attemptDevice', { n: device })}</span>
                    )}
                    {attempt.voidedAt !== null && (
                      <span className="font-semibold text-ink-muted">{t('dashboard.attemptVoided')}</span>
                    )}
                  </summary>
                  <div className="space-y-2 px-3 pb-3 pt-1">
                    {oldVersion && (
                      <p className="text-xs text-ink-muted">
                        {t('studentCard.attemptOldVersion', { version: attempt.taskVersion })}
                      </p>
                    )}
                    <SubmittedAnswer
                      view={payload ? describeSubmittedAnswer(payload.payload, attempt.submittedAnswer) : { kind: 'unreadable' }}
                    />
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </article>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      {session.open && <AutoRefresh everyMs={5000} />}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href={`/dashboard/sessions/${session.id}`}
              className="rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-ink hover:border-accent"
            >
              ← {t('studentCard.backToSession', { code: session.code })}
            </Link>
            <h1 className="text-2xl font-bold text-ink">{studentName}</h1>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
              <StateMark state={summary.state} size={12} />
              <span className={`font-semibold ${STATE_TEXT_CLASS[summary.state]}`}>{stateLabel(summary.state)}</span>
              {summary.lastActivityAt && (
                <span className="text-ink-muted">
                  · {t('studentCard.lastActivity', { ago: agoText(agoFrom(summary.lastActivityAt, now)) })}
                </span>
              )}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={t('studentCard.statAttempts')} value={String(summary.attempts)} />
            <Stat label={t('studentCard.statHints')} value={String(summary.hints)} />
            <Stat label={t('studentCard.statTime')} value={formatDuration(summary.timeSpentMs)} />
            <Stat
              label={t(session.mode === 'graded' ? 'studentCard.statTasksGraded' : 'studentCard.statTasks')}
              value={t('studentCard.statTasksValue', { done: summary.tasksDone, total: summary.tasksTotal })}
            />
          </div>
          <p className="text-xs text-ink-muted">{t('studentCard.timeNote')}</p>

          <section aria-labelledby="student-tasks" className="space-y-3">
            <h2 id="student-tasks" className="text-lg font-semibold text-ink">
              {t('studentCard.tasksTitle')}
            </h2>
            {session.tasks.map((task, index) =>
              taskArticle(task, t('studentCard.taskHeading', { n: index + 1, title: task.title }), summary.cells[index])
            )}
          </section>

          {session.improvementTasks.length > 0 && (
            <section aria-labelledby="student-improvement" className="space-y-3">
              <h2 id="student-improvement" className="text-lg font-semibold text-ink">
                {t('session.improvementTitle')}
              </h2>
              {session.improvementTasks.map((task) =>
                taskArticle(
                  task,
                  task.title,
                  cellFor(attempts.filter((attempt) => attempt.taskId === task.id))
                )
              )}
            </section>
          )}

          {devices.length > 0 && (
            <section aria-labelledby="student-devices" className="space-y-3" data-testid="student-devices">
              <h2 id="student-devices" className="text-lg font-semibold text-ink">
                {t('dashboard.devicesTitle')}
              </h2>
              <p className="text-sm text-ink-muted">{t('dashboard.devicesNote')}</p>
              <ul className="space-y-2">
                {devices.map((device) => (
                  <li
                    key={device.deviceId}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm"
                  >
                    <span className="font-semibold text-ink">{t('dashboard.deviceLabel', { n: device.number })}</span>
                    <span className="text-ink-muted">
                      {t('dashboard.deviceSummary', {
                        attempts: device.attempts,
                        first: `${formatDate(device.firstAt)} ${formatClock(device.firstAt)}`,
                        last: `${formatDate(device.lastAt)} ${formatClock(device.lastAt)}`
                      })}
                    </span>
                    <span className="flex-1" />
                    {attempts.some((attempt) => attempt.deviceId === device.deviceId && attempt.voidedAt === null) && (
                      <VoidDeviceButton
                        sessionId={session.id}
                        studentName={studentName}
                        deviceId={device.deviceId}
                        number={device.number}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside
          aria-labelledby="student-timeline"
          className="h-fit rounded-xl border border-line bg-surface p-5 lg:sticky lg:top-4"
        >
          <h2 id="student-timeline" className="text-sm font-semibold text-ink">
            {t('studentCard.timelineTitle')}
          </h2>
          {attempts.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">{t('studentCard.timelineEmpty')}</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {attempts.map((attempt) => {
                const title = t('studentCard.taskHeading', {
                  n: taskNumber.get(attempt.taskId) ?? '·',
                  title: attempt.taskTitle
                });
                return (
                  <li key={attempt.id} className="flex items-start gap-3">
                    <span className="mt-1">
                      <CellMark status={attempt.passed ? 'passed' : 'stuck'} attempts={1} size={12} decorative />
                    </span>
                    <a href={`#attempt-${attempt.id}`} className="min-w-0 flex-1 hover:text-accent">
                      <span className="block text-sm leading-snug text-ink">
                        {t(attempt.passed ? 'studentCard.timelinePassed' : 'studentCard.timelineNotYet', {
                          task: title
                        })}
                      </span>
                      <span className="block text-xs tabular-nums text-ink-muted">{formatClock(attempt.createdAt)}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </div>
    </main>
  );
}
