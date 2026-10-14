import { describe, expect, it } from 'vitest';
import { hasSchoolMark, isIdleExpired, isSchoolCookieValue, SCHOOL_IDLE_MS } from './school';

describe('hasSchoolMark', () => {
  it('finds the mark among other cookies', () => {
    expect(hasSchoolMark('theme=dark; hilka_school=1; other=x')).toBe(true);
    expect(hasSchoolMark('hilka_school=1')).toBe(true);
  });

  it('is false without it, or with any other value', () => {
    expect(hasSchoolMark('')).toBe(false);
    expect(hasSchoolMark('hilka_school=0')).toBe(false);
    expect(hasSchoolMark('not_hilka_school=1')).toBe(false);
  });
});

describe('isSchoolCookieValue', () => {
  it('accepts only the mark', () => {
    expect(isSchoolCookieValue('1')).toBe(true);
    expect(isSchoolCookieValue(undefined)).toBe(false);
    expect(isSchoolCookieValue('true')).toBe(false);
  });
});

describe('isIdleExpired', () => {
  const now = 1_000_000_000;

  it('expires only past the idle limit', () => {
    expect(isIdleExpired(now - SCHOOL_IDLE_MS, now)).toBe(false);
    expect(isIdleExpired(now - SCHOOL_IDLE_MS - 1, now)).toBe(true);
  });

  it('never expires what has no recorded activity, or a clock that went back', () => {
    expect(isIdleExpired(null, now)).toBe(false);
    expect(isIdleExpired(now + 60_000, now)).toBe(false);
  });
});
