/**
 * Pure helpers around session rows. Kept separate from lib/db/sessions.ts so
 * the ordering logic is unit-testable without a database, the same split
 * task-mapping.ts uses for tasks.
 */
import type { SessionTaskSummary } from '@/lib/session/types';

/**
 * `sessions.task_ids` is the order a student should meet the tasks in; the
 * database query that fetches the rows makes no promise about row order, so
 * this restores it. A task id with no matching row (deleted or unpublished
 * since the session was built) is dropped rather than surfacing a broken
 * entry in the list.
 */
export function orderSessionTasks(
  taskIds: string[],
  rows: SessionTaskSummary[]
): SessionTaskSummary[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return taskIds
    .map((id) => byId.get(id))
    .filter((row): row is SessionTaskSummary => row !== undefined);
}
