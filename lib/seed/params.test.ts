import { describe, expect, it } from 'vitest';
import { createRng } from './prng';
import { enumerateParamCombinations, resolveParams, substituteParams, type ParamSpec } from './params';

describe('resolveParams', () => {
  it('is deterministic — the same seed always resolves the same variant', () => {
    const spec: ParamSpec = { a: { int: [1, 10] }, b: { choice: ['x', 'y', 'z'] } };
    const first = resolveParams(spec, createRng(123));
    const second = resolveParams(spec, createRng(123));
    expect(first).toEqual(second);
  });

  it('keeps an int param within its inclusive range', () => {
    const spec: ParamSpec = { n: { int: [3, 6] } };
    for (let seed = 0; seed < 50; seed += 1) {
      const { n } = resolveParams(spec, createRng(seed));
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('picks one of the listed choices', () => {
    const spec: ParamSpec = { color: { choice: ['red', 'green', 'blue'] } };
    for (let seed = 0; seed < 50; seed += 1) {
      const { color } = resolveParams(spec, createRng(seed));
      expect(['red', 'green', 'blue']).toContain(color);
    }
  });

  it('picks a step-aligned float within range, with no floating-point noise', () => {
    const spec: ParamSpec = { price: { float: [1, 2], step: 0.25 } };
    for (let seed = 0; seed < 50; seed += 1) {
      const { price } = resolveParams(spec, createRng(seed));
      expect([1, 1.25, 1.5, 1.75, 2]).toContain(price);
    }
  });

  it('resolves every named param independently', () => {
    const spec: ParamSpec = { a: { int: [1, 1] }, b: { int: [2, 2] } };
    expect(resolveParams(spec, createRng(1))).toEqual({ a: 1, b: 2 });
  });
});

describe('enumerateParamCombinations', () => {
  it('produces the cartesian product of every param\'s possible values', () => {
    const spec: ParamSpec = { a: { int: [1, 2] }, b: { choice: ['x', 'y'] } };
    const combos = enumerateParamCombinations(spec);
    expect(combos).toHaveLength(4);
    expect(combos).toEqual(
      expect.arrayContaining([
        { a: 1, b: 'x' },
        { a: 1, b: 'y' },
        { a: 2, b: 'x' },
        { a: 2, b: 'y' }
      ])
    );
  });

  it('enumerates every step-aligned float value, inclusive of both ends', () => {
    const spec: ParamSpec = { price: { float: [1, 2], step: 0.5 } };
    const combos = enumerateParamCombinations(spec);
    expect(combos.map((c) => c.price)).toEqual([1, 1.5, 2]);
  });

  it('returns a single empty combination for an empty spec', () => {
    expect(enumerateParamCombinations({})).toEqual([{}]);
  });

  it('throws rather than enumerating an unreasonably large parameter space', () => {
    const spec: ParamSpec = { a: { int: [1, 1000] }, b: { int: [1, 1000] } };
    expect(() => enumerateParamCombinations(spec)).toThrow(/combinations/);
  });
});

describe('substituteParams', () => {
  it('replaces every {name} placeholder with its resolved value', () => {
    const result = substituteParams('a = {a}\nb = {b}\nprint(a + b)', { a: 3, b: 'x' });
    expect(result).toBe('a = 3\nb = x\nprint(a + b)');
  });

  it('leaves an unrelated brace-less text untouched', () => {
    expect(substituteParams('print(1 + 2)', {})).toBe('print(1 + 2)');
  });

  it('leaves a placeholder with no matching value untouched, rather than erroring', () => {
    expect(substituteParams('x = {missing}', {})).toBe('x = {missing}');
  });

  it('substitutes the same placeholder wherever it appears', () => {
    expect(substituteParams('{n} + {n}', { n: 5 })).toBe('5 + 5');
  });
});
