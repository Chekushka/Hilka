/**
 * A teacher asks for access (docs/AI_CONTEXT.md, "Teacher Auth"): a new
 * address becomes a `pending` row the superuser approves at /admin. The
 * answer is the same for a new, pending, active or disabled address, so the
 * form cannot be used to find out who has an account. Rate-limited, since
 * each new address writes a row.
 */
import { NextResponse } from 'next/server';
import { clientKey, signupLimiter } from '@/lib/auth/auth-rate-limit';
import { isPlausibleEmail, normalizeEmail } from '@/lib/auth/email';
import { requestTeacherAccess } from '@/lib/db/teachers';

export async function POST(request: Request) {
  if (!signupLimiter.attempt(clientKey(request))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const body: unknown = await request.json().catch(() => null);
  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).email : undefined;
  if (typeof raw !== 'string') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const email = normalizeEmail(raw);
  if (!isPlausibleEmail(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }
  await requestTeacherAccess(email);
  return NextResponse.json({ ok: true });
}
