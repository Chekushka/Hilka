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

export function SessionRoom({ code, session }: SessionRoomProps) {
  const storedName = useStoredName(code);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const studentName = pickedName ?? storedName;

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskCache, setTaskCache] = useState<Record<string, Task>>({});
  const [taskLoadFailed, setTaskLoadFailed] = useState<string | null>(null);
  const fetchedRef = useRef<Set<string>>(new Set());
  const [passed, setPassed] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!selectedTaskId || fetchedRef.current.has(selectedTaskId)) return;
    fetchedRef.current.add(selectedTaskId);
    let cancelled = false;
    fetch(`/api/sessions/${code}/tasks/${selectedTaskId}`)
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
  }, [code, selectedTaskId]);

  const selectedTask = selectedTaskId ? (taskCache[selectedTaskId] ?? null) : null;

  const pickName = useCallback(
    (name: string) => {
      setPickedName(name);
      try {
        sessionStorage.setItem(nameStorageKey(code), name);
      } catch {
        // Nothing to persist across a reload; the student stays on this page.
      }
    },
    [code]
  );

  function submitAttempt(taskId: string, taskVersion: number, outcome: AttemptOutcome) {
    if (!studentName) return;
    if (outcome.passed) {
      setPassed((previous) => new Set(previous).add(taskId));
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

  if (selectedTaskId) {
    return (
      <div>
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <button type="button" onClick={() => setSelectedTaskId(null)} className="text-sm text-accent">
            ← {t('session.backToList')}
          </button>
        </div>
        {selectedTask ? (
          <TaskWorkspace
            key={selectedTask.id}
            task={selectedTask}
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
      <h1 className="text-xl font-semibold text-ink">{t('session.taskListTitle')}</h1>
      <ul className="mt-4 space-y-2">
        {session.tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => setSelectedTaskId(task.id)}
              className="flex w-full items-center justify-between rounded-md border border-line px-4 py-3 text-left text-ink"
            >
              <span>{task.title}</span>
              {passed.has(task.id) && <span className="text-sm text-growth">{t('session.taskDone')}</span>}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
