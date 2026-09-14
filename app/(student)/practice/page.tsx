import { TaskWorkspace } from '@/components/task/TaskWorkspace';
import task from '@/content/seed-tasks/grade7-turtle-square.json';
import type { CodeTask } from '@/lib/task/types';

/**
 * One task, loaded from the JSON that will later come from the database. The
 * vertical slice: prompt → editor → run → check → result.
 */
export default function PracticePage() {
  return <TaskWorkspace task={task as CodeTask} />;
}
