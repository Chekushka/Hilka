import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Explanation } from '@/components/lesson/Explanation';
import { PracticePageClient } from '@/components/practice/PracticePageClient';
import { getLesson, getPublishedTaskInLesson, listPracticeTaskMeta } from '@/lib/db/lessons';
import { t } from '@/lib/i18n';
import type { Task } from '@/lib/task/types';
import { stepAfter } from '@/lib/lessons/view';
import { filePrerequisite } from '@/lib/task/prerequisite';

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
  // A file task's in-browser prerequisite in this lesson (lib/task/prerequisite.ts), if it has one.
  const prerequisite = filePrerequisite(
    [...lesson.core, ...lesson.additional]
      .filter((summary) => !summary.sessionOnly)
      .map((summary) => ({ ...summary, id: summary.slug, topicKey: summary.topicId, type: summary.type as Task['type'] })),
    task.slug
  );
  // The garden plant this task grows: its topic's practice tasks in this lesson's grade.
  const practiceTasks = await listPracticeTaskMeta();
  const topicSlug = practiceTasks.find((meta) => meta.slug === task.slug)?.topicSlug;
  const topicTasks = practiceTasks.filter((meta) => meta.topicSlug === topicSlug && meta.grades.includes(lesson.grade));
  const topic = topicSlug
    ? { title: topicTasks[0]?.topicTitle ?? '', taskSlugs: topicTasks.map((meta) => meta.slug) }
    : undefined;

  const position = lesson.steps.findIndex((step) => step.slug === task.slug) + 1;

  return (
    <PracticePageClient
      key={task.slug}
      task={task}
      topic={topic}
      prerequisite={
        prerequisite
          ? { slug: prerequisite.slug, title: prerequisite.title, href: `/practice/${lesson.slug}/${prerequisite.slug}` }
          : undefined
      }
      next={
        next
          ? {
              kind: 'link',
              href: `/practice/${lesson.slug}/${next.slug}`,
              label: t('result.nextTask'),
              shortLabel: t('result.nextShort')
            }
          : {
              kind: 'link',
              href: `/practice/${lesson.slug}`,
              label: t('result.backToLesson'),
              shortLabel: t('result.backToLessonShort')
            }
      }
      context={
        <>
          <Link href={`/practice/${lesson.slug}`} className="min-w-0 truncate text-accent">
            {t('lessons.backToLesson')} · {lesson.title}
          </Link>
          <span className="flex-1" />
          {position > 0 && (
            <span className="text-ink-muted">{t('task.position', { n: position, total: lesson.steps.length })}</span>
          )}
          {next ? (
            <Link href={`/practice/${lesson.slug}/${next.slug}`} className="text-accent">
              {t('lessons.nextTask')}
            </Link>
          ) : (
            <span className="text-ink-muted">{t('lessons.lessonFinished')}</span>
          )}
        </>
      }
      // The lesson's own explanation, one click away without leaving the task.
      theory={lesson.explanationMd.trim() ? <Explanation markdown={lesson.explanationMd} /> : undefined}
    />
  );
}
