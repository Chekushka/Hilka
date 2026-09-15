import { notFound } from 'next/navigation';
import { TaskWorkspace } from '@/components/task/TaskWorkspace';
import { getPublishedCodeTask } from '@/lib/db/tasks';

/**
 * One task, read from the database. A server component does the reading —
 * CLAUDE.md rule 4 — and hands a plain object to the client workspace.
 *
 * Which task is still a constant: task navigation belongs to the session flow,
 * which does not exist yet. What changed is where the content comes from, so a
 * teacher republishing a task changes what the class sees without a deploy.
 */
export const dynamic = 'force-dynamic';

const PRACTICE_TASK_SLUG = 'g7-turtle-square';

export default async function PracticePage() {
  const task = await getPublishedCodeTask(PRACTICE_TASK_SLUG);
  if (!task) {
    // Drafts are invisible to students, so an unpublished task lands here.
    notFound();
  }
  return <TaskWorkspace task={task} />;
}
