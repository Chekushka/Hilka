import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PracticePageClient } from '@/components/practice/PracticePageClient';
import { getLesson, getPublishedTaskInLesson } from '@/lib/db/lessons';
import { t } from '@/lib/i18n';
import { stepAfter } from '@/lib/lessons/view';

/**
 * One task inside a lesson. The task must belong to the lesson and be
 * openable in practice (published, not parameterized) — anything else lands
 * on the same calm not-found screen as an unpublished task.
 */
export const dynamic = 'force-dynamic';

export default async function LessonTaskPage({ params }: { params: Promise<{ lesson: string; task: string }> }) {
  const { lesson: lessonSlug, task: taskSlug } = await params;
  const lesson = await getLesson(lessonSlug);
  if (!lesson) {
    notFound();
  }
  const task = await getPublishedTaskInLesson(lesson, taskSlug);
  if (!task) {
    notFound();
  }
  const next = stepAfter(lesson.steps, task.slug);

  return (
    <div>
      <nav className="flex items-center justify-between gap-4 px-6 pt-4 text-sm">
        <Link href={`/practice/${lesson.slug}`} className="text-accent">
          {t('lessons.backToLesson')} · {lesson.title}
        </Link>
        {next ? (
          <Link href={`/practice/${lesson.slug}/${next.slug}`} className="text-accent">
            {t('lessons.nextTask')}
          </Link>
        ) : (
          <span className="text-ink-muted">{t('lessons.lessonFinished')}</span>
        )}
      </nav>
      <PracticePageClient key={task.slug} task={task} />
    </div>
  );
}
