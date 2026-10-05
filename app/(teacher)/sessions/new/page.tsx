import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SessionBuilderForm } from '@/components/authoring/SessionBuilderForm';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listClassOptionsForTeacher } from '@/lib/db/classes';
import { listLessonsForPicker } from '@/lib/db/lessons';
import { listPublishedTasksForPicker } from '@/lib/db/session-authoring';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function NewSessionPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    redirect('/login');
  }

  const [classes, tasks, lessons] = await Promise.all([
    listClassOptionsForTeacher(teacher.id),
    listPublishedTasksForPicker(),
    listLessonsForPicker()
  ]);

  return (
    <main className="mx-auto w-full max-w-[88rem] px-4 py-6 sm:px-6">
      <Link href="/dashboard" className="text-sm text-accent">
        {t('dashboard.backToDashboard')}
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-ink">{t('sessionBuilder.title')}</h1>
      <SessionBuilderForm
        classes={classes}
        initialClassId={(await searchParams).class}
        tasks={tasks}
        lessons={lessons}
      />
    </main>
  );
}
