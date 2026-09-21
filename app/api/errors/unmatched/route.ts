/**
 * Where the browser reports a `PyError` no `lib/errors/` rule matched
 * (`lib/errors/unmatched.ts`'s reporter seam). No auth, no session or task
 * reference: this is anonymous telemetry to grow the rule base from, not an
 * attempt, and the body already carries nothing that could identify a
 * student (CLAUDE.md rule 8).
 */
import { NextResponse } from 'next/server';
import { recordUnmatchedError, type UnmatchedErrorInput } from '@/lib/db/unmatched-errors';

function isValidBody(body: unknown): body is UnmatchedErrorInput {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.type === 'string' && typeof b.message === 'string' && typeof b.at === 'number';
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  await recordUnmatchedError(body);
  return NextResponse.json({ ok: true }, { status: 201 });
}
