/**
 * The file-delivery sequencing rule (docs/AI_CONTEXT.md, "File Delivery"): a
 * task the student does in IDLE must follow an in-browser task on the same
 * concept, because IDLE shows CPython's raw traceback and the humanized error
 * layer never reaches it.
 *
 * Enforced where tasks are ordered, not where students work. Authoring
 * surfaces (the lesson form, the session builder, the content test) warn about
 * a file task that has no prerequisite; the student only ever sees a note
 * pointing at it, never a lock — practice progress lives in one browser's
 * localStorage, so a lock would shut out a student who did the work on another
 * machine, and a teacher who assigns a file task on its own does so on
 * purpose.
 *
 * "The same concept" is approximated as the same topic, and "an in-browser
 * task" as one where the student writes code (`code`, `fix`, `fill`) — the
 * inline twin of what the file task asks for, not a quiz about it. The
 * prerequisite is the nearest such task earlier in the sequence. Pure, and
 * keyed by whatever the caller orders by (task ids, or slugs in content/).
 */
import type { TaskType } from './types';

export interface SequencedTask {
  /** Unique within the sequence: a task id, or a slug. */
  id: string;
  /** Any stable topic key — an id or a slug, as long as the whole sequence uses the same kind. */
  topicKey: string;
  type: TaskType;
  fileDelivery: boolean;
}

const WRITES_CODE: ReadonlySet<TaskType> = new Set<TaskType>(['code', 'fix', 'fill']);

/** `payload.delivery === 'file'` — read from a raw payload, since not every caller has a typed Task. */
export function isFileDelivery(payload: unknown): boolean {
  return typeof payload === 'object' && payload !== null && (payload as { delivery?: unknown }).delivery === 'file';
}

/**
 * The in-browser task a file task in `sequence` rests on: the nearest earlier
 * task on the same topic that is not itself file-delivered and has the
 * student write code. Null for a task that is not file-delivered, is not in
 * the sequence, or has no such task before it.
 */
export function filePrerequisite<T extends SequencedTask>(sequence: readonly T[], taskId: string): T | null {
  const index = sequence.findIndex((task) => task.id === taskId);
  if (index < 0) return null;
  const fileTask = sequence[index];
  if (!fileTask.fileDelivery) return null;
  for (let i = index - 1; i >= 0; i--) {
    const candidate = sequence[i];
    if (!candidate.fileDelivery && WRITES_CODE.has(candidate.type) && candidate.topicKey === fileTask.topicKey) {
      return candidate;
    }
  }
  return null;
}

/** File-delivered tasks in `sequence` with no prerequisite before them, in order — what authoring warns about. */
export function unsequencedFileTasks<T extends SequencedTask>(sequence: readonly T[]): T[] {
  return sequence.filter((task) => task.fileDelivery && filePrerequisite(sequence, task.id) === null);
}
