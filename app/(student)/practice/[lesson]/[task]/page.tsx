import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PracticePageClient } from '@/components/practice/PracticePageClient';
import { getLesson, getPublishedTaskInLesson, listPracticeTaskMeta } from '@/lib/db/lessons';
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
  // The garden plant this task grows: its topic's practice tasks in this lesson's grade.
  const practiceTasks = await listPracticeTaskMeta();
  const topicSlug = practiceTasks.find((meta) => meta.slug === task.slug)?.topicSlug;
  const topicTasks = practiceTasks.filter((meta) => meta.topicSlug === topicSlug && meta.grades.includes(lesson.grade));
  const topic = topicSlug
    ? { title: topicTasks[0]?.topicTitle ?? '', taskSlugs: topicTasks.map((meta) => meta.slug) }
    : undefined;

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
      <PracticePageClient
        key={task.slug}
        task={task}
        topic={topic}
        next={
          next
            ? { kind: 'link', href: `/practice/${lesson.slug}/${next.slug}`, label: t('result.nextTask') }
            : { kind: 'link', href: `/practice/${lesson.slug}`, label: t('result.backToLesson') }
        }
      />
    </div>
  );
}
