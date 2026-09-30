/**
 * The two access notifications (docs/AI_CONTEXT.md, "Teacher Auth"), sent
 * through Resend like the magic link (lib/auth/login-email.ts):
 *
 * - a new sign-up request → the superuser, at SUPERUSER_EMAIL, with a link
 *   to /admin;
 * - access granted (approved, re-enabled, or added directly) → the teacher,
 *   with a link to /login. Never a login link itself: that one expires in
 *   15 minutes, and the teacher may read this tomorrow.
 *
 * Rejecting and disabling send nothing.
 */
import { t } from '@/lib/i18n';
import { escapeHtml, type LoginEmail } from './login-email';

function build(subject: string, paragraphs: string[], link: string, button: string, closing?: string): LoginEmail {
  const safeLink = escapeHtml(link);
  return {
    subject,
    text: [...paragraphs.flatMap((p) => [p, '']), link, ...(closing ? ['', closing] : [])].join('\n'),
    html: [
      ...paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
      `<p><a href="${safeLink}">${escapeHtml(button)}</a></p>`,
      `<p>${safeLink}</p>`,
      ...(closing ? [`<p>${escapeHtml(closing)}</p>`] : [])
    ].join('\n')
  };
}

export function buildAccessRequestEmail(teacherEmail: string, adminUrl: string): LoginEmail {
  return build(
    t('accessEmail.requestSubject'),
    [t('accessEmail.requestGreeting'), t('accessEmail.requestBody', { email: teacherEmail })],
    adminUrl,
    t('accessEmail.requestButton')
  );
}

export function buildAccessGrantedEmail(loginUrl: string): LoginEmail {
  return build(
    t('accessEmail.grantedSubject'),
    [t('accessEmail.grantedGreeting'), t('accessEmail.grantedBody')],
    loginUrl,
    t('accessEmail.grantedButton'),
    t('accessEmail.grantedIgnore')
  );
}
