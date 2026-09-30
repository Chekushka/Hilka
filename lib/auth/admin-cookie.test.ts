import { describe, expect, it } from 'vitest';
import { createAdminCookieValue, isValidAdminCookie } from './admin-cookie';
import { createTeacherCookie } from './session-cookie';

const HASH = 'scrypt:16384:8:1:salt:hash-one';
const SECRET = 'test-secret';
const NOW = 1_800_000_000_000;

describe('admin cookie', () => {
  const value = createAdminCookieValue(HASH, SECRET, NOW);

  it('is valid for the same hash and secret until it expires', () => {
    expect(isValidAdminCookie(value, HASH, SECRET, NOW + 1000)).toBe(true);
    expect(isValidAdminCookie(value, HASH, SECRET, NOW + 9 * 60 * 60 * 1000)).toBe(false);
  });

  it('dies when the password hash changes, or under another secret', () => {
    expect(isValidAdminCookie(value, 'scrypt:16384:8:1:salt:hash-two', SECRET, NOW)).toBe(false);
    expect(isValidAdminCookie(value, HASH, 'another-secret', NOW)).toBe(false);
  });

  it('refuses a tampered expiry, garbage, and a teacher cookie', () => {
    const [, signature] = value.split('.');
    expect(isValidAdminCookie(`${NOW + 10 ** 9}.${signature}`, HASH, SECRET, NOW)).toBe(false);
    expect(isValidAdminCookie('nonsense', HASH, SECRET, NOW)).toBe(false);
    expect(isValidAdminCookie(undefined, HASH, SECRET, NOW)).toBe(false);
    process.env.AUTH_SECRET = SECRET;
    expect(isValidAdminCookie(createTeacherCookie('some-teacher').value, HASH, SECRET, NOW)).toBe(false);
  });
});
