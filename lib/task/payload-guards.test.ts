import { describe, expect, it } from 'vitest';
import { isTaskPayload } from './payload-guards';

const world = { start: { x: 1, y: 6, dir: 'E' }, goal: { x: 5, y: 1 }, rocks: [{ x: 6, y: 6 }] };
const template = { x: '{gx}', y: 1 };

describe('grid worlds in payloads', () => {
  it('accept a fill task with or without a valid world', () => {
    expect(isTaskPayload({ type: 'fill', prompt: '', template: 'robot.{{1}}()' })).toBe(true);
    expect(isTaskPayload({ type: 'fill', prompt: '', template: 'robot.{{1}}()', grid: world })).toBe(true);
  });

  it('reject a fill world that is not valid, or has placeholders (fill takes no params)', () => {
    expect(isTaskPayload({ type: 'fill', prompt: '', template: 'robot.{{1}}()', grid: { ...world, goal: world.start } })).toBe(false);
    expect(isTaskPayload({ type: 'fill', prompt: '', template: 'robot.{{1}}()', grid: { ...world, goal: template } })).toBe(false);
  });

  it('let only a code task hold placeholders', () => {
    const code = { type: 'code', surface: 'grid', prompt: '', starter: '', grid: { ...world, goal: template } };
    expect(isTaskPayload(code)).toBe(true);
    expect(isTaskPayload({ type: 'fix', surface: 'grid', prompt: '', broken: '', grid: { ...world, goal: template } })).toBe(false);
  });
});
