import { describe, expect, it } from 'vitest';
import { buildAccessGrantedEmail, buildAccessRequestEmail } from './access-email';

describe('buildAccessRequestEmail', () => {
  it('names the requester and links to the superuser page, in text and html', () => {
    const email = buildAccessRequestEmail('new.teacher@school.ua', 'https://hilka.vercel.app/admin');
    expect(email.subject).toBe('Hilka: новий запит на доступ');
    expect(email.text).toContain('new.teacher@school.ua');
    expect(email.text).toContain('https://hilka.vercel.app/admin');
    expect(email.html).toContain('href="https://hilka.vercel.app/admin"');
  });

  it('escapes whatever the requester typed', () => {
    const email = buildAccessRequestEmail('<b>x</b>@school.ua', 'https://hilka.vercel.app/admin');
    expect(email.html).not.toContain('<b>');
    expect(email.html).toContain('&#60;b&#62;');
  });
});

describe('buildAccessGrantedEmail', () => {
  it('links to the login page, never a login token', () => {
    const email = buildAccessGrantedEmail('https://hilka.vercel.app/login');
    expect(email.subject).toBe('Доступ до Hilka відкрито');
    expect(email.text).toContain('https://hilka.vercel.app/login');
    expect(email.html).toContain('href="https://hilka.vercel.app/login"');
    expect(email.text).not.toContain('token');
  });
});
