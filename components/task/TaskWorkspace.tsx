'use client';

/**
 * Dispatches to the component for the student's task type. Adding an eighth
 * type means adding a branch here and a new file in components/task-types/,
 * never touching the session or practice flow that renders this
 * (docs/AI_CONTEXT.md, "Every task type implements one shared component
 * interface").
 */
import { CodeTaskView } from '@/components/task-types/CodeTaskView';
import { ParsonsTaskView } from '@/components/task-types/ParsonsTaskView';
import type { AttemptOutcome, Task } from '@/lib/task/types';

export type { AttemptOutcome } from '@/lib/task/types';

interface TaskWorkspaceProps {
  task: Task;
  /** Fired once per completed Check. Absent in plain practice — only a session records attempts. */
  onSubmitAttempt?: (outcome: AttemptOutcome) => void;
}

export function TaskWorkspace({ task, onSubmitAttempt }: TaskWorkspaceProps) {
  if (task.type === 'parsons') {
    return <ParsonsTaskView task={task} onSubmitAttempt={onSubmitAttempt} />;
  }
  return <CodeTaskView task={task} onSubmitAttempt={onSubmitAttempt} />;
}
