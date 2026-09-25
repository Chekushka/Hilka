import { describe, expect, it, vi } from 'vitest';
import { buildLoginEmail, loginEmailConfig, sendLoginEmail } from './login-email';

const config = { apiKey: 're_test', from: 'Hilka <login@example.org>' };
const link = 'https://hilka.vercel.app/api/auth/verify?token=abc_DEF-123';

describe('loginEmailConfig', () => {
  it('needs both the key and the sender', () => {
    expect(loginEmailConfig({ RESEND_API_KEY: 're_x', EMAIL_FROM: 'a@b.c' })).toEqual({ apiKey: 're_x', from: 'a@b.c' });
    expect(loginEmailConfig({ RESEND_API_KEY: 're_x' })).toBeNull();
    expect(loginEmailConfig({ EMAIL_FROM: 'a@b.c' })).toBeNull();
    expect(loginEmailConfig({ RESEND_API_KEY: ' ', EMAIL_FROM: 'a@b.c' })).toBeNull();
  });
});

describe('buildLoginEmail', () => {
  it('puts the link in both the text and the html body', () => {
    const email = buildLoginEmail(link);
    expect(email.subject).toBe('Вхід до Hilka');
    expect(email.text).toContain(link);
    expect(email.html).toContain(`href="${link}"`);
  });

  it('escapes the link in html', () => {
    const email = buildLoginEmail('https://x/?a=1&b="><script>');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&#38;b=&#34;&#62;&#60;script&#62;');
  });
});

describe('sendLoginEmail', () => {
  it('posts to Resend with the key, sender and recipient', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"id":"1"}', { status: 200 }));
    await expect(sendLoginEmail('t@school.ua', link, config, fetchImpl)).resolves.toEqual({ ok: true });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test');
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe(config.from);
    expect(body.to).toEqual(['t@school.ua']);
    expect(body.text).toContain(link);
  });

  it('reports a rejected request without throwing', async () => {
    const fetchImpl = vi.fn(async () => new Response('domain not verified', { status: 403 }));
    await expect(sendLoginEmail('t@school.ua', link, config, fetchImpl)).resolves.toEqual({
      ok: false,
      status: 403,
      detail: 'domain not verified'
    });
  });

  it('reports a network failure without throwing', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    await expect(sendLoginEmail('t@school.ua', link, config, fetchImpl)).resolves.toEqual({
      ok: false,
      status: null,
      detail: 'ECONNRESET'
    });
  });
});
