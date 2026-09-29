import { PracticeNav } from '@/components/lesson/PracticeNav';
import { TopicMap } from '@/components/meta/TopicMap';
import { listLessonGrades, listLessons, listPracticeTaskMeta } from '@/lib/db/lessons';
import { t } from '@/lib/i18n';

/**
 * The topic map: the same grade and the same local progress as the lesson
 * list, seen as a branch of topics instead of a list of lessons. A static
 * segment, so it wins over `/practice/[lesson]` — no lesson may be slugged
 * "map".
 */
export const dynamic = 'force-dynamic';

export default async function TopicMapPage({ searchParams }: { searchParams: Promise<{ grade?: string }> }) {
  const { grade: gradeParam } = await searchParams;
  const grades = await listLessonGrades();
  const requested = Number(gradeParam);
  const grade = grades.includes(requested) ? requested : grades[0];
  const lessons = grade === undefined ? [] : await listLessons(grade);
  const practiceTasks = grade === undefined ? [] : await listPracticeTaskMeta();

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <h1 className="text-2xl font-semibold text-ink">{t('topicMap.title')}</h1>
      <PracticeNav view="map" grade={grade} grades={grades} />
      {grade === undefined ? (
        <p className="mt-6 text-ink-muted">{t('lessons.empty')}</p>
      ) : (
        <TopicMap
          lessons={lessons.map((lesson) => ({ slug: lesson.slug, taskSlugs: lesson.taskSlugs }))}
          tasks={practiceTasks}
          grade={grade}
        />
      )}
    </main>
  );
}
