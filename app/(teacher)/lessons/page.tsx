import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ImportExportControls } from '@/components/authoring/ImportExportControls';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listLessonsForAuthoring } from '@/lib/db/lesson-authoring';
import { t } from '@/lib/i18n';

/**
 * Every lesson, by grade and ministry number (docs/TASKS.md, "Teacher-side
 * lesson authoring") — the entry point for creating one and editing the rest.
 */
export const dynamic = 'force-dynamic';

export default async function LessonsPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    redirect('/login');
  }

  const lessons = await listLessonsForAuthoring();
  const grades = [...new Set(lessons.map((lesson) => lesson.grade))];

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/dashboard" className="text-sm text-accent">
        {t('dashboard.title')}
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">{t('lessonForm.listTitle')}</h1>
        <Link href="/lessons/new" className="rounded-md bg-accent px-4 py-2 text-sm text-surface">
          {t('lessonForm.newLesson')}
        </Link>
      </div>

      <ImportExportControls />

      {lessons.length === 0 && <p className="mt-6 text-ink-muted">{t('lessonForm.listEmpty')}</p>}
      {grades.map((grade) => (
        <section key={grade} className="mt-6">
          <h2 className="text-base font-semibold text-ink">{t('lessons.gradeOption', { grade })}</h2>
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="text-ink-muted">
                <th className="pb-2 font-medium">{t('lessonForm.columnOrder')}</th>
                <th className="pb-2 font-medium">{t('lessonForm.title')}</th>
                <th className="pb-2 font-medium">{t('lessonForm.kind')}</th>
                <th className="pb-2 font-medium">{t('lessonForm.columnTasks')}</th>
              </tr>
            </thead>
            <tbody>
              {lessons
                .filter((lesson) => lesson.grade === grade)
                .map((lesson) => (
                  <tr key={lesson.id} className="border-t border-line">
                    <td className="py-2 text-ink-muted">{lesson.order}</td>
                    <td className="py-2">
                      <Link href={`/lessons/${lesson.id}`} className="text-accent">
                        {lesson.title}
                      </Link>
                    </td>
                    <td className="py-2 text-ink-muted">
                      {lesson.kind === 'mandatory' ? t('lessons.kindMandatory') : t('lessons.kindPractice')}
                    </td>
                    <td className="py-2 text-ink-muted">
                      {t('lessonForm.taskCounts', { core: lesson.coreCount, additional: lesson.additionalCount })}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ))}
    </main>
  );
}
