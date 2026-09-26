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
import { useCallback, useMemo, useState } from 'react';
import { ProgressPanel } from '@/components/practice/ProgressPanel';
import type { NextTaskAction } from '@/components/task/NextTaskButton';
import { TaskWorkspace, type AttemptOutcome } from '@/components/task/TaskWorkspace';
import { taskXp } from '@/lib/meta/progress';
import { useLocalProgress } from '@/lib/practice/local-progress';
import { hasCompletedTask, markTaskCompleted } from '@/lib/practice/progress';
import { t } from '@/lib/i18n';
import type { Task } from '@/lib/task/types';

interface PracticePageClientProps {
  task: Task;
  /** The lesson's next step after a passed Check, or back to the lesson after its last one. */
  next?: NextTaskAction;
}

export function PracticePageClient({ task, next }: PracticePageClientProps) {
  const [progress, setProgress] = useLocalProgress();
  // XP is earned once per task (lib/meta/progress.ts derives it from completed
  // slugs), so only the pass that first completes it shows what it earned.
  const [firstPass, setFirstPass] = useState(false);

  const handleOutcome = useCallback(
    (outcome: AttemptOutcome) => {
      if (!outcome.passed) return;
      setProgress((previous) => {
        if (!hasCompletedTask(previous, task.slug)) setFirstPass(true);
        return markTaskCompleted(previous, task.slug);
      });
    },
    [setProgress, task.slug]
  );

  const nextWithReward = useMemo(
    () => (next && firstPass ? { ...next, earned: t('meta.xpEarned', { xp: taskXp(task.difficulty) }) } : next),
    [next, firstPass, task.difficulty]
  );

  return (
    <div>
      <TaskWorkspace task={task} onSubmitAttempt={handleOutcome} next={nextWithReward} />
      <ProgressPanel progress={progress} setProgress={setProgress} currentTaskSlug={task.slug} />
    </div>
  );
}
