/**
 * The superuser's login (lib/auth/superuser.ts). One generic refusal for a
 * wrong login or a wrong password; a 503 when the server is not configured
 * for a superuser (variables missing), with the reason in the server log. Five
 * failed tries per 15 minutes per address, then nothing more is checked
 * until the window passes; a successful login costs nothing.
 */
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_MAX_AGE_S, ADMIN_COOKIE_NAME, createAdminCookieValue } from '@/lib/auth/admin-cookie';
import { clientKey, superuserLoginLimiter } from '@/lib/auth/auth-rate-limit';
import { checkSuperuserCredentials, describeMissing, superuserReadiness } from '@/lib/auth/superuser';

export async function POST(request: Request) {
  const key = clientKey(request);
  if (superuserLoginLimiter.isBlocked(key)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const body: unknown = await request.json().catch(() => null);
  const { login, password } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof login !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const readiness = superuserReadiness(process.env);
  if (!readiness.ready) {
    // A server problem, not a wrong guess: said plainly, and not counted against the limit.
    console.error(`[admin] superuser login refused: ${describeMissing(readiness.missing)}`);
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  if (!checkSuperuserCredentials(login, password, readiness.config)) {
    superuserLoginLimiter.attempt(key);
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, createAdminCookieValue(readiness.config.passwordHash, readiness.secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_COOKIE_MAX_AGE_S
  });
  return response;
}
