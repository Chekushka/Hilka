import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME } from '@/lib/auth/admin-cookie';

/** Ends the superuser's session; a form post, so it redirects. */
export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/admin/login', request.url), { status: 303 });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
