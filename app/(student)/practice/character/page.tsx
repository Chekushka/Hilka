import { PracticeNav } from '@/components/lesson/PracticeNav';
import { CharacterEditor } from '@/components/meta/CharacterEditor';
import { listLessonGrades, listPracticeTaskMeta } from '@/lib/db/lessons';
import { t } from '@/lib/i18n';

/**
 * Dressing up the practice character (lib/meta/character.ts): what XP is for.
 * XP counts every grade's tasks, so nothing here depends on the grade; the
 * grade only rides along in the switch so the way back keeps it. A static
 * segment, so it wins over `/practice/[lesson]` — no lesson may be slugged
 * "character".
 */
export const dynamic = 'force-dynamic';

export default async function CharacterPage({ searchParams }: { searchParams: Promise<{ grade?: string }> }) {
  const { grade: gradeParam } = await searchParams;
  const grades = await listLessonGrades();
  const requested = Number(gradeParam);
  const grade = grades.includes(requested) ? requested : grades[0];
  const practiceTasks = await listPracticeTaskMeta();

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <h1 className="text-2xl font-semibold text-ink">{t('character.title')}</h1>
      <PracticeNav view="character" grade={grade} grades={grades} />
      <CharacterEditor tasks={practiceTasks.map(({ slug, difficulty }) => ({ slug, difficulty }))} />
    </main>
  );
}
