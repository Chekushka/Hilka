import { notFound } from 'next/navigation';
import { Explanation } from '@/components/lesson/Explanation';
import { PracticeTaskNav } from '@/components/lesson/PracticeTaskNav';
import { PracticePageClient } from '@/components/practice/PracticePageClient';
import { getLesson, getPublishedTaskInLesson, listLessonOutline, listPracticeTaskMeta } from '@/lib/db/lessons';
import { plantSpecies } from '@/lib/meta/garden';
import { t } from '@/lib/i18n';
import type { Task } from '@/lib/task/types';
import { lessonNeighbours, stepAfter, stepBefore } from '@/lib/lessons/view';
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
  const previous = stepBefore(lesson.steps, task.slug);
  // After the lesson's last task the way on is the next lesson, never a dead end.
  const neighbours = lessonNeighbours(await listLessonOutline(lesson.grade), lesson.slug);
  const nextLesson = neighbours?.next ?? null;
  const lessonHref = `/practice/${lesson.slug}`;
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
    ? {
        title: topicTasks[0]?.topicTitle ?? '',
        species: plantSpecies(topicTasks[0]?.topicOrder ?? 0),
        taskSlugs: topicTasks.map((meta) => meta.slug)
      }
    : undefined;

  const titles = new Map([...lesson.core, ...lesson.additional].map((summary) => [summary.slug, summary.title]));
  const steps = lesson.steps.map((step) => ({
    slug: step.slug,
    title: titles.get(step.slug) ?? step.slug,
    href: `${lessonHref}/${step.slug}`,
    additional: step.role === 'additional'
  }));

  return (
    <PracticePageClient
      key={task.slug}
      task={task}
      topic={topic}
      xpTasks={practiceTasks.map(({ slug, difficulty }) => ({ slug, difficulty }))}
      prerequisite={
        prerequisite
          ? { slug: prerequisite.slug, title: prerequisite.title, href: `/practice/${lesson.slug}/${prerequisite.slug}` }
          : undefined
      }
      next={
        next
          ? {
              kind: 'link',
              href: `${lessonHref}/${next.slug}`,
              label: t('result.nextTask'),
              shortLabel: t('result.nextShort')
            }
          : nextLesson
            ? {
                kind: 'link',
                href: `/practice/${nextLesson.slug}`,
                label: t('result.nextLesson'),
                shortLabel: t('result.nextLessonShort')
              }
            : {
                kind: 'link',
                href: lessonHref,
                label: t('result.backToLesson'),
                shortLabel: t('result.backToLessonShort')
              }
      }
      context={
        <PracticeTaskNav
          grade={lesson.grade}
          lesson={{ title: lesson.title, href: lessonHref, number: neighbours?.number ?? null }}
          steps={steps}
          current={task.slug}
          back={
            previous
              ? { href: `${lessonHref}/${previous.slug}`, label: t('lessons.navPrevTask') }
              : { href: lessonHref, label: t('lessons.navToLesson') }
          }
          on={
            next
              ? { href: `${lessonHref}/${next.slug}`, label: t('lessons.navNextTask') }
              : nextLesson
                ? { href: `/practice/${nextLesson.slug}`, label: t('lessons.navNextLesson') }
                : { href: lessonHref, label: t('lessons.navToLesson') }
          }
        />
      }
      // The lesson's own explanation, one click away without leaving the task.
      theory={lesson.explanationMd.trim() ? <Explanation markdown={lesson.explanationMd} /> : undefined}
    />
  );
}
