import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NewTaskForm } from '@/components/authoring/NewTaskForm';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listTopics } from '@/lib/db/topics';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function NewTaskPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    redirect('/login');
  }

  const topics = await listTopics();

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/tasks" className="text-sm text-accent">
        {t('authoring.backToTasks')}
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-ink">{t('authoring.newTaskTitle')}</h1>
      <NewTaskForm topics={topics} />
    </main>
  );
}
