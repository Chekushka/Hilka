'use client';

/**
 * The teacher's task list (/tasks): every task, draft and published, with the
 * shared filters (TaskFilterBar) and a sort. The filter lives in the page's URL,
 * so opening a task and coming back — or sending the link to a colleague —
 * keeps it. Each row shows what a teacher chooses by: type, topic, grades,
 * difficulty as a meter, and the kind of work as tag chips.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DifficultyMeter, TaskTagChip, TaskTypeChip } from '@/components/authoring/TaskBadges';
import { TaskFilterBar } from '@/components/authoring/TaskFilterBar';
import { t } from '@/lib/i18n';
import {
  filterCatalog,
  filterToParams,
  sortCatalog,
  type CatalogFilter,
  type CatalogSort,
  type CatalogTask
} from '@/lib/task/catalog-filter';
import type { TaskStatus } from '@/lib/task/types';

export interface CatalogRow extends CatalogTask {
  status: TaskStatus;
  version: number;
}

const SORTS: readonly CatalogSort[] = ['topic', 'difficulty', 'title'];

function StatusBadge({ status }: { status: TaskStatus }) {
  const draft = status === 'draft';
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${
        draft ? 'border-dashed border-ink-muted text-ink-muted' : 'border-growth/50 text-ink'
      }`}
    >
      {t(`catalog.status.${status}`)}
    </span>
  );
}

export function TaskCatalog({
  tasks,
  initialFilter,
  initialSort
}: {
  tasks: CatalogRow[];
  initialFilter: CatalogFilter;
  initialSort: CatalogSort;
}) {
  const [filter, setFilter] = useState(initialFilter);
  const [sort, setSort] = useState(initialSort);

  // The URL follows the filter without a navigation: replaceState keeps one history entry per visit.
  useEffect(() => {
    const params = filterToParams(filter);
    if (sort !== 'topic') params.set('sort', sort);
    const query = params.toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }, [filter, sort]);

  const visible = sortCatalog(filterCatalog(tasks, filter), sort);

  return (
    <div className="mt-6 flex flex-col gap-4">
      <TaskFilterBar tasks={tasks} filter={filter} onChange={setFilter} shown={visible.length} showStatus />

      <div className="flex items-center justify-end gap-2 text-sm">
        <label htmlFor="catalogSort" className="text-ink-muted">
          {t('catalog.sortLabel')}
        </label>
        <select
          id="catalogSort"
          value={sort}
          onChange={(event) => setSort(event.target.value as CatalogSort)}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-ink"
        >
          {SORTS.map((option) => (
            <option key={option} value={option}>
              {t(`catalog.sort.${option}`)}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-ink-muted">{t('catalog.noMatches')}</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="task-catalog">
          {visible.map((task) => (
            <li key={task.id}>
              <Link
                href={`/tasks/${task.id}`}
                className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3 hover:border-accent sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-accent">{task.title}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {task.topicTitle}
                    {task.gradeTags.length > 0 && ` · ${t('catalog.grades', { grades: task.gradeTags.join(', ') })}`}
                    {task.status === 'published' && ` · ${t('catalog.version', { version: task.version })}`}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {task.tags.map((tag) => (
                    <TaskTagChip key={tag} tag={tag} />
                  ))}
                  <DifficultyMeter difficulty={task.difficulty} />
                  <TaskTypeChip type={task.type} />
                  <StatusBadge status={task.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
