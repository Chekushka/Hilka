import { NextResponse } from 'next/server';
import { TEACHER_COOKIE_NAME } from '@/lib/auth/session-cookie';

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url), { status: 303 });
  response.cookies.delete(TEACHER_COOKIE_NAME);
  return response;
}
