/**
 * Persists a `PyError` no rule in `lib/errors/` matched — the growth signal
 * for that rule base (docs/AI_CONTEXT.md, "Error Humanization"). Write-only:
 * nothing in the product reads this table back yet, the same way
 * `lib/errors/unmatched.ts` only ever appends in-memory.
 */
import { getDb } from './client';
import { unmatchedErrors } from './schema';

export interface UnmatchedErrorInput {
  type: string;
  message: string;
  /** `Date.now()` from the client, when `lib/errors/` first saw it. */
  at: number;
}

export async function recordUnmatchedError(input: UnmatchedErrorInput): Promise<void> {
  await getDb()
    .insert(unmatchedErrors)
    .values({
      type: input.type,
      message: input.message,
      occurredAt: new Date(input.at)
    });
}
