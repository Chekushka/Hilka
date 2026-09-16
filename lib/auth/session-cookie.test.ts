import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTeacherCookie, readTeacherId } from './session-cookie';

const TEACHER_ID = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', 'test-secret');
});

describe('createTeacherCookie / readTeacherId', () => {
  it('round-trips the teacher id', () => {
    const cookie = createTeacherCookie(TEACHER_ID);
    expect(readTeacherId(cookie.value)).toBe(TEACHER_ID);
  });

  it('rejects a value signed with a different secret', () => {
    const cookie = createTeacherCookie(TEACHER_ID);
    vi.stubEnv('AUTH_SECRET', 'a-different-secret');
    expect(readTeacherId(cookie.value)).toBeNull();
  });

  it('rejects a tampered teacher id even with a valid-looking signature', () => {
    const cookie = createTeacherCookie(TEACHER_ID);
    const [, expiresAt, signature] = cookie.value.split('.');
    const tampered = `00000000-0000-4000-8000-000000000002.${expiresAt}.${signature}`;
    expect(readTeacherId(tampered)).toBeNull();
  });

  it('rejects an expired cookie', () => {
    const cookie = createTeacherCookie(TEACHER_ID);
    vi.useFakeTimers();
    vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000); // past the 30-day TTL
    expect(readTeacherId(cookie.value)).toBeNull();
    vi.useRealTimers();
  });

  it('rejects missing, empty, or malformed values', () => {
    expect(readTeacherId(undefined)).toBeNull();
    expect(readTeacherId(null)).toBeNull();
    expect(readTeacherId('')).toBeNull();
    expect(readTeacherId('not-enough-parts')).toBeNull();
  });

  it('throws a clear error when AUTH_SECRET is unset', () => {
    vi.stubEnv('AUTH_SECRET', '');
    expect(() => createTeacherCookie(TEACHER_ID)).toThrow('AUTH_SECRET');
  });
});
