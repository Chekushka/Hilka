import { describe, expect, it } from 'vitest';
import { nextOpenTaskId } from './next-task';

const ids = ['a', 'b', 'c', 'd'];
const none = () => false;

describe('nextOpenTaskId', () => {
  it('returns the following task in the teacher order', () => {
    expect(nextOpenTaskId(ids, 'a', none)).toBe('b');
  });

  it('skips tasks already finished', () => {
    const finished = new Set(['b', 'c']);
    expect(nextOpenTaskId(ids, 'a', (id) => finished.has(id))).toBe('d');
  });

  it('does not wrap back to tasks before the current one', () => {
    expect(nextOpenTaskId(ids, 'd', none)).toBeNull();
    const finished = new Set(['c', 'd']);
    expect(nextOpenTaskId(ids, 'b', (id) => finished.has(id))).toBeNull();
  });

  it('returns null for a task not in the session', () => {
    expect(nextOpenTaskId(ids, 'z', none)).toBeNull();
  });
});
