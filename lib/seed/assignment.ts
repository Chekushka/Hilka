/**
 * Which of a session's tasks a student gets, and in what order
 * (docs/HOMEWORK.md, section 5, "A task pool per student" and "Shuffle").
 * With a pool size K, each student gets K of the teacher's tasks, chosen by a
 * seeded RNG — neighbours can still help each other learn, but cannot hand
 * over a complete set. With shuffle, each student meets their tasks in their
 * own order. Both are derived from the session and the student's seed key
 * (lib/classes/roster.ts, `seedKeyOf`), like a variant's seed: the same student always gets the same tasks in the same
 * order, on any device, and the teacher's report reproduces it.
 *
 * Pure, and shared by the room, `POST /api/attempts` and the dashboard, so the
 * three can never disagree about who was given what.
 */
import { createRng, deriveSeed, type Rng } from './prng';

export interface AssignmentRule {
  /** How many tasks each student gets; null (or at least the task count) for all of them. */
  poolSize: number | null;
  shuffle: boolean;
}

// Not task ids, so they never collide with a variant's seed for a real task.
const POOL_KEY = '\u0001pool';
const ORDER_KEY = '\u0001order';

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The student's task ids, in the order they meet them. Without a pool or shuffle, the teacher's list as is. */
export function assignTasks(
  taskIds: readonly string[],
  sessionId: string,
  seedKey: string,
  rule: AssignmentRule
): string[] {
  let assigned = [...taskIds];
  if (rule.poolSize !== null && rule.poolSize > 0 && rule.poolSize < taskIds.length) {
    const chosen = new Set(
      shuffled(taskIds, createRng(deriveSeed(sessionId, seedKey, POOL_KEY))).slice(0, rule.poolSize)
    );
    // Kept in the teacher's order: the pool decides which, not when.
    assigned = taskIds.filter((taskId) => chosen.has(taskId));
  }
  if (rule.shuffle) {
    assigned = shuffled(assigned, createRng(deriveSeed(sessionId, seedKey, ORDER_KEY)));
  }
  return assigned;
}
