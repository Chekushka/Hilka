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
 * `studentName` is read from sessionStorage through `useSyncExternalStore`
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
import { improvementOpen, lateCredit, taskState, type SessionRules, type TaskState } from '@/lib/homework/rules';
import { t } from '@/lib/i18n';
import { nextOpenTaskId } from '@/lib/session/next-task';
import { filePrerequisite } from '@/lib/task/prerequisite';
import type { JoinedSession, JoinedSessionTask, OwnAttempt, OwnSessionState } from '@/lib/session/types';
import type { Task } from '@/lib/task/types';

interface SessionRoomProps {
  code: string;
  session: JoinedSession;
}

function nameStorageKey(code: string) {
  return `hilka:session:${code}:name`;
}

function examStartStorageKey(code: string) {
  return `hilka:session:${code}:examStart`;
}

const noSubscription = () => () => {};

function useStoredName(code: string): string | null {
  return useSyncExternalStore(
    noSubscription,
    () => {
      try {
        return sessionStorage.getItem(nameStorageKey(code));
      } catch {
        return null;
      }
    },
    () => null
  );
}

/**
 * The countdown's anchor: the moment this student started the session, kept
 * in sessionStorage (alongside the name, minted in `pickName`) so a reload
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
function StatusMark({ state, graded, homework }: { state: TaskState; graded: boolean; homework: boolean }) {
  switch (state.status) {
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

export function SessionRoom({ code, session }: SessionRoomProps) {
  const storedName = useStoredName(code);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const studentName = pickedName ?? storedName;

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
  const rules: SessionRules = {
    kind: session.kind,
    mode: session.mode,
    taskIds: session.tasks.map((task) => task.id),
    improvementTaskIds: session.improvementTasks.map((task) => task.id)
  };
  const attempts: OwnAttempt[] = own?.attempts ?? [];
  const stateOf = (taskId: string) => taskState(rules, taskId, attempts);
  const improvementVisible = improvementOpen(rules, attempts);
  const visibleTasks: JoinedSessionTask[] = improvementVisible
    ? [...session.tasks, ...session.improvementTasks]
    : session.tasks;

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
    (name: string) => {
      fetch(`/api/sessions/${code}/me?student=${encodeURIComponent(name)}`)
        .then((response) => (response.ok ? (response.json() as Promise<OwnSessionState>) : Promise.reject()))
        .then(setOwn)
        // Unreachable server: the student can still work; the server keeps the count either way.
        .catch(() => setOwn((previous) => previous ?? { attempts: [], usedElsewhere: false }));
    },
    [code]
  );

  useEffect(() => {
    if (studentName) loadOwnState(studentName);
  }, [studentName, loadOwnState]);

  useEffect(() => {
    if (!selectedTaskId || !studentName || fetchedRef.current.has(selectedTaskId)) return;
    fetchedRef.current.add(selectedTaskId);
    let cancelled = false;
    // `student` lets a parameterized task (docs/TASK_SCHEMA.md) resolve to
    // this student's own variant server-side; a task with no params ignores it.
    fetch(`/api/sessions/${code}/tasks/${selectedTaskId}?student=${encodeURIComponent(studentName)}`)
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
  }, [code, selectedTaskId, studentName]);

  const selectedTask = selectedTaskId ? (taskCache[selectedTaskId] ?? null) : null;

  const pickName = useCallback(
    (name: string) => {
      setPickedName(name);
      try {
        sessionStorage.setItem(nameStorageKey(code), name);
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
    if (!studentName) return;
    // Appended at once, so the room moves with the Check; the server's answer
    // only matters when it refuses, and then the room re-reads what counts.
    setOwn((previous) => ({
      usedElsewhere: previous?.usedElsewhere ?? false,
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
        studentName,
        taskId,
        taskVersion,
        submittedAnswer: outcome.submittedAnswer,
        passed: outcome.passed,
        ...(outcome.score !== undefined ? { score: outcome.score } : {}),
        hintsUsed: outcome.hintsUsed,
        durationMs: outcome.durationMs
      })
    })
      .then((response) => {
        if (response.status === 409) loadOwnState(studentName);
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

  if (!studentName) {
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
          {session.roster.map((name) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => pickName(name)}
                className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-left text-lg text-ink hover:border-accent focus-visible:border-accent"
              >
                {name}
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
    // A graded lesson locks a task at its first Check, as it always did. Homework
    // locks once no Check is left, and on reopening a task already counted.
    const locked = homework
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
    const homeworkNotice =
      homework &&
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
              {timerBadge}
            </>
          ),
          notice: (homeworkNotice || showPrerequisite) && (
            <>
              {homeworkNotice && <div className="px-5 pt-4">{homeworkNotice}</div>}
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
        <StatusMark state={stateOf(task.id)} graded={graded} homework={homework} />
      </button>
    </li>
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
      <ul className="space-y-2">{session.tasks.map(taskButton)}</ul>
      {improvementVisible && (
        <section aria-labelledby="improvement-title" className="space-y-2 pt-2">
          <h2 id="improvement-title" className="text-lg font-semibold text-ink">
            {t('session.improvementTitle')}
          </h2>
          <p className="text-sm text-ink-muted">{t('session.improvementNote')}</p>
          <ul className="space-y-2">{session.improvementTasks.map(taskButton)}</ul>
        </section>
      )}
    </main>
  );
}
