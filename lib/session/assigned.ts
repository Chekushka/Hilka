/**
 * The teacher's side of lib/seed/assignment.ts: for a session with a pool,
 * which of its tasks each roster name was given — for the class table, the
 * student card and the suggested grade. Null when everyone has every task.
 * Pure.
 */
import { assignTasks, type AssignmentRule } from '@/lib/seed';

export interface AssignableSession {
  id: string;
  tasks: readonly { id: string }[];
  assignment: AssignmentRule;
}

export function assignedTo(session: AssignableSession): ((studentName: string) => ReadonlySet<string>) | null {
  const { poolSize } = session.assignment;
  if (poolSize === null || poolSize >= session.tasks.length) return null;
  const taskIds = session.tasks.map((task) => task.id);
  const cache = new Map<string, ReadonlySet<string>>();
  return (studentName) => {
    let assigned = cache.get(studentName);
    if (!assigned) {
      assigned = new Set(assignTasks(taskIds, session.id, studentName, { poolSize, shuffle: false }));
      cache.set(studentName, assigned);
    }
    return assigned;
  };
}
