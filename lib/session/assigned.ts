/**
 * The teacher's side of lib/seed/assignment.ts: for a session with a pool,
 * which of its tasks each roster student was given — for the class table, the
 * student card and the suggested grade. Null when everyone has every task.
 * Pure.
 */
import { seedKeyOf, type RosterStudent } from '@/lib/classes/roster';
import { assignTasks, type AssignmentRule } from '@/lib/seed';

export interface AssignableSession {
  id: string;
  tasks: readonly { id: string }[];
  assignment: AssignmentRule;
}

export type AssignedTo = (student: Pick<RosterStudent, 'id' | 'seed'>) => ReadonlySet<string>;

export function assignedTo(session: AssignableSession): AssignedTo | null {
  const { poolSize } = session.assignment;
  if (poolSize === null || poolSize >= session.tasks.length) return null;
  const taskIds = session.tasks.map((task) => task.id);
  const cache = new Map<string, ReadonlySet<string>>();
  return (student) => {
    let assigned = cache.get(student.id);
    if (!assigned) {
      assigned = new Set(assignTasks(taskIds, session.id, seedKeyOf(student), { poolSize, shuffle: false }));
      cache.set(student.id, assigned);
    }
    return assigned;
  };
}
