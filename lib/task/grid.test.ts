import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID_WORLD, isValidGridWorld, placeOnGrid } from './grid';

const world = { start: { x: 0, y: 7, dir: 'E' }, goal: { x: 7, y: 7 }, rocks: [{ x: 3, y: 7 }] };

describe('isValidGridWorld', () => {
  it('accepts a world with a start, a goal and rocks on the field', () => {
    expect(isValidGridWorld(world)).toBe(true);
    expect(isValidGridWorld({ ...world, rocks: [] })).toBe(true);
  });

  it('rejects cells off the 8×8 field or not whole numbers', () => {
    expect(isValidGridWorld({ ...world, goal: { x: 8, y: 0 } })).toBe(false);
    expect(isValidGridWorld({ ...world, rocks: [{ x: -1, y: 2 }] })).toBe(false);
    expect(isValidGridWorld({ ...world, goal: { x: 1.5, y: 0 } })).toBe(false);
  });

  it('rejects a start without a direction to face', () => {
    expect(isValidGridWorld({ ...world, start: { x: 0, y: 7, dir: 'up' } })).toBe(false);
  });

  it('rejects a goal on the start, or a rock on either', () => {
    expect(isValidGridWorld({ ...world, goal: { x: 0, y: 7 } })).toBe(false);
    expect(isValidGridWorld({ ...world, rocks: [{ x: 7, y: 7 }] })).toBe(false);
    expect(isValidGridWorld({ ...world, rocks: [{ x: 0, y: 7 }] })).toBe(false);
  });

  it('rejects anything that is not a world', () => {
    expect(isValidGridWorld(null)).toBe(false);
    expect(isValidGridWorld({ start: world.start, goal: world.goal })).toBe(false);
  });
});

describe('placeOnGrid', () => {
  const base = DEFAULT_GRID_WORLD;

  it('toggles a rock', () => {
    const one = placeOnGrid(base, 'rock', { x: 3, y: 4 });
    expect(one.rocks).toEqual([{ x: 3, y: 4 }]);
    expect(placeOnGrid(one, 'rock', { x: 3, y: 4 }).rocks).toEqual([]);
  });

  it('moves the robot and the battery, clearing a rock under them, keeping the direction', () => {
    const rocky = placeOnGrid(base, 'rock', { x: 2, y: 2 });
    expect(placeOnGrid(rocky, 'start', { x: 2, y: 2 })).toMatchObject({ start: { x: 2, y: 2, dir: 'E' }, rocks: [] });
    expect(placeOnGrid(rocky, 'goal', { x: 2, y: 2 })).toMatchObject({ goal: { x: 2, y: 2 }, rocks: [] });
  });

  it('never stacks the robot and the battery, or buries either under a rock', () => {
    expect(placeOnGrid(base, 'start', base.goal)).toBe(base);
    expect(placeOnGrid(base, 'goal', base.start)).toBe(base);
    expect(placeOnGrid(base, 'rock', base.start)).toBe(base);
  });

  it('always yields a valid world', () => {
    let world = base;
    for (const [tool, x, y] of [['rock', 1, 4], ['start', 1, 4], ['goal', 0, 0], ['rock', 0, 0]] as const) {
      world = placeOnGrid(world, tool, { x, y });
      expect(isValidGridWorld(world)).toBe(true);
    }
  });
});
