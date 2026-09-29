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
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { ProgressPanel } from '@/components/practice/ProgressPanel';
import type { NextTaskAction } from '@/components/task/NextTaskButton';
import { PrerequisiteNote } from '@/components/task/PrerequisiteNote';
import { TaskWorkspace, type AttemptOutcome } from '@/components/task/TaskWorkspace';
import { stageGainedByPass, type PlantStage } from '@/lib/meta/garden';
import { taskXp } from '@/lib/meta/progress';
import { useLocalProgress } from '@/lib/practice/local-progress';
import { hasCompletedTask, markTaskCompleted } from '@/lib/practice/progress';
import { t } from '@/lib/i18n';
import type { Task } from '@/lib/task/types';

interface PracticePageClientProps {
  task: Task;
  /** The lesson's next step after a passed Check, or back to the lesson after its last one. */
  next?: NextTaskAction;
  /** The task's topic in this grade — whose garden plant a first pass may grow. */
  topic?: { title: string; taskSlugs: string[] };
  /** For a file-delivery task: the in-browser task in this lesson it rests on (lib/task/prerequisite.ts). */
  prerequisite?: { slug: string; title: string; href: string };
}

const noSubscription = () => () => {};

export function PracticePageClient({ task, next, topic, prerequisite }: PracticePageClientProps) {
  const [progress, setProgress] = useLocalProgress();
  // The server renders with empty progress; waiting for the browser's own
  // keeps the note from flashing at a student who already passed the prerequisite.
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  // XP is earned once per task (lib/meta/progress.ts derives it from completed
  // slugs), so only the pass that first completes it shows what it earned.
  const [firstPass, setFirstPass] = useState(false);
  const [grewTo, setGrewTo] = useState<PlantStage | null>(null);

  const handleOutcome = useCallback(
    (outcome: AttemptOutcome) => {
      if (!outcome.passed) return;
      setProgress((previous) => {
        if (!hasCompletedTask(previous, task.slug)) {
          setFirstPass(true);
          if (topic) setGrewTo(stageGainedByPass(topic.taskSlugs, new Set(previous.completedTaskSlugs), task.slug));
        }
        return markTaskCompleted(previous, task.slug);
      });
    },
    [setProgress, task.slug, topic]
  );

  const nextWithReward = useMemo(() => {
    if (!next || !firstPass) return next;
    const growth =
      topic && grewTo !== null
        ? { stage: grewTo, label: t('garden.grew', { topic: topic.title, stage: t(`garden.stage${grewTo}`) }) }
        : undefined;
    return { ...next, reward: { xp: t('meta.xpEarned', { xp: taskXp(task.difficulty) }), growth } };
  }, [next, firstPass, grewTo, topic, task.difficulty]);

  return (
    <div>
      {prerequisite && hydrated && !hasCompletedTask(progress, prerequisite.slug) && (
        <PrerequisiteNote action={{ kind: 'link', title: prerequisite.title, href: prerequisite.href }} />
      )}
      <TaskWorkspace task={task} onSubmitAttempt={handleOutcome} next={nextWithReward} />
      <ProgressPanel progress={progress} setProgress={setProgress} currentTaskSlug={task.slug} />
    </div>
  );
}
