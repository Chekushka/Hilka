'use client';

/**
 * Dispatches to the component for the student's task type. Every type
 * TASK_SCHEMA.md documents now has one; a future one still just means a
 * branch here and a new file in components/task-types/, never touching the
 * session or practice flow that renders this (docs/AI_CONTEXT.md, "Every
 * task type implements one shared component interface").
 */
import { CodeTaskView } from '@/components/task-types/CodeTaskView';
import { FillTaskView } from '@/components/task-types/FillTaskView';
import { FixTaskView } from '@/components/task-types/FixTaskView';
import { ParsonsTaskView } from '@/components/task-types/ParsonsTaskView';
import { PredictTaskView } from '@/components/task-types/PredictTaskView';
import { QuizTaskView } from '@/components/task-types/QuizTaskView';
import type { AttemptOutcome, Task } from '@/lib/task/types';

export type { AttemptOutcome } from '@/lib/task/types';

interface TaskWorkspaceProps {
  task: Task;
  /** Fired once per completed Check. Absent in plain practice — only a session records attempts. */
  onSubmitAttempt?: (outcome: AttemptOutcome) => void;
  /** Off in a graded session with hints disabled (docs/TASKS.md, "Exam mode"); on everywhere else. */
  hintsEnabled?: boolean;
}

export function TaskWorkspace({ task, onSubmitAttempt, hintsEnabled = true }: TaskWorkspaceProps) {
  if (task.type === 'parsons') {
    return <ParsonsTaskView task={task} onSubmitAttempt={onSubmitAttempt} hintsEnabled={hintsEnabled} />;
  }
  if (task.type === 'quiz') {
    return <QuizTaskView task={task} onSubmitAttempt={onSubmitAttempt} hintsEnabled={hintsEnabled} />;
  }
  if (task.type === 'predict') {
    return <PredictTaskView task={task} onSubmitAttempt={onSubmitAttempt} hintsEnabled={hintsEnabled} />;
  }
  if (task.type === 'fix') {
    return <FixTaskView task={task} onSubmitAttempt={onSubmitAttempt} hintsEnabled={hintsEnabled} />;
  }
  if (task.type === 'fill') {
    return <FillTaskView task={task} onSubmitAttempt={onSubmitAttempt} hintsEnabled={hintsEnabled} />;
  }
  return <CodeTaskView task={task} onSubmitAttempt={onSubmitAttempt} hintsEnabled={hintsEnabled} />;
}
