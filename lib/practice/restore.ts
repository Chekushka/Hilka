/**
 * Asks the server for a progress code's saved state (POST
 * /api/progress/restore) — shared by the practice page's progress panel and
 * the home page's "continue with a code" form. The caller merges the state
 * into local progress (`mergeProgress`), never replaces it
 * (docs/AI_CONTEXT.md, "Progress Codes").
 */
import type { PracticeProgress } from './progress';

export type RestoreFailure = 'not_found' | 'invalid' | 'rate_limited' | 'error';

export type RestoreOutcome = { ok: true; state: PracticeProgress } | { ok: false; reason: RestoreFailure };

/** The message for each failure, in messages/uk.json. */
export const RESTORE_FAILURE_MESSAGE: Record<RestoreFailure, string> = {
  not_found: 'practice.restoreNotFound',
  invalid: 'practice.restoreInvalidFormat',
  rate_limited: 'practice.restoreRateLimited',
  error: 'practice.restoreError'
};

export async function requestRestore(code: string, fetchImpl: typeof fetch = fetch): Promise<RestoreOutcome> {
  try {
    const response = await fetchImpl('/api/progress/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    if (response.status === 404) return { ok: false, reason: 'not_found' };
    if (response.status === 400) return { ok: false, reason: 'invalid' };
    if (response.status === 429) return { ok: false, reason: 'rate_limited' };
    if (!response.ok) return { ok: false, reason: 'error' };
    const data: { state: PracticeProgress } = await response.json();
    return { ok: true, state: data.state };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
