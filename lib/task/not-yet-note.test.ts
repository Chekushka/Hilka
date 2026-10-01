import { describe, expect, it } from 'vitest';
import { notYetNote } from './not-yet-note';

describe('notYetNote', () => {
  it('points at the drawing only when a turtle check failed', () => {
    expect(notYetNote([{ kind: 'shape_equals' }])).toBe('drawing');
  });

  it('points at the output for a console task', () => {
    expect(notYetNote([{ kind: 'stdout_equals', value: 'Python' }])).toBe('output');
    expect(notYetNote([{ kind: 'number_close', value: 1, tol: 0 }])).toBe('output');
  });

  it('points at the robot for a grid task', () => {
    expect(notYetNote([{ kind: 'grid_goal' }])).toBe('grid');
  });

  it('is plain for checks with nothing on screen to compare', () => {
    expect(notYetNote([{ kind: 'choice_equals', indices: [0] }])).toBe('plain');
    expect(notYetNote([{ kind: 'uses', all: ['for'] }])).toBe('plain');
    expect(notYetNote([])).toBe('plain');
  });

  it('follows the first failure, the one listed first', () => {
    expect(notYetNote([{ kind: 'forbids', names: ['max'] }, { kind: 'shape_equals' }])).toBe('plain');
  });
});
