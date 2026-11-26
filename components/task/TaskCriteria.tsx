'use client';

/**
 * What a graded task is judged on (lib/task/criteria.ts), shown above its
 * statement and again in the question before handing it in. Generated from the
 * task's checks, so it is there for every task and says exactly what is checked.
 */
import { taskLevel, pointsMessageKey } from '@/lib/grading/explain';
import { taskPoints } from '@/lib/grading/grade';
import { t } from '@/lib/i18n';
import { taskCriteria } from '@/lib/task/criteria';
import type { Task } from '@/lib/task/types';

export function pointsText(points: number): string {
  return t(pointsMessageKey(points), { n: points });
}

/** "This is a medium task — 2 points." */
export function taskWorthText(difficulty: number): string {
  return t('criteria.worth', {
    level: t(`grading.level.${taskLevel(difficulty)}`),
    points: pointsText(taskPoints(difficulty))
  });
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
        <p className="text-sm font-semibold text-ink">{taskWorthText(task.difficulty)}</p>
        <CriteriaList task={task} />
      </div>
    </details>
  );
}
