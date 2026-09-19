import { describe, expect, it } from 'vitest';
import { createFixedWindowLimiter } from './rate-limit';

describe('createFixedWindowLimiter', () => {
  it('allows attempts under the limit', () => {
    const limiter = createFixedWindowLimiter(3, 1000);
    expect(limiter.attempt('a', 0)).toBe(true);
    expect(limiter.attempt('a', 10)).toBe(true);
    expect(limiter.attempt('a', 20)).toBe(true);
  });

  it('blocks once the limit is spent within the window', () => {
    const limiter = createFixedWindowLimiter(2, 1000);
    expect(limiter.attempt('a', 0)).toBe(true);
    expect(limiter.attempt('a', 10)).toBe(true);
    expect(limiter.attempt('a', 20)).toBe(false);
  });

  it('resets once the window elapses', () => {
    const limiter = createFixedWindowLimiter(1, 1000);
    expect(limiter.attempt('a', 0)).toBe(true);
    expect(limiter.attempt('a', 500)).toBe(false);
    expect(limiter.attempt('a', 1000)).toBe(true);
  });

  it('tracks each key independently — one guesser cannot exhaust another caller', () => {
    const limiter = createFixedWindowLimiter(1, 1000);
    expect(limiter.attempt('a', 0)).toBe(true);
    expect(limiter.attempt('b', 0)).toBe(true);
    expect(limiter.attempt('a', 0)).toBe(false);
    expect(limiter.attempt('b', 0)).toBe(false);
  });
});
