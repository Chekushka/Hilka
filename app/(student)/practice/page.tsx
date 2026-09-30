import { LessonList } from '@/components/lesson/LessonList';
import { PracticeNav } from '@/components/lesson/PracticeNav';
import { ProgressSummary } from '@/components/meta/ProgressSummary';
import { listLessonGrades, listLessons, listPracticeTaskMeta } from '@/lib/db/lessons';
import { t } from '@/lib/i18n';

/**
 * A grade's lessons, in order (docs/AI_CONTEXT.md, "Course Structure").
 * Practice lessons are listed like the rest, marked as skippable but not
 * recommended to skip — content is not tied to the timetable, so nothing
 * here is locked or dated.
 */
export const dynamic = 'force-dynamic';

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ grade?: string }> }) {
  const { grade: gradeParam } = await searchParams;
  const grades = await listLessonGrades();
  const requested = Number(gradeParam);
  const grade = grades.includes(requested) ? requested : grades[0];
  const lessons = grade === undefined ? [] : await listLessons(grade);
  // Every grade's tasks, not just this one's: XP is the student's whole total.
  const practiceTasks = grade === undefined ? [] : await listPracticeTaskMeta();

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <h1 className="text-2xl font-semibold text-ink">{t('lessons.title')}</h1>
      <PracticeNav view="lessons" grade={grade} grades={grades} />
      {/* At 1366×768 the lessons stay above the fold: the garden sits beside them,
          not on top. Narrow screens stack it first, as before. */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {grade !== undefined && (
          <aside className="lg:order-2">
            <ProgressSummary tasks={practiceTasks} grade={grade} />
          </aside>
        )}
        <div>
          {lessons.length === 0 ? <p className="text-ink-muted">{t('lessons.empty')}</p> : <LessonList lessons={lessons} />}
        </div>
      </div>
    </main>
  );
}
