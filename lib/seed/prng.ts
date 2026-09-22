/**
 * Deterministic randomness for parameterized task variants
 * (docs/TASK_SCHEMA.md, "Parameterization"): a student always sees the same
 * variant of a task, and a teacher's report can reproduce exactly what that
 * student saw, without storing which values were picked.
 *
 * Pure — no I/O, no globals (CLAUDE.md: lib/seed/ must be pure and unit
 * tested). mulberry32 is the same generator `lib/runner/modules/random.ts`
 * already seeds Python's `random` module with — small, fast, good enough
 * for picking a handful of task parameters, and one fewer algorithm to
 * reason about in this codebase.
 */

/** FNV-1a, 32-bit. Deterministic, good enough distribution for a handful of session/student/task strings — not cryptographic, and doesn't need to be. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * `seed = hash(sessionId + studentName + taskId)` (docs/AI_CONTEXT.md,
 * "Cheating and Trust") — deterministic per (session, student, task), so
 * different students at adjacent desks get different variants and the same
 * student reopening the task gets the same one.
 */
export function deriveSeed(sessionId: string, studentName: string, taskId: string): number {
  return hashString(`${sessionId}\u0000${studentName}\u0000${taskId}`);
}

/** A seeded RNG returning floats in [0, 1) — call repeatedly for a reproducible sequence. */
export type Rng = () => number;

/** mulberry32: same generator as lib/runner/modules/random.ts's Python `random` stub. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0 || 1;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random integer in [min, max], inclusive of both ends. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** A random element of a non-empty array. */
export function randomChoice<T>(rng: Rng, options: readonly T[]): T {
  return options[Math.floor(rng() * options.length)];
}
