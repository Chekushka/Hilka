/**
 * Sends a notification after the response, the way the magic link goes out
 * (app/api/auth/request-link/route.ts): the response time says nothing
 * about whether an email was sent, and a failure is logged, never shown.
 * Outside a real Vercel deployment with no Resend settings, the email is
 * logged instead, so development and CI can see it.
 */
import { after } from 'next/server';
import { loginEmailConfig, sendEmail, type LoginEmail } from './login-email';

export function deliverInBackground(to: string, email: LoginEmail, what: string): void {
  const config = loginEmailConfig(process.env);
  if (config) {
    after(async () => {
      const result = await sendEmail(to, email, config);
      if (!result.ok) {
        console.error(`[email] ${what} to ${to} failed (${result.status ?? 'network'}): ${result.detail}`);
      }
    });
    return;
  }
  if (process.env.VERCEL) {
    console.error(`[email] RESEND_API_KEY or EMAIL_FROM is not set — ${what} to ${to} was not sent`);
    return;
  }
  console.log(`[email] ${what} to ${to}: ${email.subject}\n${email.text}`);
}
