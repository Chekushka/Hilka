/**
 * Where a session's "next task" button leads: the first task after the
 * current one, in the teacher's order, that this student has not finished —
 * passed, or (graded) already locked by its first Check. Tasks skipped
 * earlier are not jumped back to; `null` sends the student to the task list,
 * where anything left open is still visible.
 */
export function nextOpenTaskId(
  taskIds: readonly string[],
  currentId: string,
  finished: (taskId: string) => boolean
): string | null {
  const index = taskIds.indexOf(currentId);
  if (index < 0) return null;
  return taskIds.slice(index + 1).find((id) => !finished(id)) ?? null;
}
