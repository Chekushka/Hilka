'use client';

/**
 * Routes on a session's page, after it was created (lib/session/routes.ts): in
 * class the teacher sees who is lost or who has finished early, and puts them
 * on a route then — not only in the builder beforehand. The same panel as the
 * builder's, with a task bank of its own that opens while a route is being
 * filled. Saving replaces the session's routes; the server cleans them the
 * same way as at creation (`PATCH /api/dashboard/sessions/[id]`).
 *
 * It is also where students go on a route when one session went to several
 * classes: the builder gives every class the route tasks, and each class's
 * page picks its own students (`#routes`, opened by `?routes=1`).
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RoutesPanel, type RouteTarget } from '@/components/authoring/RoutesPanel';
import { CatalogSortSelect } from '@/components/authoring/CatalogSortSelect';
import { DifficultyMeter, TaskTagChip, TaskTypeChip } from '@/components/authoring/TaskBadges';
import { TaskFilterBar } from '@/components/authoring/TaskFilterBar';
import { TaskPreviewLink } from '@/components/authoring/TaskPreviewLink';
import { t } from '@/lib/i18n';
import {
  EMPTY_FILTER,
  filterCatalog,
  sortCatalog,
  type CatalogFilter,
  type CatalogSort,
  type CatalogTask
} from '@/lib/task/catalog-filter';
import type { RouteKey, StudentRoutes } from '@/lib/session/routes';

interface SessionRoutesEditorProps {
  sessionId: string;
  students: { id: string; name: string }[];
  /** Every published task, for the bank and the suggestions. */
  tasks: CatalogTask[];
  /** The session's main and improvement tasks: never on a route, and what suggestions follow. */
  mainTaskIds: string[];
  routeTaskIds: Record<RouteKey, string[]>;
  studentRoutes: StudentRoutes;
  /** The class's latest other routed session's routes, for "as last time". */
  lastRoutes: StudentRoutes;
  /** Open the routes at once — the page was opened to set them. */
  defaultOpen: boolean;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const sameRoutes = (a: StudentRoutes, b: StudentRoutes) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

export function SessionRoutesEditor({
  sessionId,
  students,
  tasks,
  mainTaskIds,
  routeTaskIds: savedTaskIds,
  studentRoutes: savedRoutes,
  lastRoutes,
  defaultOpen
}: SessionRoutesEditorProps) {
  const router = useRouter();
  const [routeTaskIds, setRouteTaskIds] = useState(savedTaskIds);
  const [studentRoutes, setStudentRoutes] = useState(savedRoutes);
  const [target, setTarget] = useState<RouteTarget>('main');
  const [filter, setFilter] = useState<CatalogFilter>(EMPTY_FILTER);
  const [sort, setSort] = useState<CatalogSort>('topic');
  const [save, setSave] = useState<SaveState>('idle');
  // A save (or the page's own refresh) brings new saved routes: start from them, as the server cleaned them.
  const savedKey = JSON.stringify([savedTaskIds, Object.entries(savedRoutes).sort()]);
  const [syncedKey, setSyncedKey] = useState(savedKey);
  if (savedKey !== syncedKey) {
    setSyncedKey(savedKey);
    setRouteTaskIds(savedTaskIds);
    setStudentRoutes(savedRoutes);
  }

  const dirty =
    JSON.stringify(routeTaskIds) !== JSON.stringify(savedTaskIds) || !sameRoutes(studentRoutes, savedRoutes);
  const candidates = tasks.filter((task) => !mainTaskIds.includes(task.id));
  const bank = sortCatalog(filterCatalog(candidates, filter), sort);

  function edited<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setSave('idle');
    };
  }

  /** A click in the bank: into the route being filled, or out of it; a task is on one route at most. */
  function toggle(route: RouteKey, id: string) {
    const other: RouteKey = route === 'support' ? 'extension' : 'support';
    const inRoute = routeTaskIds[route].includes(id);
    setRouteTaskIds({
      [route]: inRoute ? routeTaskIds[route].filter((existing) => existing !== id) : [...routeTaskIds[route], id],
      [other]: routeTaskIds[other].filter((existing) => existing !== id)
    } as Record<RouteKey, string[]>);
    setSave('idle');
  }

  async function handleSave() {
    setSave('saving');
    const response = await fetch(`/api/dashboard/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'routes',
        supportTaskIds: routeTaskIds.support,
        extensionTaskIds: routeTaskIds.extension,
        studentRoutes
      })
    }).catch(() => null);
    if (!response?.ok) {
      setSave('error');
      return;
    }
    setSave('saved');
    setTarget('main');
    router.refresh();
  }

  return (
    <section id="routes" className="mt-6 scroll-mt-4 rounded-xl border border-line bg-surface p-5" data-testid="routes-editor">
      <h2 className="text-lg font-semibold text-ink">{t('dashboard.routesEditTitle')}</h2>
      <p className="mt-1 text-sm text-ink-muted">{t('dashboard.routesEditNote')}</p>

      <div className="mt-3 grid items-start gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <RoutesPanel
          students={students}
          lastRoutes={lastRoutes}
          defaultOpen={defaultOpen}
          tasks={tasks}
          mainTaskIds={mainTaskIds}
          routeTaskIds={routeTaskIds}
          onRouteTaskIds={edited(setRouteTaskIds)}
          studentRoutes={studentRoutes}
          onStudentRoutes={edited(setStudentRoutes)}
          target={target}
          onTarget={setTarget}
        />

        {target !== 'main' && (
          <div className="flex min-w-0 flex-col gap-3" data-testid="routes-bank">
            <p className="text-sm font-semibold text-ink">
              {t('dashboard.routesBankTitle', {
                route: t(`routes.name.${target}`)
              })}
            </p>
            <TaskFilterBar
              tasks={candidates}
              filter={filter}
              onChange={setFilter}
              shown={bank.length}
              ids={{
                search: 'routeTaskSearch',
                topic: 'routeTopicFilter',
                grade: 'routeGradeFilter'
              }}
            />
            <CatalogSortSelect id="routeTaskSort" value={sort} onChange={setSort} />
            <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
              {bank.map((task) => (
                <li key={task.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 hover:border-ink-muted">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                      checked={routeTaskIds[target].includes(task.id)}
                      onChange={() => toggle(target, task.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">{task.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                        <span>{task.topicTitle}</span>
                        <DifficultyMeter difficulty={task.difficulty} />
                        {task.tags.map((tag) => (
                          <TaskTagChip key={tag} tag={tag} />
                        ))}
                      </span>
                    </span>
                    <TaskTypeChip type={task.type} />
                    <TaskPreviewLink id={task.id} title={task.title} />
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {(dirty || save !== 'idle') && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!dirty || save === 'saving'}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface disabled:opacity-50"
          >
            {save === 'saving' ? t('dashboard.routesSaving') : t('dashboard.routesSave')}
          </button>
          {save === 'saved' && !dirty && (
            <span role="status" className="text-sm text-growth">
              {t('dashboard.routesSaved')}
            </span>
          )}
          {save === 'error' && (
            <span role="alert" className="text-sm text-attention">
              {t('dashboard.routesSaveError')}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
