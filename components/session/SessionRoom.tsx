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
import { TaskWorkspace, type AttemptOutcome } from '@/components/task/TaskWorkspace';
import { t } from '@/lib/i18n';
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
        hintsUsed: outcome.hintsUsed,
        durationMs: outcome.durationMs
      })
    }).catch(() => undefined);
  }

  if (!studentName) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-semibold text-ink">{t('session.pickName')}</h1>
        <ul className="mt-4 flex flex-wrap gap-2">
          {session.roster.map((name) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => pickName(name)}
                className="rounded-md border border-accent px-4 py-2 text-sm text-accent"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
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
    return (
      <div>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-4">
          <button type="button" onClick={() => setSelectedTaskId(null)} className="text-sm text-accent">
            ← {t('session.backToList')}
          </button>
          {timerBadge}
        </div>
        {locked ? (
          <main className="mx-auto max-w-2xl p-6">
            <section
              className={`rounded-md border-l-4 ${lockedPassed ? 'border-growth' : 'border-attention'} bg-surface p-4`}
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
            </section>
          </main>
        ) : selectedTask ? (
          <TaskWorkspace
            key={selectedTask.id}
            task={selectedTask}
            hintsEnabled={session.hintsEnabled}
            onSubmitAttempt={(outcome) => submitAttempt(selectedTask.id, selectedTask.version, outcome)}
          />
        ) : (
          <p className="p-6 text-sm text-ink-muted">
            {taskLoadFailed === selectedTaskId ? t('session.closedNote') : t('session.loadingTask')}
          </p>
        )}
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
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
              className="flex w-full items-center justify-between rounded-md border border-line px-4 py-3 text-left text-ink"
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
