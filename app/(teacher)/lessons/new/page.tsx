import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LessonForm } from '@/components/authoring/LessonForm';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listExistingLessons, listLessonTaskOptions } from '@/lib/db/lesson-authoring';
import { nextLessonOrder } from '@/lib/lessons/authoring';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/** Grade 7 is the only grade with content so far; the teacher changes it in the form. */
const DEFAULT_GRADE = 7;

export default async function NewLessonPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    redirect('/login');
  }

  const [existing, tasks] = await Promise.all([listExistingLessons(), listLessonTaskOptions()]);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/lessons" className="text-sm text-accent">
        {t('lessonForm.backToLessons')}
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-ink">{t('lessonForm.newTitle')}</h1>
      <LessonForm
        tasks={tasks}
        initial={{
          slug: '',
          grade: DEFAULT_GRADE,
          order: nextLessonOrder(existing, DEFAULT_GRADE),
          kind: 'mandatory',
          title: '',
          curriculumRef: null,
          explanationMd: '',
          coreTaskIds: [],
          additionalTaskIds: []
        }}
      />
    </main>
  );
}
