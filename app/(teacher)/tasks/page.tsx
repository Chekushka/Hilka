import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ImportExportControls } from '@/components/authoring/ImportExportControls';
import { TaskCatalog } from '@/components/authoring/TaskCatalog';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listTasksForAuthoring } from '@/lib/db/task-authoring';
import { t } from '@/lib/i18n';
import { filterFromParams, type CatalogSort } from '@/lib/task/catalog-filter';

/**
 * Every task, draft and published (docs/TASKS.md, "Task authoring UI") —
 * the entry point for creating one, for finding a draft to finish, and for
 * finding tasks by kind of work and difficulty (components/authoring/TaskCatalog.tsx).
 * The filter comes from the URL, so a link opens the same list.
 */
export const dynamic = 'force-dynamic';

const SORTS: readonly CatalogSort[] = ['topic', 'difficulty', 'title'];

export default async function TasksPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    redirect('/login');
  }

  const [tasks, params] = await Promise.all([listTasksForAuthoring(), searchParams]);
  const sortParam = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const sort = SORTS.find((option) => option === sortParam) ?? 'topic';

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/dashboard" className="text-sm text-accent">
        {t('dashboard.title')}
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{t('authoring.tasksTitle')}</h1>
        <Link href="/tasks/new" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface">
          {t('authoring.newTask')}
        </Link>
      </div>

      <ImportExportControls />

      {tasks.length === 0 ? (
        <p className="mt-6 text-ink-muted">{t('authoring.empty')}</p>
      ) : (
        <TaskCatalog tasks={tasks} initialFilter={filterFromParams(params)} initialSort={sort} />
      )}
    </main>
  );
}
