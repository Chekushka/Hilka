/**
 * Looks up a progress code (docs/AI_CONTEXT.md, "Progress Codes") and hands
 * back its state. Merging with the caller's own local progress happens
 * client-side (`lib/practice/progress.ts`'s `mergeProgress`) — this route
 * only ever reads and touches `lastSeenAt`, never writes a merged result
 * back, so a restore on one machine cannot clobber what another machine
 * saves moments later.
 */
import { NextResponse } from 'next/server';
import { getProgressCodeStateAndTouch } from '@/lib/db/progress-codes';
import { isValidProgressCode, normalizeProgressCode } from '@/lib/practice/code';
import { progressClientKey, progressCodeLimiter } from '@/lib/practice/progress-rate-limiter';

export async function POST(request: Request) {
  if (!progressCodeLimiter.attempt(progressClientKey(request))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const rawCode =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>).code : undefined;
  if (typeof rawCode !== 'string') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const code = normalizeProgressCode(rawCode);
  if (!isValidProgressCode(code)) {
    return NextResponse.json({ error: 'invalid_format' }, { status: 400 });
  }

  const state = await getProgressCodeStateAndTouch(code);
  if (!state) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ state });
}
