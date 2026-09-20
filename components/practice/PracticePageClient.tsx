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
import { TaskWorkspace, type AttemptOutcome } from '@/components/task/TaskWorkspace';
import { useLocalProgress } from '@/lib/practice/local-progress';
import { markTaskCompleted } from '@/lib/practice/progress';
import type { Task } from '@/lib/task/types';

interface PracticePageClientProps {
  task: Task;
}

export function PracticePageClient({ task }: PracticePageClientProps) {
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
      <TaskWorkspace task={task} onSubmitAttempt={handleOutcome} />
      <ProgressPanel progress={progress} setProgress={setProgress} currentTaskSlug={task.slug} />
    </div>
  );
}
