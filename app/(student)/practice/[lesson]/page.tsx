import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Explanation } from '@/components/lesson/Explanation';
import { LessonStart } from '@/components/lesson/LessonStart';
import { LessonTaskList } from '@/components/lesson/LessonTaskList';
import { getLesson, listLessonOutline } from '@/lib/db/lessons';
import { lessonNeighbours } from '@/lib/lessons/view';
import { t } from '@/lib/i18n';

/**
 * One lesson: where it sits among the grade's lessons and the way into its
 * tasks first, then the explanation, core tasks, additional ones, and the
 * neighbouring lessons at the end.
 */
export const dynamic = 'force-dynamic';

export default async function LessonPage({ params }: { params: Promise<{ lesson: string }> }) {
  const { lesson: slug } = await params;
  const lesson = await getLesson(slug);
  if (!lesson) {
    notFound();
  }
  const neighbours = lessonNeighbours(await listLessonOutline(lesson.grade), lesson.slug);
  const steps = lesson.steps.map((step) => ({ slug: step.slug, href: `/practice/${lesson.slug}/${step.slug}` }));

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Link href={`/practice?grade=${lesson.grade}`} className="text-sm font-semibold text-accent hover:underline">
        {t('lessons.allLessons')}
      </Link>
      {neighbours && (
        <p className="mt-3 text-sm font-semibold text-accent">{t('lessons.lessonOf', { n: neighbours.number, total: neighbours.total })}</p>
      )}
      <h1 className="mt-1 text-2xl font-semibold text-ink">{lesson.title}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {lesson.kind === 'mandatory'
          ? t('lessons.kindMandatory')
          : `${t('lessons.kindPractice')} · ${t('lessons.practiceNote')}`}
      </p>
      <div className="mt-4">
        <LessonStart steps={steps} />
      </div>

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

      {neighbours && (neighbours.previous || neighbours.next) && (
        <nav aria-label={t('lessons.lessonNavLabel')} className="mt-10 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
          {neighbours.previous ? (
            <Link
              href={`/practice/${neighbours.previous.slug}`}
              className="flex flex-col rounded-xl border-2 border-line bg-surface px-4 py-3 hover:border-accent"
            >
              <span className="text-xs font-semibold text-accent">← {t('lessons.navPrevLesson')}</span>
              <span className="mt-0.5 font-semibold text-ink">{neighbours.previous.title}</span>
            </Link>
          ) : (
            <span className="max-sm:hidden" />
          )}
          {neighbours.next && (
            <Link
              href={`/practice/${neighbours.next.slug}`}
              className="flex flex-col rounded-xl border-2 border-accent bg-surface px-4 py-3 text-right hover:bg-accent-soft"
            >
              <span className="text-xs font-semibold text-accent">{t('lessons.navNextLesson')} →</span>
              <span className="mt-0.5 font-semibold text-ink">{neighbours.next.title}</span>
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
