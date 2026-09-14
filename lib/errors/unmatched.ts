/**
 * Errors no rule recognized.
 *
 * The rule base only grows from real classroom data, so an unmatched error is
 * the most useful signal this layer produces. Collected here behind a reporter
 * the app installs; the server-side endpoint arrives with the database.
 */
import type { PyError } from '@/lib/runner';

export interface UnmatchedError {
  type: string;
  message: string;
  at: number;
}

type Reporter = (error: UnmatchedError) => void;

const MAX_KEPT = 50;
const collected: UnmatchedError[] = [];
let reporter: Reporter | null = null;

export function setUnmatchedReporter(next: Reporter | null): void {
  reporter = next;
}

export function recordUnmatched(error: PyError): void {
  const entry = { type: error.type, message: error.message, at: Date.now() };
  collected.push(entry);
  if (collected.length > MAX_KEPT) {
    collected.shift();
  }
  reporter?.(entry);
}

/** Everything collected this session, oldest first. */
export function unmatchedErrors(): readonly UnmatchedError[] {
  return collected;
}
