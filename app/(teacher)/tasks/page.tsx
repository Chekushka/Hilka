import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listTasksForAuthoring } from '@/lib/db/task-authoring';
import { t } from '@/lib/i18n';
import type { TaskStatus } from '@/lib/task/types';

/**
 * Every task, draft and published (docs/TASKS.md, "Task authoring UI") —
 * the entry point for creating one and for finding a draft to finish.
 */
export const dynamic = 'force-dynamic';

function statusLabel(status: TaskStatus): string {
  if (status === 'published') return t('authoring.statusPublished');
  if (status === 'archived') return t('authoring.statusArchived');
  return t('authoring.statusDraft');
}

export default async function TasksPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    redirect('/login');
  }

  const tasks = await listTasksForAuthoring();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/dashboard" className="text-sm text-accent">
        {t('dashboard.title')}
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">{t('authoring.tasksTitle')}</h1>
        <Link href="/tasks/new" className="rounded-md bg-accent px-4 py-2 text-sm text-surface">
          {t('authoring.newTask')}
        </Link>
      </div>

      {tasks.length === 0 ? (
        <p className="mt-6 text-ink-muted">{t('authoring.empty')}</p>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="text-ink-muted">
              <th className="pb-2 font-medium">{t('authoring.columnTitle')}</th>
              <th className="pb-2 font-medium">{t('authoring.columnTopic')}</th>
              <th className="pb-2 font-medium">{t('authoring.columnStatus')}</th>
              <th className="pb-2 font-medium">{t('authoring.columnVersion')}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-t border-line">
                <td className="py-2">
                  <Link href={`/tasks/${task.id}`} className="text-accent">
                    {task.title}
                  </Link>
                </td>
                <td className="py-2 text-ink-muted">{task.topicTitle}</td>
                <td className="py-2 text-ink-muted">{statusLabel(task.status)}</td>
                <td className="py-2 text-ink-muted">{task.version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
