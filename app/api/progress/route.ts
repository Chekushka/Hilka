/**
 * Saves practice progress under a portable code (docs/AI_CONTEXT.md,
 * "Progress Codes"). With no `code` in the body, or one that does not match
 * an existing row, this mints a fresh code — the client is expected to cache
 * whatever code comes back and send it on every later save, so the same
 * code keeps being reused rather than a new one minted per save.
 */
import { NextResponse } from 'next/server';
import { mintProgressCode, updateProgressCodeState } from '@/lib/db/progress-codes';
import { formatProgressCode, isValidProgressCode, normalizeProgressCode } from '@/lib/practice/code';
import { isValidPracticeProgress, type PracticeProgress } from '@/lib/practice/progress';
import { progressClientKey, progressCodeLimiter } from '@/lib/practice/progress-rate-limiter';

interface RequestBody {
  code?: string;
  state: PracticeProgress;
}

function isValidBody(body: unknown): body is RequestBody {
  if (typeof body !== 'object' || body === null) return false;
  const { code, state } = body as Record<string, unknown>;
  if (code !== undefined && typeof code !== 'string') return false;
  return isValidPracticeProgress(state);
}

export async function POST(request: Request) {
  if (!progressCodeLimiter.attempt(progressClientKey(request))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (body.code) {
    const normalized = normalizeProgressCode(body.code);
    if (isValidProgressCode(normalized) && (await updateProgressCodeState(normalized, body.state))) {
      return NextResponse.json({ code: formatProgressCode(normalized) });
    }
    // Unknown or malformed code (a pruned row, a corrupted local cache): fall
    // through to minting a fresh one rather than failing the save outright.
  }

  const code = await mintProgressCode(body.state);
  return NextResponse.json({ code: formatProgressCode(code) });
}
