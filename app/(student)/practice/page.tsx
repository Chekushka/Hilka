import Link from 'next/link';
import { LessonList } from '@/components/lesson/LessonList';
import { listLessonGrades, listLessons } from '@/lib/db/lessons';
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

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="text-2xl font-semibold text-ink">{t('lessons.title')}</h1>
      {grades.length > 1 && (
        <nav aria-label={t('lessons.gradeLabel')} className="mt-3 flex gap-2">
          {grades.map((option) => (
            <Link
              key={option}
              href={`/practice?grade=${option}`}
              aria-current={option === grade ? 'page' : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${
                option === grade ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-muted'
              }`}
            >
              {t('lessons.gradeOption', { grade: option })}
            </Link>
          ))}
        </nav>
      )}
      <div className="mt-6">
        {lessons.length === 0 ? <p className="text-ink-muted">{t('lessons.empty')}</p> : <LessonList lessons={lessons} />}
      </div>
    </main>
  );
}
