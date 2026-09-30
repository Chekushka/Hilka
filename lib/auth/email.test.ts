import { describe, expect, it } from 'vitest';
import { isPlausibleEmail, normalizeEmail } from './email';

describe('normalizeEmail', () => {
  it('trims and lowercases, so one address has one spelling', () => {
    expect(normalizeEmail('  Olena.Petrenko@School.UA ')).toBe('olena.petrenko@school.ua');
  });
});

describe('isPlausibleEmail', () => {
  it('accepts an ordinary address', () => {
    expect(isPlausibleEmail('teacher@school.ua')).toBe(true);
  });

  it('rejects typos: no @, no dot after it, spaces, too long', () => {
    expect(isPlausibleEmail('teacher.school.ua')).toBe(false);
    expect(isPlausibleEmail('teacher@school')).toBe(false);
    expect(isPlausibleEmail('tea cher@school.ua')).toBe(false);
    expect(isPlausibleEmail(`${'a'.repeat(250)}@b.ua`)).toBe(false);
  });
});
