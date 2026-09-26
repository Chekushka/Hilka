import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { LessonForm } from '@/components/authoring/LessonForm';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { getLessonForAuthoring, listLessonTaskOptions } from '@/lib/db/lesson-authoring';
import { isUuid } from '@/lib/lessons/authoring';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function EditLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    redirect('/login');
  }
  const { id } = await params;
  const lesson = isUuid(id) ? await getLessonForAuthoring(id) : null;
  if (!lesson) {
    notFound();
  }
  const tasks = await listLessonTaskOptions();
  const { id: lessonId, ...initial } = lesson;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/lessons" className="text-sm text-accent">
        {t('lessonForm.backToLessons')}
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-ink">{t('lessonForm.editTitle', { title: lesson.title })}</h1>
      <LessonForm key={lessonId} lessonId={lessonId} initial={initial} tasks={tasks} />
    </main>
  );
}
