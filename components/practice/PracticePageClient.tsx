'use client';

/**
 * Wraps the practice task with local progress tracking: a passed Check marks
 * the task completed in `localStorage`, and `ProgressPanel` offers saving
 * that under a portable code or restoring one from another machine
 * (docs/AI_CONTEXT.md, "Progress Codes"). Kept separate from
 * `app/(student)/practice/page.tsx` because reading `localStorage` needs a
 * client component, while the task itself is still read server-side
 * (CLAUDE.md rule 4).
 */
import { useCallback } from 'react';
import { ProgressPanel } from '@/components/practice/ProgressPanel';
import type { NextTaskAction } from '@/components/task/NextTaskButton';
import { TaskWorkspace, type AttemptOutcome } from '@/components/task/TaskWorkspace';
import { useLocalProgress } from '@/lib/practice/local-progress';
import { markTaskCompleted } from '@/lib/practice/progress';
import type { Task } from '@/lib/task/types';

interface PracticePageClientProps {
  task: Task;
  /** The lesson's next step after a passed Check, or back to the lesson after its last one. */
  next?: NextTaskAction;
}

export function PracticePageClient({ task, next }: PracticePageClientProps) {
  const [progress, setProgress] = useLocalProgress();

  const handleOutcome = useCallback(
    (outcome: AttemptOutcome) => {
      if (!outcome.passed) return;
      setProgress((previous) => markTaskCompleted(previous, task.slug));
    },
    [setProgress, task.slug]
  );

  return (
    <div>
      <TaskWorkspace task={task} onSubmitAttempt={handleOutcome} next={next} />
      <ProgressPanel progress={progress} setProgress={setProgress} currentTaskSlug={task.slug} />
    </div>
  );
}
