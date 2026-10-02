'use client';

/**
 * Join-by-code entry (design-brief-python-platform.md, "Entry"): pick a name
 * from the class roster, then work through the session's tasks. The "done"
 * marker shown here is a client-side convenience for this visit, not the
 * record of truth — the results dashboard reading from `attempts` is
 * teacher-side work that does not exist yet.
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
 * whether a graded attempt is final on first submit. Time running out or a
 * task already being submitted are both enforced only in the UI, same as
 * every other client-computed result in this flow (CLAUDE.md rule 4 keeps
 * the database out of reach here); a teacher reading the dashboard still
 * sees every attempt actually posted to `/api/attempts`.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { NextTaskButton, type NextTaskAction } from '@/components/task/NextTaskButton';
import { PrerequisiteNote } from '@/components/task/PrerequisiteNote';
import { TaskWorkspace, type AttemptOutcome } from '@/components/task/TaskWorkspace';
import { t } from '@/lib/i18n';
import { nextOpenTaskId } from '@/lib/session/next-task';
import { filePrerequisite } from '@/lib/task/prerequisite';
import type { JoinedSession } from '@/lib/session/types';
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

export function SessionRoom({ code, session }: SessionRoomProps) {
  const storedName = useStoredName(code);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const studentName = pickedName ?? storedName;

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskCache, setTaskCache] = useState<Record<string, Task>>({});
  const [taskLoadFailed, setTaskLoadFailed] = useState<string | null>(null);
  const fetchedRef = useRef<Set<string>>(new Set());
  const [passed, setPassed] = useState<ReadonlySet<string>>(new Set());
  // 'graded' locks a task to its first Check; 'practice' never populates this.
  const [submitted, setSubmitted] = useState<ReadonlyMap<string, boolean>>(new Map());
  const graded = session.mode === 'graded';

  const hasTimeLimit = session.timeLimitS !== null;
  const examStart = useStoredExamStart(code);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!hasTimeLimit || examStart === null) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasTimeLimit, examStart]);
  const remainingS =
    hasTimeLimit && examStart !== null
      ? Math.max(0, session.timeLimitS! - Math.floor((nowMs - examStart) / 1000))
      : null;
  const timeUp = remainingS === 0;

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

  function submitAttempt(taskId: string, taskVersion: number, outcome: AttemptOutcome) {
    if (!studentName) return;
    if (outcome.passed) {
      setPassed((previous) => new Set(previous).add(taskId));
    }
    if (graded) {
      setSubmitted((previous) => new Map(previous).set(taskId, outcome.passed));
    }
    // Best-effort: a lost attempt does not block the student from moving on.
    // Retrying belongs to a sync layer this slice does not build yet.
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
    }).catch(() => undefined);
  }

  if (!studentName) {
    return (
      <main className="mx-auto w-full max-w-3xl p-6">
        <p className="text-sm text-ink-muted">{t('session.sessionCode', { code })}</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{t('session.pickName')}</h1>
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

  if (selectedTaskId) {
    const lockedPassed = submitted.get(selectedTaskId);
    const locked = graded && lockedPassed !== undefined;
    // Offered only after a passed Check. Moving on never touches `submitted`,
    // so a graded task stays locked to its first Check, and a locked one is
    // skipped rather than reopened.
    const nextId = nextOpenTaskId(
      session.tasks.map((task) => task.id),
      selectedTaskId,
      (taskId) => passed.has(taskId) || submitted.has(taskId)
    );
    // A file task's in-browser prerequisite in the teacher's order (lib/task/prerequisite.ts):
    // advice while this visit has not seen it passed, never a lock.
    const prerequisite = filePrerequisite(
      session.tasks.map((task) => ({ ...task, topicKey: task.topicId })),
      selectedTaskId
    );
    const showPrerequisite = prerequisite !== null && !passed.has(prerequisite.id) && !submitted.has(prerequisite.id);
    const next: NextTaskAction = {
      kind: 'button',
      label: nextId ? t('result.nextTask') : t('result.backToTaskList'),
      shortLabel: nextId ? t('result.nextShort') : t('result.backToTaskListShort'),
      onSelect: () => {
        setSelectedTaskId(nextId);
        window.scrollTo(0, 0);
      }
    };
    const position = session.tasks.findIndex((task) => task.id === selectedTaskId) + 1;
    const backToList = (
      <button type="button" onClick={() => setSelectedTaskId(null)} className="text-accent">
        ← {t('session.backToList')}
      </button>
    );
    if (locked || !selectedTask) {
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
                {t('session.taskLockedTitle')}
              </h1>
              <p className="mt-2 text-ink">
                {lockedPassed ? t('session.taskLockedPassedNote') : t('session.taskLockedFailedNote')}
              </p>
              {lockedPassed && <NextTaskButton action={next} />}
            </section>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">
              {taskLoadFailed === selectedTaskId ? t('session.closedNote') : t('session.loadingTask')}
            </p>
          )}
        </main>
      );
    }
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
                <span className="text-ink-muted">{t('task.position', { n: position, total: session.tasks.length })}</span>
              )}
              {timerBadge}
            </>
          ),
          notice: showPrerequisite && (
            <PrerequisiteNote
              action={{
                kind: 'button',
                title: prerequisite.title,
                onSelect: () => {
                  setSelectedTaskId(prerequisite.id);
                  window.scrollTo(0, 0);
                }
              }}
            />
          )
        }}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">{t('session.taskListTitle')}</h1>
        {timerBadge}
      </div>
      <ul className="mt-4 space-y-2">
        {session.tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              data-task-id={task.id}
              onClick={() => setSelectedTaskId(task.id)}
              className="flex w-full items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-left text-ink hover:border-accent"
            >
              <span>{task.title}</span>
              {passed.has(task.id) ? (
                <span className="text-sm text-growth">{t('session.taskDone')}</span>
              ) : (
                submitted.has(task.id) && <span className="text-sm text-ink-muted">{t('session.taskSubmitted')}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
