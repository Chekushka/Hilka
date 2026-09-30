import { describe, expect, it } from 'vitest';
import { isPlaceholder, resolveGridWorld, worldHasPlaceholders, type GridWorldSpec } from './grid';

const spec: GridWorldSpec = {
  start: { x: 1, y: 6, dir: '{d}' },
  goal: { x: '{gx}', y: '{gy}' },
  rocks: [{ x: '{gx}', y: 6 }]
};

describe('resolveGridWorld', () => {
  it('fills every placeholder, the same parameter the same way everywhere', () => {
    expect(resolveGridWorld(spec, { gx: 5, gy: '2', d: 'N' })).toEqual({
      start: { x: 1, y: 6, dir: 'N' },
      goal: { x: 5, y: 2 },
      rocks: [{ x: 5, y: 6 }]
    });
  });

  it('leaves a concrete world as it is', () => {
    const world = { start: { x: 0, y: 0, dir: 'E' }, goal: { x: 7, y: 0 }, rocks: [] };
    expect(resolveGridWorld(world, {})).toEqual(world);
  });

  it('turns an unresolved or non-numeric coordinate into NaN, never a guess', () => {
    const world = resolveGridWorld(spec, { gy: 'два', d: 'N' });
    expect(world.goal.x).toBeNaN();
    expect(world.goal.y).toBeNaN();
  });
});

describe('placeholders', () => {
  it('knows a placeholder only when it is exactly one', () => {
    expect(isPlaceholder('{gx}')).toBe(true);
    expect(isPlaceholder('x{gx}')).toBe(false);
    expect(isPlaceholder(3)).toBe(false);
  });

  it('finds them in any coordinate or the direction', () => {
    expect(worldHasPlaceholders(spec)).toBe(true);
    expect(worldHasPlaceholders({ start: { x: 0, y: 0, dir: 'E' }, goal: { x: 1, y: 0 }, rocks: [] })).toBe(false);
  });
});
