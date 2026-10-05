'use client';

/**
 * Routes in the session builder (lib/session/routes.ts): for each route, the
 * students on it and the extra tasks they get. A student is on one route at
 * most; everyone else gets the main tasks only.
 *
 * The wording is deliberately about the work, not the student: the route
 * names ("step by step", "deeper") say how the tasks go, and students never see either name
 * — the room shows one neutral heading for both. The choice lasts this session
 * only; "as last time" copies the class's last routes, as a fresh choice.
 */
import { useState } from 'react';
import { t } from '@/lib/i18n';
import {
  ROUTE_KEYS,
  routeCounts,
  suggestRouteTasks,
  type RouteCandidate,
  type RouteKey,
  type StudentRoutes
} from '@/lib/session/routes';

/** Which list a click in the task bank fills. */
export type RouteTarget = 'main' | RouteKey;

interface RoutesPanelProps {
  students: { id: string; name: string }[];
  lastRoutes: StudentRoutes;
  tasks: (RouteCandidate & { title: string })[];
  mainTaskIds: string[];
  routeTaskIds: Record<RouteKey, string[]>;
  onRouteTaskIds: (next: Record<RouteKey, string[]>) => void;
  studentRoutes: StudentRoutes;
  onStudentRoutes: (next: StudentRoutes) => void;
  target: RouteTarget;
  onTarget: (target: RouteTarget) => void;
}

export function RoutesPanel({
  students,
  lastRoutes,
  tasks,
  mainTaskIds,
  routeTaskIds,
  onRouteTaskIds,
  studentRoutes,
  onStudentRoutes,
  target,
  onTarget
}: RoutesPanelProps) {
  const counts = routeCounts(studentRoutes);
  const used = counts.support + counts.extension + routeTaskIds.support.length + routeTaskIds.extension.length > 0;
  const [open, setOpen] = useState(used || target !== 'main');
  const titles = new Map(tasks.map((task) => [task.id, task.title]));
  const onRoster = students.filter((student) => lastRoutes[student.id]);
  const lastDiffers =
    onRoster.length > 0 && JSON.stringify(Object.entries(lastRoutes).sort()) !== JSON.stringify(Object.entries(studentRoutes).sort());

  function toggleStudent(studentId: string, route: RouteKey) {
    const next = { ...studentRoutes };
    if (next[studentId] === route) delete next[studentId];
    else next[studentId] = route;
    onStudentRoutes(next);
  }

  function suggest(route: RouteKey) {
    const taken = new Set([...mainTaskIds, ...routeTaskIds.support, ...routeTaskIds.extension]);
    const picked = suggestRouteTasks(route, tasks, mainTaskIds, taken);
    onRouteTaskIds({ ...routeTaskIds, [route]: [...routeTaskIds[route], ...picked] });
  }

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="rounded-lg border border-line"
      data-testid="routes-panel"
    >
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-ink">
        {t('routes.title')}
        {used && (
          <span className="ml-1 font-normal text-ink-muted">
            · {t('routes.summary', { support: counts.support, extension: counts.extension })}
          </span>
        )}
      </summary>
      <div className="flex flex-col gap-4 border-t border-line px-3 py-3">
        <p className="text-xs leading-relaxed text-ink-muted">{t('routes.intro')}</p>
        {lastDiffers && (
          <button
            type="button"
            onClick={() => onStudentRoutes({ ...lastRoutes })}
            className="self-start rounded-lg border border-accent px-3 py-1.5 text-sm text-accent"
          >
            {t('routes.copyLast', { n: onRoster.length })}
          </button>
        )}
        {ROUTE_KEYS.map((route) => {
          const routeTasks = routeTaskIds[route];
          const onRoute = students.filter((student) => studentRoutes[student.id] === route);
          return (
            <section key={route} aria-labelledby={`route-${route}`} className="flex flex-col gap-2" data-testid={`route-${route}`}>
              <h3 id={`route-${route}`} className="text-sm font-semibold text-ink">
                {t(`routes.name.${route}`)}
              </h3>
              <p className="text-xs leading-relaxed text-ink-muted">{t(`routes.describe.${route}`)}</p>

              <p className="text-xs font-medium text-ink-muted">{t('routes.tasksLabel', { n: routeTasks.length })}</p>
              {routeTasks.length > 0 && (
                <ol className="flex flex-col gap-1">
                  {routeTasks.map((id, index) => (
                    <li key={id} className="flex items-center gap-2 rounded-lg bg-shell px-2.5 py-1.5 text-sm text-ink">
                      <span className="w-4 shrink-0 text-right text-xs tabular-nums text-ink-muted">{index + 1}</span>
                      <span className="min-w-0 flex-1 leading-snug">{titles.get(id) ?? id}</span>
                      <button
                        type="button"
                        onClick={() => onRouteTaskIds({ ...routeTaskIds, [route]: routeTasks.filter((existing) => existing !== id) })}
                        aria-label={t('sessionBuilder.remove', { title: titles.get(id) ?? id })}
                        className="h-6 w-6 shrink-0 rounded text-ink-muted hover:text-attention"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={target === route}
                  onClick={() => onTarget(target === route ? 'main' : route)}
                  className={`rounded-lg border px-2.5 py-1 text-xs ${
                    target === route ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:border-accent'
                  }`}
                >
                  {target === route ? t('routes.addingFromBank') : t('routes.addFromBank')}
                </button>
                <button
                  type="button"
                  onClick={() => suggest(route)}
                  disabled={mainTaskIds.length === 0}
                  title={mainTaskIds.length === 0 ? t('routes.suggestNeedsMain') : undefined}
                  className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink hover:border-accent disabled:opacity-50"
                >
                  {t('routes.suggest')}
                </button>
              </div>

              <fieldset>
                <legend className="mb-1 text-xs font-medium text-ink-muted">
                  {t('routes.studentsLabel', { n: onRoute.length })}
                </legend>
                {students.length === 0 ? (
                  <p className="text-xs text-ink-muted">{t('routes.noStudents')}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {students.map((student) => {
                      const on = studentRoutes[student.id] === route;
                      const elsewhere = !on && studentRoutes[student.id] !== undefined;
                      return (
                        <button
                          key={student.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleStudent(student.id, route)}
                          title={elsewhere ? t('routes.movesHere') : undefined}
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            on
                              ? 'border-accent bg-accent text-surface'
                              : elsewhere
                                ? 'border-dashed border-line text-ink-muted'
                                : 'border-line text-ink hover:border-accent'
                          }`}
                        >
                          {student.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </fieldset>

              {onRoute.length > 0 && routeTasks.length === 0 && (
                <p role="status" className="rounded-lg border border-attention p-2 text-xs text-ink">
                  {t('routes.noTasksWarning')}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </details>
  );
}
