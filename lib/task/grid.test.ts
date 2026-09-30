import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID_WORLD, gridWorldOf, isGridWorldSpec, isValidGridWorld, placeOnGrid } from './grid';
import type { CodeTask, FillTask } from './types';

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

describe('isGridWorldSpec', () => {
  it('accepts a valid concrete world', () => {
    expect(isGridWorldSpec(world)).toBe(true);
  });

  it('accepts placeholders in coordinates and the direction', () => {
    expect(isGridWorldSpec({ start: { x: 1, y: 6, dir: '{d}' }, goal: { x: '{gx}', y: 2 }, rocks: [{ x: '{r}', y: 0 }] })).toBe(
      true
    );
  });

  it('still rejects a cell off the field, loose text, or a missing part', () => {
    expect(isGridWorldSpec({ start: { x: 9, y: 6, dir: 'N' }, goal: { x: '{gx}', y: 2 }, rocks: [] })).toBe(false);
    expect(isGridWorldSpec({ start: { x: 1, y: 6, dir: 'N' }, goal: { x: 'x{gx}', y: 2 }, rocks: [] })).toBe(false);
    expect(isGridWorldSpec({ start: { x: 1, y: 6, dir: 'N' }, goal: { x: '{gx}', y: 2 } })).toBe(false);
  });
});

describe('gridWorldOf', () => {
  const base = { id: 't', slug: 's', topicId: 'p', title: 'T', checks: [], hints: [], difficulty: 1, gradeTags: [7], version: 1, status: 'published' } as const;

  it('gives a fill task its world, and none without one', () => {
    const fill = { ...base, type: 'fill', payload: { type: 'fill', prompt: '', template: 'robot.{{1}}()', grid: world }, reference: { code: '' } } as unknown as FillTask;
    expect(gridWorldOf(fill)).toEqual(world);
    expect(gridWorldOf({ ...fill, payload: { ...fill.payload, grid: undefined } })).toBeUndefined();
  });

  it('never hands an unresolved parameterized world to a run', () => {
    const code = {
      ...base,
      type: 'code',
      payload: { type: 'code', surface: 'grid', prompt: '', starter: '', grid: { ...world, goal: { x: '{gx}', y: 7 } } },
      reference: { code: '' }
    } as unknown as CodeTask;
    expect(gridWorldOf(code)).toBeUndefined();
  });
});
