import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AutoRefresh } from '@/components/dashboard/AutoRefresh';
import { ClassCheckPanel } from '@/components/dashboard/ClassCheckPanel';
import { DeleteSessionButton } from '@/components/dashboard/DeleteSessionButton';
import { RecheckPanel } from '@/components/dashboard/RecheckPanel';
import { SessionControls } from '@/components/dashboard/SessionControls';
import { CellMark, STATE_TEXT_CLASS, StateMark, agoText, stateLabel } from '@/components/dashboard/StateMark';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listAttemptsForSession } from '@/lib/db/attempts';
import { loadHomeworkFacts } from '@/lib/db/homework-facts';
import {
  getSessionForTeacher,
  listCheckAttempts,
  listClassChecks,
  type TeacherSessionDetail
} from '@/lib/db/sessions';
import {
  STUCK_RULES,
  countStates,
  sortForClassTable,
  summarizeStudents,
  tallyTasks,
  type StudentState
} from '@/lib/dashboard/class-status';
import type { CellStatus } from '@/lib/dashboard/rollup';
import { findSharedFiles } from '@/lib/dashboard/shared-files';
import { formatPoints } from '@/lib/dashboard/csv';
import { agoFrom, formatClock } from '@/lib/dashboard/time';
import { DEFAULT_GRADING } from '@/lib/grading/config';
import { sessionAllowsHighBand, type SuggestedGrade } from '@/lib/grading/grade';
import { deadlineDistance, formatDeadline } from '@/lib/homework/deadline';
import { summarizeDevices } from '@/lib/homework/devices';
import type { StudentFacts } from '@/lib/homework/facts';
import type { HomeworkGrade } from '@/lib/homework/grade';
import { isHomeworkGrade, suggestSessionGrades } from '@/lib/homework/session-grades';
import { t } from '@/lib/i18n';
import { assignedTo } from '@/lib/session/assigned';

export const dynamic = 'force-dynamic';

/** The facts column: a word per kind of fact, each a reason to open the card — never a verdict (lib/homework/facts.ts). */
function FactsCell({ facts }: { facts: StudentFacts | undefined }) {
  const words = facts
    ? [
        facts.pasted.length > 0 && t('dashboard.factPasted'),
        facts.similar.length > 0 && t('dashboard.factSimilar'),
        facts.untaught.length > 0 && t('dashboard.factUntaught')
      ].filter((word): word is string => typeof word === 'string')
    : [];
  if (words.length === 0) return <span className="text-ink-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1" data-testid="facts">
      {words.map((word) => (
        <span key={word} className="rounded-full border border-attention px-2 py-0.5 text-xs text-ink">
          {word}
        </span>
      ))}
    </span>
  );
}

/** A suggestion for the teacher, never a verdict — see lib/grading/grade.ts and lib/homework/grade.ts. */
function GradeCell({ suggestion }: { suggestion: SuggestedGrade | HomeworkGrade }) {
  if (suggestion.grade === null) {
    return (
      <span className="text-ink-muted" aria-label={t('dashboard.gradeNone')} title={t('dashboard.gradeNone')}>
        —
      </span>
    );
  }
  const points = t('dashboard.gradePoints', {
    earned: formatPoints(suggestion.earned),
    possible: suggestion.possible
  });
  const extras = isHomeworkGrade(suggestion)
    ? [
        suggestion.fixedTasks > 0 && t('dashboard.gradeFixed', { n: suggestion.fixedTasks }),
        suggestion.lateAttempts > 0 && t('dashboard.gradeLate', { n: suggestion.lateAttempts }),
        suggestion.recovered > 0 && t('dashboard.gradeRecovered', { points: formatPoints(suggestion.recovered) }),
        suggestion.checkedTasks > 0 &&
          t('dashboard.gradeChecked', { confirmed: suggestion.confirmedTasks, checked: suggestion.checkedTasks })
      ].filter((text): text is string => typeof text === 'string')
    : [];
  return (
    <span title={[points, suggestion.capped && t('dashboard.gradeCappedHint'), ...extras].filter(Boolean).join('. ')}>
      <span className="text-lg font-semibold text-ink">{suggestion.grade}</span>
      {suggestion.capped && <span className="ml-1 text-xs text-ink-muted">{t('dashboard.gradeCapped')}</span>}
      {extras.length > 0 && <span className="block text-xs text-ink-muted">{extras.join(' · ')}</span>}
    </span>
  );
}

const CELL_WORD: Record<CellStatus, string> = {
  passed: 'dashboard.resultPassed',
  stuck: 'dashboard.resultNotYet',
  not_started: 'dashboard.rollupNotStarted',
  not_assigned: 'dashboard.rollupNotAssigned'
};

/**
 * Past this many tasks a per-task strip stops being readable at a glance;
 * the row keeps its count, and the task summary below and the student card
 * still show every task.
 */
const MAX_STRIP_TASKS = 24;

const TALLY_ORDER: { state: StudentState; key: string }[] = [
  { state: 'working', key: 'dashboard.tallyWorking' },
  { state: 'stuck', key: 'dashboard.tallyStuck' },
  { state: 'finished', key: 'dashboard.tallyFinished' },
  { state: 'not_started', key: 'dashboard.tallyNotStarted' }
];

/**
 * Everything the page shows, read once per request. `now` is taken with the
 * data, so the stuck rule and "last activity" agree with what was read.
 */
async function loadClassView(session: TeacherSessionDetail) {
  const rows = await listAttemptsForSession(session.id);
  const now = Date.now();
  const students = sortForClassTable(
    summarizeStudents(session.roster, session.tasks, rows, {
      mode: session.mode,
      kind: session.kind,
      assignedTo: assignedTo(session) ?? undefined,
      open: session.open,
      now
    })
  );
  return { rows, students, now };
}

/**
 * The class table (the mockups' class screen): who is working, who needs
 * help, who has finished — at a glance and from the back of the room when the
 * teacher puts it on the projector. State is a shape and a word, never a
 * colour alone (docs/design-brief-python-platform.md). Each name opens the
 * student card.
 */
export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { rows, students, now } = await loadClassView(session);
  const counts = countStates(students);
  const taskTallies = tallyTasks(students, session.tasks.length);
  const sharedFiles = findSharedFiles(rows);
  const graded = session.mode === 'graded';
  const homework = session.kind === 'homework';
  // A class check has no grade of its own: its results land in the homework's (lib/homework/grade.ts).
  const check = session.kind === 'check';
  const [checkRows, classChecks] = homework
    ? await Promise.all([listCheckAttempts(session.id), listClassChecks(session.id)])
    : [[], []];
  const grades =
    graded && !check
      ? new Map(suggestSessionGrades(session, rows, checkRows).map((row) => [row.studentName, row.suggestion]))
      : null;
  // Facts for the teacher (docs/HOMEWORK.md, section 5): homework only, as decided.
  const facts = homework ? await loadHomeworkFacts(session) : null;
  // Device marks (docs/HOMEWORK.md, section 2): how many browsers worked under each name.
  const devices = homework
    ? new Map(
        session.roster.map((name) => [name, summarizeDevices(rows.filter((row) => row.studentName === name)).length])
      )
    : null;
  const taskIndex = new Map(session.tasks.map((task, index) => [task.id, index]));

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      {session.open && <AutoRefresh everyMs={5000} />}
      <Link href="/dashboard" className="text-sm text-accent">
        ← {t('dashboard.backToDashboard')}
      </Link>

      <header className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-line pb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">{t('dashboard.sessionDetailTitle', { code: session.code })}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t('dashboard.sessionSubtitle', {
              classTitle: session.classTitle,
              mode: t(
                homework
                  ? 'sessionBuilder.modeHomework'
                  : check
                    ? 'dashboard.checkTitle'
                    : graded
                    ? 'sessionBuilder.modeGraded'
                    : 'sessionBuilder.modePractice'
              ),
              n: session.roster.length
            })}
            {' · '}
            {session.open ? t('dashboard.sessionOpen') : t('dashboard.sessionClosed')}
          </p>
          {check && session.checks && (
            <p className="mt-1 text-sm text-ink" data-testid="check-of">
              {t('dashboard.checkOf', { code: session.checks.code })}{' '}
              <Link href={`/dashboard/sessions/${session.checks.id}`} className="text-accent">
                {t('dashboard.checkOfLink', { code: session.checks.code })}
              </Link>
            </p>
          )}
          {homework && session.dueAt && (
            <p className="mt-1 text-base text-ink" data-testid="homework-due">
              {t('dashboard.homeworkDue', {
                date: formatDeadline(session.dueAt),
                distance: deadlineDistance(session.dueAt, now)
              })}
            </p>
          )}
        </div>
        <ul className="ml-auto flex flex-wrap gap-2" aria-label={t('dashboard.studentsTitle')}>
          {TALLY_ORDER.filter(({ state }) => state !== 'stuck' || !graded).map(({ state, key }) => (
            <li
              key={state}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink"
            >
              <StateMark state={state} size={12} />
              {t(key, { n: counts[state] })}
            </li>
          ))}
        </ul>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        {session.open && <span className="text-xs text-ink-muted">{t('dashboard.liveUpdating')}</span>}
        {session.open && <SessionControls sessionId={session.id} dueAt={homework ? session.dueAt : null} />}
        <span className="flex-1" />
        {rows.some((row) => row.sourceHash !== null) && (
          <a href={`/api/dashboard/sessions/${session.id}/files`} className="text-accent">
            {t('dashboard.downloadFiles')}
          </a>
        )}
        {grades && rows.length > 0 && (
          <a href={`/api/dashboard/sessions/${session.id}/grades`} className="text-accent">
            {t('dashboard.exportGrades')}
          </a>
        )}
        {rows.length > 0 && (
          <a href={`/api/dashboard/sessions/${session.id}/export`} className="text-accent">
            {t('dashboard.exportCsv')}
          </a>
        )}
        <DeleteSessionButton sessionId={session.id} code={session.code} homework={homework} leaveTo="/dashboard" />
      </div>

      {session.tasks.length > 0 && (
        <section aria-labelledby="class-table" className="mt-5">
          <h2 id="class-table" className="sr-only">
            {t('dashboard.studentsTitle')}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[56rem] border-collapse text-base">
              <thead>
                <tr className="border-b border-line text-left text-sm text-ink-muted">
                  <th className="w-12 py-3 pl-5" aria-hidden="true" />
                  <th className="py-3 pr-4 font-medium">{t('dashboard.columnStudent')}</th>
                  <th className="py-3 pr-4 font-medium">{t('dashboard.columnState')}</th>
                  <th className="py-3 pr-4 font-medium">{t('dashboard.columnTasks')}</th>
                  <th className="py-3 pr-4 text-right font-medium">{t('dashboard.columnAttempts')}</th>
                  <th className="py-3 pr-4 text-right font-medium">{t('dashboard.columnHintsShort')}</th>
                  <th className="py-3 pr-5 font-medium">{t('dashboard.columnLastActivity')}</th>
                  {devices && <th className="py-3 pr-5 text-right font-medium">{t('dashboard.columnDevices')}</th>}
                  {facts && <th className="py-3 pr-5 font-medium">{t('dashboard.columnFacts')}</th>}
                  {grades && (
                    <th className="py-3 pr-5 text-center font-medium">{t('dashboard.columnSuggestedGrade')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const current = student.currentTaskId !== null ? taskIndex.get(student.currentTaskId) : undefined;
                  return (
                    <tr
                      key={student.studentName}
                      data-state={student.state}
                      className="border-b border-line last:border-b-0 even:bg-bg/50"
                    >
                      <td className="py-3.5 pl-5 align-middle leading-none">
                        <StateMark state={student.state} size={16} />
                      </td>
                      <td className="py-3.5 pr-4 font-medium">
                        <Link
                          href={`/dashboard/sessions/${session.id}/students/${encodeURIComponent(student.studentName)}`}
                          className="text-ink underline-offset-4 hover:text-accent hover:underline"
                          aria-label={t('dashboard.openStudentCard', {
                            name: student.studentName
                          })}
                        >
                          {student.studentName}
                        </Link>
                      </td>
                      <td className={`py-3.5 pr-4 font-semibold ${STATE_TEXT_CLASS[student.state]}`}>
                        {stateLabel(student.state)}
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-3">
                          <span className="min-w-14 shrink-0 whitespace-nowrap tabular-nums text-ink">
                            {t('dashboard.tasksDoneValue', {
                              done: student.tasksDone,
                              total: student.tasksTotal
                            })}
                          </span>
                          {session.tasks.length <= MAX_STRIP_TASKS && (
                            <span className="flex max-w-[16rem] flex-wrap gap-1">
                              {student.cells.map((cell, index) => (
                                <CellMark
                                  key={session.tasks[index].id}
                                  status={cell.status}
                                  attempts={cell.attempts}
                                  size={13}
                                  label={t('dashboard.taskStripItem', {
                                    n: index + 1,
                                    title: session.tasks[index].title,
                                    status:
                                      cell.status === 'stuck'
                                        ? t('dashboard.rollupStuck', {
                                            n: cell.attempts
                                          })
                                        : t(CELL_WORD[cell.status])
                                  })}
                                />
                              ))}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 pr-4 text-right tabular-nums text-ink">{student.attempts}</td>
                      <td className="py-3.5 pr-4 text-right tabular-nums text-ink">{student.hints}</td>
                      <td className="py-3.5 pr-5 text-sm">
                        {student.lastActivityAt ? (
                          <>
                            <span className="block text-ink" title={formatClock(student.lastActivityAt)}>
                              {agoText(agoFrom(student.lastActivityAt, now))}
                            </span>
                            {current !== undefined && (
                              <span className="block max-w-[14rem] truncate text-xs text-ink-muted">
                                {t('dashboard.currentTask', {
                                  n: current + 1,
                                  title: session.tasks[current].title
                                })}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      {devices && (
                        <td className="py-3.5 pr-5 text-right tabular-nums">
                          {(devices.get(student.studentName) ?? 0) > 1 ? (
                            <span className="font-semibold text-attention" data-testid="devices-many">
                              {devices.get(student.studentName)}
                            </span>
                          ) : (
                            <span className="text-ink">{devices.get(student.studentName) || '—'}</span>
                          )}
                        </td>
                      )}
                      {facts && (
                        <td className="py-3.5 pr-5">
                          <FactsCell facts={facts.byStudent.get(student.studentName)} />
                        </td>
                      )}
                      {grades && (
                        <td className="py-3.5 pr-5 text-center">
                          {/* Every row comes from the roster, so every name has a suggestion. */}
                          <GradeCell suggestion={grades.get(student.studentName)!} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            {homework
              ? `${t('dashboard.homeworkNote')} ${t('dashboard.factsNote')}`
              : graded
              ? t('dashboard.stuckRuleGraded')
              : t('dashboard.stuckRule', {
                  checks: STUCK_RULES.failedChecks,
                  minutes: STUCK_RULES.idleMinutes
                })}
          </p>
          {grades && !homework && <p className="mt-1 text-xs text-ink-muted">{t('dashboard.gradeNote')}</p>}
          {grades && !sessionAllowsHighBand([...session.tasks, ...session.improvementTasks]) && (
            <p className="mt-1 text-sm text-attention">{t('dashboard.gradeNoHardTask')}</p>
          )}
        </section>
      )}

      {homework && session.tasks.length > 0 && (
        <ClassCheckPanel
          homeworkId={session.id}
          tasks={session.tasks.map(({ id: taskId, title }) => ({ id: taskId, title }))}
          checks={classChecks}
          fixCreditPercent={Math.round(DEFAULT_GRADING.fixCredit * 100)}
        />
      )}

      {rows.some((row) => row.passed) && <RecheckPanel sessionId={session.id} />}

      {session.tasks.length > 0 && (
        <section aria-labelledby="session-tasks" className="mt-8">
          <h2 id="session-tasks" className="text-lg font-semibold text-ink">
            {t('dashboard.tasksSummaryTitle')}
          </h2>
          <ol className="mt-3 grid gap-2 md:grid-cols-2">
            {session.tasks.map((task, index) => {
              const tally = taskTallies[index];
              return (
                <li key={task.id} data-task-id={task.id} className="rounded-lg border border-line bg-surface px-4 py-3">
                  <p className="font-medium text-ink">
                    {index + 1}. {task.title}
                  </p>
                  <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <CellMark status="passed" attempts={0} size={12} decorative />
                      {t('dashboard.tasksSummaryPassed', { n: tally.passed })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CellMark status="stuck" attempts={0} size={12} decorative />
                      {t('dashboard.tasksSummaryTrying', { n: tally.trying })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CellMark status="not_started" attempts={0} size={12} decorative />
                      {t('dashboard.tasksSummaryNotStarted', {
                        n: tally.notStarted
                      })}
                    </span>
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {facts && facts.similarGroups.length > 0 && (
        <section className="mt-8" data-testid="similar-code">
          <h2 className="text-lg font-semibold text-ink">{t('dashboard.similarTitle')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('dashboard.similarNote')}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {facts.similarGroups.map((group) => (
              <li key={`${group.taskId}:${group.studentNames.join(',')}`} className="text-ink">
                {t('dashboard.similarItem', { task: group.taskTitle, names: group.studentNames.join(', ') })}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sharedFiles.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-ink">{t('dashboard.sharedFilesTitle')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('dashboard.sharedFilesNote')}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {sharedFiles.map((group) => (
              <li key={`${group.taskId}:${group.studentNames.join(',')}`} className="text-ink">
                <span className="font-medium">{group.taskTitle}</span>
                {' — '}
                {t('dashboard.sharedFilesStudents', {
                  names: group.studentNames.join(', ')
                })}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="attempts-log" className="mt-8">
        {rows.length === 0 ? (
          <>
            <h2 id="attempts-log" className="text-lg font-semibold text-ink">
              {t('dashboard.attemptsLogSummary', { n: 0 })}
            </h2>
            <p className="mt-2 text-ink-muted">{t('dashboard.attemptsEmpty')}</p>
          </>
        ) : (
          <details>
            <summary className="cursor-pointer">
              <h2 id="attempts-log" className="inline text-lg font-semibold text-ink">
                {t('dashboard.attemptsLogSummary', { n: rows.length })}
              </h2>
            </summary>
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink-muted">
                  <th className="py-2">{t('dashboard.columnStudent')}</th>
                  <th className="py-2">{t('dashboard.columnTask')}</th>
                  <th className="py-2">{t('dashboard.columnResult')}</th>
                  <th className="py-2">{t('dashboard.columnHints')}</th>
                  <th className="py-2">{t('dashboard.columnSubmittedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line">
                    <td className="py-2 text-ink">{row.studentName}</td>
                    <td className="py-2 text-ink">{row.taskTitle}</td>
                    <td className={`py-2 ${row.passed ? 'text-growth' : 'text-attention'}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <CellMark status={row.passed ? 'passed' : 'stuck'} attempts={1} size={11} decorative />
                        {row.passed ? t('dashboard.resultPassed') : t('dashboard.resultNotYet')}
                      </span>
                    </td>
                    <td className="py-2 tabular-nums text-ink">{row.hintsUsed}</td>
                    <td className="py-2 tabular-nums text-ink">{formatClock(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>
    </main>
  );
}
