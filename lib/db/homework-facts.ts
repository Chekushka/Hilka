/**
 * Reads what a homework's facts need and hands it to lib/homework/facts.ts:
 * the session's attempts with their programs and counts, and every published
 * task's programs for what counts as taught so far. Server components only.
 */
import { homeworkFacts, taughtForHomework } from '@/lib/homework/facts';
import { listFactAttempts } from './attempts';
import type { TeacherSessionDetail } from './sessions';
import { listContentPrograms } from './tasks';

export async function loadHomeworkFacts(session: TeacherSessionDetail) {
  const [attempts, content] = await Promise.all([listFactAttempts(session.id), listContentPrograms()]);
  const taught = taughtForHomework(
    [...session.tasks, ...session.improvementTasks].map((task) => task.id),
    content
  );
  const fillTaskIds = new Set(content.filter((task) => task.type === 'fill').map((task) => task.id));
  return homeworkFacts(session.roster, attempts, taught, fillTaskIds);
}
