/**
 * Requests a magic link. No email provider is wired up yet (docs/TASKS.md,
 * "Magic-link auth"), so the link is logged server-side and, outside a real
 * Vercel deployment, handed back in the response for local/CI use — remove
 * `devLoginUrl` once real sending exists.
 *
 * Gated on `VERCEL` rather than `NODE_ENV`: CI and this project's own
 * Playwright suite build and `next start` in production mode too, and both
 * need the link to test the login flow without an inbox.
 *
 * The response is identical whether or not the email belongs to a teacher,
 * so this endpoint cannot be used to find out which emails are registered.
 */
import { NextResponse } from 'next/server';
import { issueLoginToken } from '@/lib/auth/login-tokens';
import { getTeacherByEmail } from '@/lib/db/teachers';

function isValidBody(body: unknown): body is { email: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Record<string, unknown>).email === 'string'
  );
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const teacher = await getTeacherByEmail(body.email.trim().toLowerCase());
  if (teacher) {
    const token = await issueLoginToken(teacher.id);
    const link = new URL(`/api/auth/verify?token=${token}`, request.url).toString();
    console.log(`[auth] magic link for ${teacher.email}: ${link}`);
    return NextResponse.json({
      ok: true,
      devLoginUrl: process.env.VERCEL ? undefined : link
    });
  }

  return NextResponse.json({ ok: true });
}
