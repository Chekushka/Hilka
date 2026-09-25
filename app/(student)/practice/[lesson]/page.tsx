import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Explanation } from '@/components/lesson/Explanation';
import { LessonTaskList } from '@/components/lesson/LessonTaskList';
import { getLesson } from '@/lib/db/lessons';
import { t } from '@/lib/i18n';

/** One lesson: the explanation first, then core tasks, then additional ones. */
export const dynamic = 'force-dynamic';

export default async function LessonPage({ params }: { params: Promise<{ lesson: string }> }) {
  const { lesson: slug } = await params;
  const lesson = await getLesson(slug);
  if (!lesson) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Link href={`/practice?grade=${lesson.grade}`} className="text-sm text-accent">
        {t('lessons.allLessons')}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-ink">{lesson.title}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {lesson.kind === 'mandatory'
          ? t('lessons.kindMandatory')
          : `${t('lessons.kindPractice')} · ${t('lessons.practiceNote')}`}
      </p>

      <section className="mt-6">
        <Explanation markdown={lesson.explanationMd} />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink">{t('lessons.coreTasks')}</h2>
        <div className="mt-3">
          {lesson.core.length === 0 ? (
            <p className="text-ink-muted">{t('lessons.noTasks')}</p>
          ) : (
            <LessonTaskList lessonSlug={lesson.slug} tasks={lesson.core} />
          )}
        </div>
      </section>

      {lesson.additional.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-ink">{t('lessons.additionalTasks')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('lessons.additionalNote')}</p>
          <div className="mt-3">
            <LessonTaskList lessonSlug={lesson.slug} tasks={lesson.additional} />
          </div>
        </section>
      )}
    </main>
  );
}
