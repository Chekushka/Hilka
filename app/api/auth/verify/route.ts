/**
 * Consumes a magic-link token and starts the teacher's signed-cookie session.
 * A missing, expired, reused or unknown token lands back on the login screen
 * with a calm reason to ask for a new one, never a raw error page.
 */
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { consumeLoginToken } from '@/lib/auth/login-tokens';
import { createTeacherCookie } from '@/lib/auth/session-cookie';
import { getTeacherById } from '@/lib/db/teachers';
import { isSchoolCookieValue, SCHOOL_COOKIE_NAME } from '@/lib/device/school';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  const teacherId = token ? await consumeLoginToken(token) : null;
  // A link issued before the superuser disabled the teacher logs nobody in.
  const teacher = teacherId ? await getTeacherById(teacherId) : null;

  if (!teacherId || teacher?.status !== 'active') {
    return NextResponse.redirect(new URL('/login?error=invalid', request.url));
  }

  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  // A school computer (lib/device/school.ts) keeps the login only until the browser closes.
  const schoolComputer = isSchoolCookieValue((await cookies()).get(SCHOOL_COOKIE_NAME)?.value);
  const cookie = createTeacherCookie(teacherId, { schoolComputer });
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(cookie.maxAgeS === null ? {} : { maxAge: cookie.maxAgeS })
  });
  return response;
}
