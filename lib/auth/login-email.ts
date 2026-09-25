/**
 * Sends the magic link by email through Resend's HTTP API
 * (docs/AI_CONTEXT.md, "Teacher Auth"). No SDK: one POST, and `fetch` is
 * injected so the request shape is unit-tested without a network.
 *
 * Configured by two environment variables, both required:
 * `RESEND_API_KEY`, and `EMAIL_FROM` — a sender on a domain verified in
 * Resend, e.g. `Hilka <login@example.org>`.
 */
import { t } from '@/lib/i18n';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface LoginEmailConfig {
  apiKey: string;
  from: string;
}

export function loginEmailConfig(env: Record<string, string | undefined>): LoginEmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  return apiKey && from ? { apiKey, from } : null;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export interface LoginEmail {
  subject: string;
  text: string;
  html: string;
}

export function buildLoginEmail(link: string): LoginEmail {
  const safeLink = escapeHtml(link);
  return {
    subject: t('authEmail.subject'),
    text: [t('authEmail.greeting'), '', t('authEmail.body'), link, '', t('authEmail.ignore')].join('\n'),
    html: [
      `<p>${escapeHtml(t('authEmail.greeting'))}</p>`,
      `<p>${escapeHtml(t('authEmail.body'))}</p>`,
      `<p><a href="${safeLink}">${escapeHtml(t('authEmail.button'))}</a></p>`,
      `<p>${safeLink}</p>`,
      `<p>${escapeHtml(t('authEmail.ignore'))}</p>`
    ].join('\n')
  };
}

export type SendResult = { ok: true } | { ok: false; status: number | null; detail: string };

export async function sendLoginEmail(
  to: string,
  link: string,
  config: LoginEmailConfig,
  fetchImpl: typeof fetch = fetch
): Promise<SendResult> {
  const email = buildLoginEmail(link);
  try {
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.from, to: [to], subject: email.subject, text: email.text, html: email.html })
    });
    if (response.ok) return { ok: true };
    return { ok: false, status: response.status, detail: (await response.text().catch(() => '')).slice(0, 500) };
  } catch (error) {
    return { ok: false, status: null, detail: error instanceof Error ? error.message : String(error) };
  }
}
