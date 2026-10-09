import { describe, expect, it } from 'vitest';
import {
  CHARACTER_ITEMS,
  CHARACTER_SLOTS,
  DEFAULT_LOOK,
  LEVEL_XP,
  MAX_LEVEL,
  findItem,
  isValidStoredLook,
  itemsUnlockedBetween,
  levelForXp,
  levelProgress,
  nextUnlock,
  resolveLook
} from './character';
import { XP_BY_DIFFICULTY } from './progress';

describe('levelProgress', () => {
  it('starts at level 1 with no XP', () => {
    expect(levelProgress(0)).toEqual({ level: 1, levelXp: 0, nextXp: LEVEL_XP[1] });
  });

  it('reaches level 2 with the first task of difficulty 3, or two easy ones', () => {
    expect(levelForXp(XP_BY_DIFFICULTY[3])).toBe(2);
    expect(levelForXp(XP_BY_DIFFICULTY[1] * 2)).toBe(1);
    expect(levelForXp(XP_BY_DIFFICULTY[1] * 3)).toBe(2);
  });

  it('changes level exactly at each threshold', () => {
    LEVEL_XP.forEach((xp, index) => {
      expect(levelForXp(xp)).toBe(index + 1);
      if (xp > 0) expect(levelForXp(xp - 1)).toBe(index);
    });
  });

  it('stops at the top level, with nothing next', () => {
    expect(levelProgress(1_000_000)).toEqual({ level: MAX_LEVEL, levelXp: LEVEL_XP[MAX_LEVEL - 1], nextXp: null });
  });

  it('never falls as XP grows', () => {
    let previous = 1;
    for (let xp = 0; xp <= 4000; xp += 10) {
      const level = levelForXp(xp);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });
});

describe('the item catalogue', () => {
  it('has a default in every slot that is open from level 1', () => {
    for (const slot of CHARACTER_SLOTS) {
      expect(findItem(slot, DEFAULT_LOOK[slot])?.level).toBe(1);
    }
  });

  it('never repeats an id within a slot', () => {
    const keys = CHARACTER_ITEMS.map((item) => `${item.slot}:${item.id}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('unlocks something at every level above the first, so each level means something', () => {
    for (let level = 2; level <= MAX_LEVEL; level += 1) {
      expect(itemsUnlockedBetween(level - 1, level).length, `level ${level}`).toBeGreaterThan(0);
    }
  });

  it('unlocks nothing above the top level', () => {
    expect(Math.max(...CHARACTER_ITEMS.map((item) => item.level))).toBeLessThanOrEqual(MAX_LEVEL);
  });
});

describe('itemsUnlockedBetween', () => {
  it('is empty when the level did not change', () => {
    expect(itemsUnlockedBetween(3, 3)).toEqual([]);
  });

  it('lists everything from every level crossed in one jump', () => {
    const items = itemsUnlockedBetween(1, 3).map((item) => `${item.slot}:${item.id}`);
    expect(items.sort()).toEqual(['body:sky', 'extra:scarf', 'eyes:happy', 'head:cap']);
  });
});

describe('nextUnlock', () => {
  it('names the next level and what it opens', () => {
    expect(nextUnlock(1)).toEqual({ level: 2, items: CHARACTER_ITEMS.filter((item) => item.level === 2) });
  });

  it('is null when everything is open', () => {
    expect(nextUnlock(MAX_LEVEL)).toBeNull();
  });
});

describe('resolveLook', () => {
  it('is the default with nothing stored', () => {
    expect(resolveLook(undefined, 5)).toEqual(DEFAULT_LOOK);
  });

  it('wears what was picked once it is unlocked', () => {
    expect(resolveLook({ body: 'sky', head: 'cap' }, 2)).toEqual({ ...DEFAULT_LOOK, body: 'sky', head: 'cap' });
  });

  it('falls back to the default for an item above the level, without touching the other slots', () => {
    expect(resolveLook({ body: 'sky', head: 'crown' }, 2)).toEqual({ ...DEFAULT_LOOK, body: 'sky' });
  });

  it('ignores ids it does not know and values that are not ids', () => {
    expect(resolveLook({ body: 'retired-item', eyes: 7 }, MAX_LEVEL)).toEqual(DEFAULT_LOOK);
  });

  it('does not take an id from another slot', () => {
    expect(resolveLook({ head: 'scarf' }, MAX_LEVEL)).toEqual(DEFAULT_LOOK);
  });
});

describe('isValidStoredLook', () => {
  it('accepts a partial look', () => {
    expect(isValidStoredLook({ body: 'sky' })).toBe(true);
    expect(isValidStoredLook({})).toBe(true);
  });

  it('accepts an id the catalogue no longer has — resolveLook drops it, the save stays valid', () => {
    expect(isValidStoredLook({ head: 'retired-hat' })).toBe(true);
  });

  it('rejects unknown slots, non-string ids and oversized values', () => {
    expect(isValidStoredLook({ cape: 'red' })).toBe(false);
    expect(isValidStoredLook({ body: 3 })).toBe(false);
    expect(isValidStoredLook({ body: 'x'.repeat(41) })).toBe(false);
    expect(isValidStoredLook(['sky'])).toBe(false);
    expect(isValidStoredLook(null)).toBe(false);
  });
});
