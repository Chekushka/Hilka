/**
 * Requests a magic link and emails it through Resend when `RESEND_API_KEY`
 * and `EMAIL_FROM` are set (lib/auth/login-email.ts). The send runs after
 * the response (`after`), so response time does not reveal whether the
 * address belongs to a teacher.
 *
 * Outside a real Vercel deployment the link is also handed back as
 * `devLoginUrl` and logged, so CI and the Playwright suite can log in without
 * an inbox. Gated on `VERCEL` rather than `NODE_ENV`: both build and
 * `next start` in production mode too. On Vercel the link is never logged —
 * it is a bearer credential.
 *
 * The response is identical whether or not the email belongs to a teacher,
 * and whether or not sending succeeds, so this endpoint cannot be used to
 * find out which emails are registered.
 */
import { after, NextResponse } from 'next/server';
import { loginEmailConfig, sendLoginEmail } from '@/lib/auth/login-email';
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

  const onVercel = Boolean(process.env.VERCEL);
  const teacher = await getTeacherByEmail(body.email.trim().toLowerCase());
  if (!teacher) {
    return NextResponse.json({ ok: true });
  }

  const token = await issueLoginToken(teacher.id);
  const link = new URL(`/api/auth/verify?token=${token}`, request.url).toString();
  const config = loginEmailConfig(process.env);

  if (config) {
    after(async () => {
      const result = await sendLoginEmail(teacher.email, link, config);
      if (!result.ok) {
        console.error(`[auth] login email to ${teacher.email} failed (${result.status ?? 'network'}): ${result.detail}`);
      }
    });
  } else if (onVercel) {
    console.error('[auth] RESEND_API_KEY or EMAIL_FROM is not set — no login email was sent');
  }

  if (onVercel) {
    return NextResponse.json({ ok: true });
  }
  console.log(`[auth] magic link for ${teacher.email}: ${link}`);
  return NextResponse.json({ ok: true, devLoginUrl: link });
}
