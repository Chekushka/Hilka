/**
 * The superuser's login (lib/auth/superuser.ts). One generic refusal for a
 * wrong login, a wrong password or no superuser configured at all. Five
 * failed tries per 15 minutes per address, then nothing more is checked
 * until the window passes; a successful login costs nothing.
 */
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_MAX_AGE_S, ADMIN_COOKIE_NAME, createAdminCookieValue } from '@/lib/auth/admin-cookie';
import { clientKey, superuserLoginLimiter } from '@/lib/auth/auth-rate-limit';
import { secret } from '@/lib/auth/session-cookie';
import { checkSuperuserCredentials, superuserConfig } from '@/lib/auth/superuser';

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

  const config = superuserConfig(process.env);
  if (!config) {
    console.error('[admin] SUPERUSER_LOGIN or SUPERUSER_PASSWORD_HASH is not set or malformed — superuser login refused');
  }
  if (!config || !checkSuperuserCredentials(login, password, config)) {
    superuserLoginLimiter.attempt(key);
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, createAdminCookieValue(config.passwordHash, secret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_COOKIE_MAX_AGE_S
  });
  return response;
}
