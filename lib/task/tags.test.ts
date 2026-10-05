import { describe, expect, it } from 'vitest';
import { isTaskTag, normalizeTags } from './tags';

describe('task tags', () => {
  it('knows the vocabulary', () => {
    expect(isTaskTag('retype')).toBe(true);
    expect(isTaskTag('challenge')).toBe(true);
    expect(isTaskTag('hard')).toBe(false);
    expect(isTaskTag(3)).toBe(false);
  });

  it('keeps known tags once, in vocabulary order', () => {
    expect(normalizeTags(['challenge', 'retype', 'challenge', 'nope', 7])).toEqual(['retype', 'challenge']);
  });

  it('reads anything that is not a list as no tags', () => {
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags('retype')).toEqual([]);
  });
});
