/**
 * Parsons payload → the draggable pool, and the canonical correct ordering.
 *
 * Nothing here executes: `payload.lines` is already stored in the correct
 * order, so that order — rather than a run of a reference solution — is what
 * the publish gate in app/api/tasks/[id]/publish/route.ts checks against
 * (CLAUDE.md rule 5's counterpart for a task type with no code to run).
 */
import type { Submission } from '@/lib/checker';
import type { ParsonsPayload } from './types';

export interface ParsonsPoolItem {
  /** Position in `payload.lines` for a real line; `lines.length + i` for `distractors[i]` — two disjoint ranges, so a distractor can never collide with a real line's index. */
  poolIndex: number;
  text: string;
  indent: number;
  isDistractor: boolean;
}

/** Every line and distractor, addressable by a single `poolIndex`. */
export function parsonsPool(payload: ParsonsPayload): ParsonsPoolItem[] {
  const lines = payload.lines.map((line, index) => ({
    poolIndex: index,
    text: line.text,
    indent: line.indent,
    isDistractor: false
  }));
  const distractors = (payload.distractors ?? []).map((text, index) => ({
    poolIndex: payload.lines.length + index,
    text,
    indent: 0,
    isDistractor: true
  }));
  return [...lines, ...distractors];
}

/** The only ordering that should ever pass — `payload.lines` in its own order, no distractors. */
export function parsonsCanonicalSubmission(payload: ParsonsPayload): Submission {
  return {
    orderedLines: payload.lines.map((line, index) => ({ index, indent: line.indent }))
  };
}
