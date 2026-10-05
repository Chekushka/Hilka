'use client';

/**
 * Join-by-code entry (design-brief-python-platform.md, "Entry"): pick a name
 * from the class roster, then work through the session's tasks. Once a name is
 * picked, the student's own attempts are read back from the server
 * (`GET /api/sessions/[code]/me`), so done marks, locks and fixes left survive
 * a reload, another device and another day — homework (docs/HOMEWORK.md)
 * depends on it, and a graded lesson's lock no longer resets on a reload.
 * Every Check is appended to that list as it is posted, and the rules in
 * lib/homework/rules.ts derive everything shown from it; the server applies
 * the same rules and refuses what they do not allow.
 *
 * The student is kept by roster id (lib/classes/roster.ts), so a rename by the
 * teacher mid-session changes nothing here.
 *
 * The stored value is read from sessionStorage through `useSyncExternalStore`
 * rather than an effect: the value only exists in the browser, so the server
 * render and the first client render must agree (null) and the real value
 * appears once React swaps in the client snapshot — the mismatch-free way to
 * read a browser-only store on mount.
 *
 * Exam mode (docs/TASKS.md) is not a separate flag — it is what enforcing the
 * session builder's three existing knobs amounts to: `hintsEnabled` is
 * threaded into `TaskWorkspace`, `timeLimitS` drives the countdown below, and
 * a `'graded'` session locks a task to its first Check (`'practice'` keeps
 * unlimited retries, unchanged) — resolving TASKS.md's open question of
 * whether a graded attempt is final on first submit. Time running out is
 * still enforced only in the UI; a task already submitted is enforced by
 * `POST /api/attempts` as well.
 *
 * Homework adds: the deadline and the late rule above the list, a note that
 * every device is marked (option D — entry stays free), two fixes after a
 * failed first Check, and the improvement tasks once a point is lost. A class
 * check of a homework runs as a graded lesson, with a note saying what it does
 * to the homework's grade.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { NextTaskButton, type NextTaskAction } from '@/components/task/NextTaskButton';
import { PrerequisiteNote } from '@/components/task/PrerequisiteNote';
import { TaskWorkspace, type AttemptOutcome } from '@/components/task/TaskWorkspace';
import { DEFAULT_GRADING } from '@/lib/grading/config';
import { deadlineDistance, formatDeadline } from '@/lib/homework/deadline';
import { checksLeft, improvementOpen, lateCredit, taskState, type SessionRules, type TaskState } from '@/lib/homework/rules';
import { t } from '@/lib/i18n';
import { findStudent, seedKeyOf } from '@/lib/classes/roster';
import { assignTasks } from '@/lib/seed';
import { nextOpenTaskId } from '@/lib/session/next-task';
import { sessionProgress, type SessionProgress } from '@/lib/session/progress';
import { filePrerequisite } from '@/lib/task/prerequisite';
import type { JoinedSession, JoinedSessionTask, OwnAttempt, OwnSessionState } from '@/lib/session/types';
import type { Task } from '@/lib/task/types';

interface SessionRoomProps {
  code: string;
  session: JoinedSession;
}

/** Holds the student's roster id. The key's `name` is historical: it held the name before students had ids. */
function studentStorageKey(code: string) {
  return `hilka:session:${code}:name`;
}

function examStartStorageKey(code: string) {
  return `hilka:session:${code}:examStart`;
}

const noSubscription = () => () => {};

function useStoredStudent(code: string): string | null {
  return useSyncExternalStore(
    noSubscription,
    () => {
      try {
        return sessionStorage.getItem(studentStorageKey(code));
      } catch {
        return null;
      }
    },
    () => null
  );
}

/**
 * The countdown's anchor: the moment this student started the session, kept
 * in sessionStorage (alongside the student, minted in `pickStudent`) so a reload
 * does not hand back extra time.
 */
function useStoredExamStart(code: string): number | null {
  return useSyncExternalStore(
    noSubscription,
    () => {
      try {
        const stored = sessionStorage.getItem(examStartStorageKey(code));
        return stored ? Number(stored) : null;
      } catch {
        return null;
      }
    },
    () => null
  );
}

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const percent = (share: number) => Math.round(share * 100);

/** The note under the deadline: what late work is worth, from the grading config. */
function lateRuleText(): string {
  const [step] = DEFAULT_GRADING.lateSteps;
  return t('session.lateRule', {
    days: Math.round(step.withinHours / 24),
    early: percent(step.credit),
    late: percent(DEFAULT_GRADING.lateCreditBeyond)
  });
}

/** A notice in the room: accent for information, attention for what needs acting on. Never red. */
function Notice({ tone = 'info', children, testId }: { tone?: 'info' | 'attention'; children: ReactNode; testId?: string }) {
  return (
    <p
      data-testid={testId}
      className={`rounded-lg border-l-4 px-4 py-3 text-sm text-ink ${
        tone === 'attention' ? 'border-attention bg-surface' : 'border-accent bg-accent-soft'
      }`}
    >
      {children}
    </p>
  );
}

/** The task list's mark for one task, in words — never colour alone. */
function StatusMark({
  state,
  graded,
  homework,
  left
}: {
  state: TaskState;
  graded: boolean;
  homework: boolean;
  /** Checks this task still allows; null when unlimited. */
  left: number | null;
}) {
  switch (state.status) {
    case 'new':
      return left === null ? null : (
        <span className="text-sm text-ink-muted" data-testid="task-checks-left">
          {t('session.taskChecksLeft', { n: left })}
        </span>
      );
    case 'passed':
      return (
        <span className="text-sm text-growth">
          {!homework
            ? t('session.taskDone')
            : state.viaFix
              ? t('session.statusFixed', { credit: percent(DEFAULT_GRADING.fixCredit) })
              : t('session.statusPassed')}
        </span>
      );
    case 'fixable':
      return <span className="text-sm text-attention">{t('session.statusFixable', { n: state.fixesLeft })}</span>;
    case 'failed':
      return (
        <span className="text-sm text-ink-muted">
          {homework ? t('session.statusFailed') : graded ? t('session.taskSubmitted') : null}
        </span>
      );
    default:
      return null;
  }
}

/** How far through the session the student is: a bar in growth, the count in words, and the Checks left. */
function SessionProgressBar({ progress }: { progress: SessionProgress }) {
  const { passed, total } = progress.main;
  return (
    <section aria-label={t('session.progressLabel')} className="rounded-lg border border-line bg-surface px-4 py-3" data-testid="session-progress">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold text-ink">{t('session.progressDone', { done: passed, total })}</span>
        <span className="text-ink-muted" data-testid="checks-left-total">
          {progress.checksLeft === null
            ? t('session.progressUnlimited')
            : t('session.progressChecksLeft', { n: progress.checksLeft })}
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-shell"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={passed}
        aria-label={t('session.progressDone', { done: passed, total })}
      >
        <div className="h-full rounded-full bg-growth" style={{ width: `${total > 0 ? (passed / total) * 100 : 0}%` }} />
      </div>
    </section>
  );
}

/**
 * What the student takes away once nothing is left to do: how many tasks were
 * solved and, for homework, how. Which tasks — never a grade (docs/AI_CONTEXT.md,
 * "Grading"). The way it is said stays calm whatever the count.
 */
function ResultsSummary({
  progress,
  homework,
  graded,
  timeUp = false
}: {
  progress: SessionProgress;
  homework: boolean;
  graded: boolean;
  timeUp?: boolean;
}) {
  const { main, improvement } = progress;
  const all = main.passed === main.total;
  const title = homework
    ? all
      ? t('session.resultsTitleHomeworkAll')
      : t('session.resultsTitleHomework')
    : all
      ? t('session.resultsTitleAll')
      : t('session.resultsTitle');
  return (
    <section
      aria-labelledby="results-title"
      aria-live="polite"
      data-testid="session-results"
      className={`rounded-lg border-l-4 bg-surface p-4 ${all ? 'border-growth' : 'border-accent'}`}
    >
      {!timeUp && (
        <h2 id="results-title" className={`flex items-center gap-2 text-xl font-semibold ${all ? 'text-growth' : 'text-ink'}`}>
          {all && <span aria-hidden="true">✓</span>}
          {title}
        </h2>
      )}
      <p id={timeUp ? 'results-title' : undefined} className={`text-base text-ink ${timeUp ? '' : 'mt-2'}`}>
        {timeUp
          ? t('session.timeUpResults', { passed: main.passed, total: main.total })
          : t('session.resultsSolved', { passed: main.passed, total: main.total })}
      </p>
      {homework && (
        <ul className="mt-2 space-y-0.5 text-sm text-ink">
          <li>{t('session.resultsFirst', { n: main.passed - main.passedViaFix })}</li>
          {main.passedViaFix > 0 && (
            <li>{t('session.resultsFixed', { n: main.passedViaFix, credit: percent(DEFAULT_GRADING.fixCredit) })}</li>
          )}
          {main.failed > 0 && <li>{t('session.resultsFailed', { n: main.failed })}</li>}
        </ul>
      )}
      {!homework && graded && main.failed > 0 && (
        <p className="mt-1 text-sm text-ink">{t('session.resultsFailed', { n: main.failed })}</p>
      )}
      {improvement &&
        (improvement.notStarted + improvement.inProgress > 0 ? (
          <p className="mt-2 text-sm text-ink">{t('session.resultsImprovementOpen')}</p>
        ) : (
          <p className="mt-2 text-sm text-ink">
            {t('session.resultsImprovement', { passed: improvement.passed, total: improvement.total })}
          </p>
        ))}
      <p className="mt-2 text-sm text-ink-muted">
        {graded ? t('session.resultsTeacherSees') : t('session.resultsPractice')}
      </p>
    </section>
  );
}

export function SessionRoom({ code, session }: SessionRoomProps) {
  const storedRef = useStoredStudent(code);
  const [pickedId, setPickedId] = useState<string | null>(null);
  // A stored student no longer on the roster (removed since) goes back to the name screen.
  const student = findStudent(session.roster, pickedId ?? storedRef);
  const studentId = student?.id ?? null;

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  // What the selected task looked like when it was opened: a homework task
  // passed during this visit keeps its success moment, one already passed
  // before opens on the "counted" screen instead.
  const [openedAs, setOpenedAs] = useState<TaskState['status'] | null>(null);
  const [taskCache, setTaskCache] = useState<Record<string, Task>>({});
  const [taskLoadFailed, setTaskLoadFailed] = useState<string | null>(null);
  const fetchedRef = useRef<Set<string>>(new Set());
  const [own, setOwn] = useState<OwnSessionState | null>(null);
  const graded = session.mode === 'graded';
  const homework = session.kind === 'homework';
  const classCheck = session.kind === 'check' && (
    <Notice testId="check-notice">
      {t('session.checkNotice', { credit: percent(DEFAULT_GRADING.fixCredit) })}
    </Notice>
  );
  // This student's own tasks, in their own order: all of them, or a pool drawn for them, maybe
  // shuffled (lib/seed/assignment.ts) — the server draws the same.
  const myTasks: JoinedSessionTask[] = student
    ? assignTasks(
        session.tasks.map((task) => task.id),
        session.id,
        seedKeyOf(student),
        session.assignment
      ).flatMap((taskId) => session.tasks.filter((task) => task.id === taskId))
    : session.tasks;
  // The student's route tasks, if the teacher gave them a route (lib/session/routes.ts): read with their attempts.
  const routeTasks: JoinedSessionTask[] = own?.routeTasks ?? [];
  const rules: SessionRules = {
    kind: session.kind,
    mode: session.mode,
    taskIds: myTasks.map((task) => task.id),
    improvementTaskIds: session.improvementTasks.map((task) => task.id),
    routeTaskIds: routeTasks.map((task) => task.id)
  };
  const attempts: OwnAttempt[] = own?.attempts ?? [];
  const stateOf = (taskId: string) => taskState(rules, taskId, attempts);
  const checksLeftOf = (taskId: string) => checksLeft(rules, taskId, attempts);
  const progress = sessionProgress(rules, attempts);
  const improvementVisible = improvementOpen(rules, attempts);
  const mainAndImprovement = improvementVisible ? [...myTasks, ...session.improvementTasks] : myTasks;
  // A support route's tasks come first — something to finish before the main tasks; an extension route's last.
  const visibleTasks: JoinedSessionTask[] = own?.routeTasksFirst
    ? [...routeTasks, ...mainAndImprovement]
    : [...mainAndImprovement, ...routeTasks];

  const hasTimeLimit = session.timeLimitS !== null;
  const examStart = useStoredExamStart(code);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!hasTimeLimit || examStart === null) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasTimeLimit, examStart]);
  // The deadline is shown in days and hours, so a minute's tick is plenty.
  useEffect(() => {
    if (!session.dueAt) return;
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [session.dueAt]);
  const remainingS =
    hasTimeLimit && examStart !== null
      ? Math.max(0, session.timeLimitS! - Math.floor((nowMs - examStart) / 1000))
      : null;
  const timeUp = remainingS === 0;

  const loadOwnState = useCallback(
    (id: string) => {
      fetch(`/api/sessions/${code}/me?student=${encodeURIComponent(id)}`)
        .then((response) => (response.ok ? (response.json() as Promise<OwnSessionState>) : Promise.reject()))
        .then(setOwn)
        // Unreachable server: the student can still work; the server keeps the count either way.
        .catch(() =>
          setOwn((previous) => previous ?? { attempts: [], usedElsewhere: false, routeTasks: [], routeTasksFirst: false })
        );
    },
    [code]
  );

  useEffect(() => {
    if (studentId) loadOwnState(studentId);
  }, [studentId, loadOwnState]);

  useEffect(() => {
    if (!selectedTaskId || !studentId || fetchedRef.current.has(selectedTaskId)) return;
    fetchedRef.current.add(selectedTaskId);
    let cancelled = false;
    // `student` lets a parameterized task (docs/TASK_SCHEMA.md) resolve to
    // this student's own variant server-side; a task with no params ignores it.
    fetch(`/api/sessions/${code}/tasks/${selectedTaskId}?student=${encodeURIComponent(studentId)}`)
      .then((response) => (response.ok ? (response.json() as Promise<Task>) : Promise.reject()))
      .then((task) => {
        if (!cancelled) setTaskCache((previous) => ({ ...previous, [selectedTaskId]: task }));
      })
      .catch(() => {
        if (!cancelled) setTaskLoadFailed(selectedTaskId);
      });
    return () => {
      cancelled = true;
    };
  }, [code, selectedTaskId, studentId]);

  const selectedTask = selectedTaskId ? (taskCache[selectedTaskId] ?? null) : null;

  const pickStudent = useCallback(
    (id: string) => {
      setPickedId(id);
      try {
        sessionStorage.setItem(studentStorageKey(code), id);
        // The exam clock starts the moment the student begins, and only here
        // — reading it back on a later reload never resets it.
        if (session.timeLimitS !== null && !sessionStorage.getItem(examStartStorageKey(code))) {
          sessionStorage.setItem(examStartStorageKey(code), String(Date.now()));
        }
      } catch {
        // Nothing to persist across a reload; the student stays on this page.
      }
    },
    [code, session.timeLimitS]
  );

  function openTask(taskId: string | null) {
    setSelectedTaskId(taskId);
    setOpenedAs(taskId ? stateOf(taskId).status : null);
    window.scrollTo(0, 0);
  }

  function submitAttempt(taskId: string, taskVersion: number, outcome: AttemptOutcome) {
    if (!studentId) return;
    // Appended at once, so the room moves with the Check; the server's answer
    // only matters when it refuses, and then the room re-reads what counts.
    setOwn((previous) => ({
      usedElsewhere: previous?.usedElsewhere ?? false,
      routeTasks: previous?.routeTasks ?? [],
      routeTasksFirst: previous?.routeTasksFirst ?? false,
      attempts: [
        ...(previous?.attempts ?? []),
        {
          taskId,
          passed: outcome.passed,
          score: outcome.score ?? null,
          hintsUsed: outcome.hintsUsed,
          createdAt: new Date().toISOString()
        }
      ]
    }));
    // Best-effort: a lost attempt does not block the student from moving on.
    fetch('/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        studentId,
        taskId,
        taskVersion,
        submittedAnswer: outcome.submittedAnswer,
        passed: outcome.passed,
        ...(outcome.score !== undefined ? { score: outcome.score } : {}),
        hintsUsed: outcome.hintsUsed,
        durationMs: outcome.durationMs,
        ...(outcome.activity ? { activity: outcome.activity } : {})
      })
    })
      .then((response) => {
        if (response.status === 409) loadOwnState(studentId);
      })
      .catch(() => undefined);
  }

  const lateNow = session.dueAt ? lateCredit(nowMs, Date.parse(session.dueAt)) : 1;
  const deadline = homework && session.dueAt && (
    <div className="space-y-2" data-testid="homework-deadline">
      <p className="text-sm font-semibold text-accent">{t('session.homeworkTitle')}</p>
      <p className="text-base text-ink">
        {t('session.dueAt', { date: formatDeadline(session.dueAt), distance: deadlineDistance(session.dueAt, nowMs) })}
      </p>
      {lateNow < 1 ? (
        <Notice tone="attention" testId="homework-late">
          {t('session.lateNow', { credit: percent(lateNow) })}
        </Notice>
      ) : (
        <p className="text-sm text-ink-muted">{lateRuleText()}</p>
      )}
    </div>
  );

  if (!student) {
    return (
      <main className="mx-auto w-full max-w-3xl p-6">
        <p className="text-sm text-ink-muted">{t('session.sessionCode', { code })}</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{t('session.pickName')}</h1>
        {homework && (
          <div className="mt-4 space-y-3">
            {deadline}
            <Notice testId="device-notice">{t('session.deviceNotice')}</Notice>
          </div>
        )}
        {classCheck && <div className="mt-4">{classCheck}</div>}
        {/* Big targets in a grid: a class of 25 finds a name by scanning, not by reading a line. */}
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {session.roster.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => pickStudent(entry.id)}
                className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-left text-lg text-ink hover:border-accent focus-visible:border-accent"
              >
                {entry.name}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-ink-muted">{t('session.pickNameNote')}</p>
      </main>
    );
  }

  const timerBadge = hasTimeLimit && remainingS !== null && !timeUp && (
    <span
      className="rounded-full bg-shell px-3 py-1 text-sm font-semibold tabular-nums text-ink"
      aria-live="off"
    >
      {t('session.timeRemaining', { time: formatRemaining(remainingS) })}
    </span>
  );

  if (timeUp) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <section className="rounded-md border-l-4 border-attention bg-surface p-4" aria-live="polite">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-attention">
            <span aria-hidden="true">◷</span>
            {t('session.timeUpTitle')}
          </h1>
          <p className="mt-2 text-ink">{t('session.timeUpNote')}</p>
        </section>
        {own && (
          <div className="mt-4">
            <ResultsSummary progress={progress} homework={homework} graded={graded} timeUp />
          </div>
        )}
      </main>
    );
  }

  if (!own) {
    return (
      <main className="mx-auto w-full max-w-2xl p-6">
        <p className="text-sm text-ink-muted">{t('session.loadingState')}</p>
      </main>
    );
  }

  if (selectedTaskId) {
    const state = stateOf(selectedTaskId);
    const isImprovement = rules.improvementTaskIds.includes(selectedTaskId);
    const isRouteTask = rules.routeTaskIds?.includes(selectedTaskId) ?? false;
    // A graded lesson locks a task at its first Check, as it always did. Homework
    // locks once no Check is left, and on reopening a task already counted.
    // A route task is never graded, so it never locks.
    const locked = isRouteTask
      ? false
      : homework
        ? state.status === 'failed' || (state.status === 'passed' && openedAs === 'passed')
        : graded && state.status !== 'new';
    const lockedPassed = state.status === 'passed';
    // Offered only after a passed Check. A locked task is skipped rather than
    // reopened.
    const nextId = nextOpenTaskId(
      visibleTasks.map((task) => task.id),
      selectedTaskId,
      (taskId) => {
        const status = stateOf(taskId).status;
        return status === 'passed' || status === 'failed';
      }
    );
    // A file task's in-browser prerequisite in the teacher's order (lib/task/prerequisite.ts):
    // advice while it is not passed, never a lock.
    const prerequisite = filePrerequisite(
      visibleTasks.map((task) => ({ ...task, topicKey: task.topicId })),
      selectedTaskId
    );
    const prerequisiteState = prerequisite ? stateOf(prerequisite.id).status : null;
    const showPrerequisite =
      prerequisite !== null && prerequisiteState !== 'passed' && prerequisiteState !== 'failed';
    const next: NextTaskAction = {
      kind: 'button',
      label: nextId ? t('result.nextTask') : t('result.backToTaskList'),
      shortLabel: nextId ? t('result.nextShort') : t('result.backToTaskListShort'),
      onSelect: () => openTask(nextId)
    };
    const position = visibleTasks.findIndex((task) => task.id === selectedTaskId) + 1;
    const selectedChecksLeft = checksLeftOf(selectedTaskId);
    const backToList = (
      <button type="button" onClick={() => openTask(null)} className="text-accent">
        ← {t('session.backToList')}
      </button>
    );
    if (locked || !selectedTask) {
      const lockedTitle = homework
        ? lockedPassed
          ? t('session.homeworkPassedTitle')
          : t('session.homeworkFailedTitle')
        : t('session.taskLockedTitle');
      const lockedNote = homework
        ? state.status === 'passed'
          ? state.viaFix
            ? t('session.homeworkFixedNote', { credit: percent(DEFAULT_GRADING.fixCredit) })
            : t('session.homeworkPassedNote')
          : t('session.homeworkFailedNote')
        : lockedPassed
          ? t('session.taskLockedPassedNote')
          : t('session.taskLockedFailedNote');
      return (
        <main className="mx-auto w-full max-w-2xl p-6">
          <div className="flex items-center justify-between text-sm">
            {backToList}
            {timerBadge}
          </div>
          {locked ? (
            <section
              className={`mt-4 rounded-lg border-l-4 ${lockedPassed ? 'border-growth' : 'border-attention'} bg-surface p-4`}
              aria-live="polite"
            >
              <h1
                className={`flex items-center gap-2 text-xl font-semibold ${lockedPassed ? 'text-growth' : 'text-attention'}`}
              >
                <span aria-hidden="true">{lockedPassed ? '✓' : '○'}</span>
                {lockedTitle}
              </h1>
              <p className="mt-2 text-ink">{lockedNote}</p>
              {homework && !lockedPassed && improvementVisible && !isImprovement && (
                <p className="mt-2 text-ink">{t('session.homeworkImprovementHint')}</p>
              )}
              {(lockedPassed || homework) && <NextTaskButton action={next} />}
            </section>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">
              {taskLoadFailed === selectedTaskId ? t('session.closedNote') : t('session.loadingTask')}
            </p>
          )}
        </main>
      );
    }
    const routeNotice = isRouteTask && graded && <Notice testId="route-task-notice">{t('session.routeTaskNotice')}</Notice>;
    const homeworkNotice =
      homework &&
      !isRouteTask &&
      (isImprovement ? (
        <Notice>{t('session.improvementOneCheck')}</Notice>
      ) : state.status === 'new' ? (
        <Notice>
          {t('session.firstCheckCounts', {
            n: DEFAULT_GRADING.maxFixes,
            credit: percent(DEFAULT_GRADING.fixCredit)
          })}
        </Notice>
      ) : state.status === 'fixable' ? (
        <Notice tone="attention" testId="fixes-left">
          {t('session.fixesLeft', { n: state.fixesLeft, credit: percent(DEFAULT_GRADING.fixCredit) })}
        </Notice>
      ) : null);
    return (
      <TaskWorkspace
        key={selectedTask.id}
        task={selectedTask}
        hintsEnabled={session.hintsEnabled}
        next={next}
        onSubmitAttempt={(outcome) => submitAttempt(selectedTask.id, selectedTask.version, outcome)}
        chrome={{
          context: (
            <>
              {backToList}
              <span className="flex-1" />
              {position > 0 && (
                <span className="text-ink-muted">{t('task.position', { n: position, total: visibleTasks.length })}</span>
              )}
              {selectedChecksLeft !== null && (
                <span className="rounded-full bg-shell px-3 py-1 text-ink" data-testid="workspace-checks-left">
                  {t('session.workspaceChecksLeft', { n: selectedChecksLeft })}
                </span>
              )}
              {timerBadge}
            </>
          ),
          notice: (homeworkNotice || routeNotice || showPrerequisite) && (
            <>
              {homeworkNotice && <div className="px-5 pt-4">{homeworkNotice}</div>}
              {routeNotice && <div className="px-5 pt-4">{routeNotice}</div>}
              {showPrerequisite && (
                <PrerequisiteNote
                  action={{
                    kind: 'button',
                    title: prerequisite.title,
                    onSelect: () => openTask(prerequisite.id)
                  }}
                />
              )}
            </>
          )
        }}
      />
    );
  }

  const taskButton = (task: JoinedSessionTask) => (
    <li key={task.id}>
      <button
        type="button"
        data-task-id={task.id}
        onClick={() => openTask(task.id)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-left text-ink hover:border-accent"
      >
        <span>{task.title}</span>
        <StatusMark
          state={stateOf(task.id)}
          graded={graded && !rules.routeTaskIds?.includes(task.id)}
          homework={homework && !rules.routeTaskIds?.includes(task.id)}
          left={checksLeftOf(task.id)}
        />
      </button>
    </li>
  );

  // One neutral heading for either route: nobody reads from the screen which one a classmate is on.
  const routeSection = routeTasks.length > 0 && (
    <section aria-labelledby="route-title" className="space-y-2 pt-2" data-testid="route-tasks">
      <h2 id="route-title" className="text-lg font-semibold text-ink">
        {t('session.routeTitle')}
      </h2>
      <p className="text-sm text-ink-muted">{t(graded ? 'session.routeNoteGraded' : 'session.routeNote')}</p>
      <ul className="space-y-2">{routeTasks.map(taskButton)}</ul>
    </section>
  );

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-6">
      {deadline}
      {classCheck}
      {own.usedElsewhere && (
        <Notice tone="attention" testId="used-elsewhere">
          {t('session.usedElsewhere')}
        </Notice>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">{t('session.taskListTitle')}</h1>
        {timerBadge}
      </div>
      {progress.complete && <ResultsSummary progress={progress} homework={homework} graded={graded} />}
      {myTasks.length > 0 && <SessionProgressBar progress={progress} />}
      {own.routeTasksFirst && routeSection}
      <ul className="space-y-2">{myTasks.map(taskButton)}</ul>
      {improvementVisible && (
        <section aria-labelledby="improvement-title" className="space-y-2 pt-2">
          <h2 id="improvement-title" className="text-lg font-semibold text-ink">
            {t('session.improvementTitle')}
          </h2>
          <p className="text-sm text-ink-muted">{t('session.improvementNote')}</p>
          <ul className="space-y-2">{session.improvementTasks.map(taskButton)}</ul>
        </section>
      )}
      {!own.routeTasksFirst && routeSection}
    </main>
  );
}
