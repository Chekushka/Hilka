/**
 * Consumes a magic-link token and starts the teacher's signed-cookie session.
 * A missing, expired, reused or unknown token lands back on the login screen
 * with a calm reason to ask for a new one, never a raw error page.
 */
import { NextResponse } from 'next/server';
import { consumeLoginToken } from '@/lib/auth/login-tokens';
import { createTeacherCookie } from '@/lib/auth/session-cookie';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  const teacherId = token ? await consumeLoginToken(token) : null;

  if (!teacherId) {
    return NextResponse.redirect(new URL('/login?error=invalid', request.url));
  }

  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  const cookie = createTeacherCookie(teacherId);
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: cookie.maxAgeS
  });
  return response;
}
