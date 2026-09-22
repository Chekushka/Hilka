import { describe, expect, it } from 'vitest';
import { createRng, deriveSeed, randomChoice, randomInt } from './prng';

describe('deriveSeed', () => {
  it('is deterministic — the same session, student and task always derive the same seed', () => {
    const a = deriveSeed('session-1', 'Олена', 'task-1');
    const b = deriveSeed('session-1', 'Олена', 'task-1');
    expect(a).toBe(b);
  });

  it('differs between students at the same session and task', () => {
    const olena = deriveSeed('session-1', 'Олена', 'task-1');
    const taras = deriveSeed('session-1', 'Тарас', 'task-1');
    expect(olena).not.toBe(taras);
  });

  it('differs between sessions for the same student and task', () => {
    const first = deriveSeed('session-1', 'Олена', 'task-1');
    const second = deriveSeed('session-2', 'Олена', 'task-1');
    expect(first).not.toBe(second);
  });

  it('differs between tasks for the same session and student', () => {
    const first = deriveSeed('session-1', 'Олена', 'task-1');
    const second = deriveSeed('session-1', 'Олена', 'task-2');
    expect(first).not.toBe(second);
  });

  it('is not confused by concatenation across the id/name boundary', () => {
    // Without a separator, ('ab', 'c', ...) and ('a', 'bc', ...) would hash
    // identically — the null-byte join in deriveSeed exists for exactly this.
    const a = deriveSeed('ab', 'c', 'task');
    const b = deriveSeed('a', 'bc', 'task');
    expect(a).not.toBe(b);
  });
});

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const sequenceA = [a(), a(), a()];
    const sequenceB = [b(), b(), b()];
    expect(sequenceA).toEqual(sequenceB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a()).not.toBe(b());
  });

  it('stays within [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 100; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('randomInt', () => {
  it('always stays within the inclusive range', () => {
    const rng = createRng(3);
    for (let i = 0; i < 200; i += 1) {
      const value = randomInt(rng, 5, 8);
      expect(value).toBeGreaterThanOrEqual(5);
      expect(value).toBeLessThanOrEqual(8);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('returns the only possible value when min equals max', () => {
    const rng = createRng(9);
    expect(randomInt(rng, 4, 4)).toBe(4);
  });
});

describe('randomChoice', () => {
  it('always returns one of the given options', () => {
    const rng = createRng(11);
    const options = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i += 1) {
      expect(options).toContain(randomChoice(rng, options));
    }
  });
});
