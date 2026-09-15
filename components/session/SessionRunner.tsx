'use client';

/**
 * Orchestrates one session after the code has resolved: pick a name, work
 * through the session's tasks in order, record an attempt after each check.
 *
 * Reuses TaskWorkspace as-is — the whole point of the shared task-component
 * interface (docs/AI_CONTEXT.md conventions) is that a session is "the same
 * workspace, driven by a list, with a callback wired up," not a parallel
 * implementation.
 */
import { useEffect, useState } from 'react';
import { NamePicker } from './NamePicker';
import { TaskWorkspace, type TaskAttempt } from '@/components/task/TaskWorkspace';
import { t } from '@/lib/i18n';
import type { JoinableSession } from '@/lib/session/types';
import type { CodeTask } from '@/lib/task/types';

function storageKey(code: string) {
  return `hilka:session:${code}:name`;
}

async function submitAttempt(sessionId: string, studentName: string, task: CodeTask, attempt: TaskAttempt) {
  try {
    await fetch('/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        studentName,
        taskId: task.id,
        taskVersion: task.version,
        code: attempt.code,
        passed: attempt.passed,
        hintsUsed: attempt.hintsUsed,
        durationMs: attempt.durationMs
      })
    });
  } catch {
    // Best-effort telemetry. The student already saw their result via
    // ResultPanel — a lost write here costs the teacher's dashboard a row,
    // never the student their feedback.
  }
}

export function SessionRunner({ session }: { session: JoinableSession }) {
  const [studentName, setStudentName] = useState<string | null>(null);
  const [taskIndex, setTaskIndex] = useState(0);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    // sessionStorage does not exist during server rendering, so the name has
    // to be read post-mount rather than in the initial state — the resulting
    // one-render flash of NamePicker on an already-joined student is the
    // deliberate trade-off, not an oversight the lint rule below is guarding.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStudentName(sessionStorage.getItem(storageKey(session.code)));
  }, [session.code]);

  function pickName(name: string) {
    sessionStorage.setItem(storageKey(session.code), name);
    setStudentName(name);
  }

  if (studentName === null) {
    // Also covers "still reading sessionStorage" — a flash of the picker on
    // an already-joined student is harmless and rare on a fresh page load.
    return <NamePicker roster={session.roster} onPick={pickName} />;
  }

  if (taskIndex >= session.tasks.length) {
    return (
      <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-xl font-semibold text-ink">{t('session.finishedTitle')}</h1>
        <p className="text-ink-muted">{t('session.finishedNote')}</p>
      </main>
    );
  }

  const task = session.tasks[taskIndex];
  const visibleTask: CodeTask = session.hintsEnabled ? task : { ...task, hints: [] };

  return (
    <div>
      <p className="pt-4 text-center text-xs uppercase tracking-wide text-ink-muted">
        {t('session.taskProgress', { current: taskIndex + 1, total: session.tasks.length })}
      </p>
      <TaskWorkspace
        key={task.id}
        task={visibleTask}
        onAttempt={(attempt) => {
          setAttempted(true);
          void submitAttempt(session.id, studentName, task, attempt);
        }}
      />
      {attempted && (
        <div className="flex justify-center pb-6">
          <button
            type="button"
            onClick={() => {
              setAttempted(false);
              setTaskIndex((index) => index + 1);
            }}
            className="rounded-md border border-accent px-4 py-2 text-sm text-accent"
          >
            {t('session.next')}
          </button>
        </div>
      )}
    </div>
  );
}
