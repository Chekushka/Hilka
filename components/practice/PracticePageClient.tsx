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
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ProgressPanel } from '@/components/practice/ProgressPanel';
import type { NextTaskAction } from '@/components/task/NextTaskButton';
import { PrerequisiteNote } from '@/components/task/PrerequisiteNote';
import { TaskWorkspace, type AttemptOutcome } from '@/components/task/TaskWorkspace';
import { itemsLabel, levelRankLabel } from '@/components/meta/character-text';
import { itemsUnlockedBetween, levelForXp, resolveLook } from '@/lib/meta/character';
import { stageGainedByPass, type PlantSpecies, type PlantStage } from '@/lib/meta/garden';
import { taskXp, totalXp, type XpTask } from '@/lib/meta/progress';
import { useLocalProgress } from '@/lib/practice/local-progress';
import { hasCompletedTask, markTaskCompleted } from '@/lib/practice/progress';
import { t } from '@/lib/i18n';
import type { Task } from '@/lib/task/types';

interface PracticePageClientProps {
  task: Task;
  /** The lesson's next step after a passed Check, or back to the lesson after its last one. */
  next?: NextTaskAction;
  /** Every practice task's slug and difficulty: the XP total before and after a pass, so the character can level up. */
  xpTasks: readonly XpTask[];
  /** The task's topic in this grade — whose garden plant a first pass may grow. */
  topic?: { title: string; species: PlantSpecies; taskSlugs: string[] };
  /** For a file-delivery task: the in-browser task in this lesson it rests on (lib/task/prerequisite.ts). */
  prerequisite?: { slug: string; title: string; href: string };
  /** Top of the task panel: back to the lesson, position, the next step. */
  context?: ReactNode;
  /** The lesson's explanation, collapsed in the task panel. */
  theory?: ReactNode;
}

const noSubscription = () => () => {};

export function PracticePageClient({ task, next, xpTasks, topic, prerequisite, context, theory }: PracticePageClientProps) {
  const [progress, setProgress] = useLocalProgress();
  // The server renders with empty progress; waiting for the browser's own
  // keeps the note from flashing at a student who already passed the prerequisite.
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  // XP is earned once per task (lib/meta/progress.ts derives it from completed
  // slugs), so only the pass that first completes it shows what it earned.
  const [firstPass, setFirstPass] = useState(false);
  const [grewTo, setGrewTo] = useState<PlantStage | null>(null);
  // XP before the first pass; what it is after is read from progress itself.
  const [xpBefore, setXpBefore] = useState<number | null>(null);

  const handleOutcome = useCallback(
    (outcome: AttemptOutcome) => {
      if (!outcome.passed) return;
      setProgress((previous) => {
        if (!hasCompletedTask(previous, task.slug)) {
          setFirstPass(true);
          setXpBefore(totalXp(xpTasks, new Set(previous.completedTaskSlugs)));
          if (topic) setGrewTo(stageGainedByPass(topic.taskSlugs, new Set(previous.completedTaskSlugs), task.slug));
        }
        return markTaskCompleted(previous, task.slug);
      });
    },
    [setProgress, task.slug, topic, xpTasks]
  );

  const nextWithReward = useMemo(() => {
    if (!next || !firstPass) return next;
    const growth =
      topic && grewTo !== null
        ? { stage: grewTo, species: topic.species, label: t('garden.grew', { topic: topic.title, stage: t(`garden.stage${grewTo}`) }) }
        : undefined;
    const xpAfter = totalXp(xpTasks, new Set(progress.completedTaskSlugs));
    const levelBefore = levelForXp(xpBefore ?? xpAfter);
    const levelAfter = levelForXp(xpAfter);
    const unlocked = itemsUnlockedBetween(levelBefore, levelAfter);
    const character = {
      xp: xpAfter,
      look: resolveLook(progress.look, levelAfter),
      label: levelRankLabel(levelAfter),
      levelUp:
        levelAfter > levelBefore
          ? { title: t('character.levelUp', { level: levelAfter }), unlocked: t('character.unlocked', { items: itemsLabel(unlocked) }) }
          : undefined
    };
    return { ...next, reward: { xp: t('meta.xpEarned', { xp: taskXp(task.difficulty) }), growth, character } };
  }, [next, firstPass, grewTo, topic, task.difficulty, xpTasks, xpBefore, progress]);

  return (
    <div>
      <TaskWorkspace
        task={task}
        onSubmitAttempt={handleOutcome}
        next={nextWithReward}
        chrome={{
          context,
          theory,
          notice: prerequisite && hydrated && !hasCompletedTask(progress, prerequisite.slug) && (
            <PrerequisiteNote action={{ kind: 'link', title: prerequisite.title, href: prerequisite.href }} />
          )
        }}
      />
      {/* Below the fold on purpose: saving progress is between tasks, not part of one. */}
      <ProgressPanel progress={progress} setProgress={setProgress} currentTaskSlug={task.slug} />
    </div>
  );
}
