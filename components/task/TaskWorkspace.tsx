'use client';

/**
 * Dispatches to the component for the student's task type. Every type
 * TASK_SCHEMA.md documents now has one, and every one of them renders inside
 * WorkspaceFrame, so the screen is the same shape whatever the type. A future
 * type still just means a branch here and a new file in components/task-types/,
 * never touching the session or practice flow that renders this
 * (docs/AI_CONTEXT.md, "Every task type implements one shared component
 * interface").
 */
import { CodeTaskView } from '@/components/task-types/CodeTaskView';
import { FillTaskView } from '@/components/task-types/FillTaskView';
import { FixTaskView } from '@/components/task-types/FixTaskView';
import { ParsonsTaskView } from '@/components/task-types/ParsonsTaskView';
import { PredictTaskView } from '@/components/task-types/PredictTaskView';
import { QuizTaskView } from '@/components/task-types/QuizTaskView';
import type { AttemptOutcome, Task } from '@/lib/task/types';
import type { NextTaskAction } from './NextTaskButton';
import type { WorkspaceChrome } from './WorkspaceFrame';

export type { AttemptOutcome } from '@/lib/task/types';
export type { WorkspaceChrome } from './WorkspaceFrame';

interface TaskWorkspaceProps {
  task: Task;
  /** Fired once per completed Check. Absent in plain practice — only a session records attempts. */
  onSubmitAttempt?: (outcome: AttemptOutcome) => void;
  /** Off in a graded session with hints disabled (docs/TASKS.md, "Exam mode"); on everywhere else. */
  hintsEnabled?: boolean;
  /** Where a passed Check leads — the lesson's next step or the session's next task. */
  next?: NextTaskAction;
  /** The page's own additions to the task panel — where the task sits, advice, the lesson's theory. */
  chrome?: WorkspaceChrome;
}

export function TaskWorkspace({ task, onSubmitAttempt, hintsEnabled = true, next, chrome }: TaskWorkspaceProps) {
  const shared = { onSubmitAttempt, hintsEnabled, next, chrome };
  if (task.type === 'parsons') {
    return <ParsonsTaskView task={task} {...shared} />;
  }
  if (task.type === 'quiz') {
    return <QuizTaskView task={task} {...shared} />;
  }
  if (task.type === 'predict') {
    return <PredictTaskView task={task} {...shared} />;
  }
  if (task.type === 'fix') {
    return <FixTaskView task={task} {...shared} />;
  }
  if (task.type === 'fill') {
    return <FillTaskView task={task} {...shared} />;
  }
  return <CodeTaskView task={task} {...shared} />;
}
