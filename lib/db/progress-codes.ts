/**
 * `progress_codes` queries (docs/AI_CONTEXT.md, "Progress Codes"). Codes are
 * random, so a collision on insert is expected to be vanishingly rare
 * (31^8 ≈ 8.5 * 10^11 combinations) rather than routine — `mintProgressCode`
 * still retries instead of assuming it can never happen.
 */
import { randomInt } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { PROGRESS_CODE_ALPHABET, PROGRESS_CODE_LENGTH } from '@/lib/practice/code';
import type { PracticeProgress } from '@/lib/practice/progress';
import { getDb } from './client';
import { progressCodes } from './schema';

const MAX_MINT_ATTEMPTS = 5;

function generateCandidateCode(): string {
  let code = '';
  for (let i = 0; i < PROGRESS_CODE_LENGTH; i++) {
    code += PROGRESS_CODE_ALPHABET[randomInt(PROGRESS_CODE_ALPHABET.length)];
  }
  return code;
}

/** Inserts a new row under a freshly generated code and returns it. */
export async function mintProgressCode(state: PracticeProgress): Promise<string> {
  const db = getDb();
  for (let attempt = 0; attempt < MAX_MINT_ATTEMPTS; attempt++) {
    const code = generateCandidateCode();
    const [row] = await db
      .insert(progressCodes)
      .values({ code, state })
      .onConflictDoNothing()
      .returning({ code: progressCodes.code });
    if (row) return row.code;
  }
  throw new Error('mintProgressCode: exhausted retries — the code space should never be this contended');
}

/**
 * Overwrites an existing row's state wholesale — the caller (`POST
 * /api/progress`) already merged its local state before saving, so this is
 * a replace, not the union `mergeProgress` does for a restore. False when
 * the code does not exist, e.g. a pruned or mistyped row.
 */
export async function updateProgressCodeState(code: string, state: PracticeProgress): Promise<boolean> {
  const result = await getDb()
    .update(progressCodes)
    .set({ state, updatedAt: sql`now()` })
    .where(eq(progressCodes.code, code));
  return (result.rowCount ?? 0) > 0;
}

/** Reads a code's state and touches `lastSeenAt`; null when the code does not exist. */
export async function getProgressCodeStateAndTouch(code: string): Promise<PracticeProgress | null> {
  const db = getDb();
  const [row] = await db
    .update(progressCodes)
    .set({ lastSeenAt: sql`now()` })
    .where(eq(progressCodes.code, code))
    .returning({ state: progressCodes.state });
  return row?.state ?? null;
}
