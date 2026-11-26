'use client';

/**
 * What a graded task is judged on (lib/task/criteria.ts), shown above its
 * statement and again in the question before handing it in. Generated from the
 * task's checks, so it is there for every task and says exactly what is checked.
 */
import { taskLevel, pointsMessageKey, type TaskLevel } from '@/lib/grading/explain';
import { taskPoints } from '@/lib/grading/grade';
import { t } from '@/lib/i18n';
import { taskCriteria } from '@/lib/task/criteria';
import type { Task } from '@/lib/task/types';

export function pointsText(points: number): string {
  return t(pointsMessageKey(points), { n: points });
}

/** One colour per level, the same in the rules, the task list and above the statement. */
const LEVEL_TONE: Record<TaskLevel, string> = {
  easy: 'border-accent/40 bg-accent-soft text-accent',
  medium: 'border-growth/60 bg-growth/15 text-ink',
  hard: 'border-honey bg-honey-soft text-honey-ink'
};

/** The level and its points ("hard · 3 points") as a small coloured mark. */
export function LevelChip({ difficulty, className = '' }: { difficulty: number; className?: string }) {
  const level = taskLevel(difficulty);
  return (
    <span
      data-testid="level-chip"
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold ${LEVEL_TONE[level]} ${className}`}
    >
      {t('grading.levelChip', { level: t(`grading.level.${level}`), points: pointsText(taskPoints(difficulty)) })}
    </span>
  );
}

/** The criteria as a list, for the panel below and for the confirm question. */
export function CriteriaList({ task }: { task: Task }) {
  const criteria = taskCriteria(task);
  if (criteria.length === 0) return null;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-ink" data-testid="task-criteria-list">
      {criteria.map((criterion) => (
        <li key={`${criterion.key}-${JSON.stringify(criterion.values ?? {})}`}>
          {t(`criteria.items.${criterion.key}`, criterion.values)}
        </li>
      ))}
    </ul>
  );
}

/** The panel above the statement: what the task is worth, then what it is judged on. Open by default. */
export function TaskCriteria({ task }: { task: Task }) {
  return (
    <details open className="group rounded-lg border-l-4 border-accent bg-accent-soft px-4 py-3" data-testid="task-criteria">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 text-sm font-semibold text-ink">
        <span
          aria-hidden="true"
          className="flex h-5 w-5 flex-none items-center justify-center rounded border border-accent text-xs font-bold text-accent"
        >
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">−</span>
        </span>
        {t('criteria.title')}
      </summary>
      <div className="mt-2 space-y-2">
        <p>
          <LevelChip difficulty={task.difficulty} className="text-sm" />
        </p>
        <CriteriaList task={task} />
      </div>
    </details>
  );
}
