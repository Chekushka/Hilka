import { describe, expect, it } from 'vitest';
import { clampScale, forwardStep, presentKeyAction, rootFontSize, SCALE_MAX, SCALE_MIN, stepScale } from './present';

describe('presentKeyAction', () => {
  it('reads a presentation remote and the arrows', () => {
    expect(presentKeyAction('PageDown', 'PageDown')).toBe('forward');
    expect(presentKeyAction('PageUp', 'PageUp')).toBe('back');
    expect(presentKeyAction('ArrowRight', 'ArrowRight')).toBe('forward');
    expect(presentKeyAction('ArrowLeft', 'ArrowLeft')).toBe('back');
    expect(presentKeyAction(' ', 'Space')).toBe('forward');
    expect(presentKeyAction('Home', 'Home')).toBe('first');
    expect(presentKeyAction('End', 'End')).toBe('last');
  });

  it('finds F by its physical key, on the Ukrainian layout too', () => {
    expect(presentKeyAction('f', 'KeyF')).toBe('fullscreen');
    expect(presentKeyAction('а', 'KeyF')).toBe('fullscreen');
  });

  it('sizes the text with + and -, and ignores other keys', () => {
    expect(presentKeyAction('+', 'Equal')).toBe('bigger');
    expect(presentKeyAction('=', 'Equal')).toBe('bigger');
    expect(presentKeyAction('-', 'Minus')).toBe('smaller');
    expect(presentKeyAction('Enter', 'Enter')).toBeNull();
    expect(presentKeyAction('x', 'KeyX')).toBeNull();
  });
});

describe('forwardStep', () => {
  it('opens a hidden answer before moving on', () => {
    expect(forwardStep(2, 5, true)).toEqual({ kind: 'reveal' });
    expect(forwardStep(2, 5, false)).toEqual({ kind: 'move', to: 3 });
  });

  it('stays on the last card, but still opens its answer', () => {
    expect(forwardStep(5, 5, true)).toEqual({ kind: 'reveal' });
    expect(forwardStep(5, 5, false)).toEqual({ kind: 'stay' });
  });
});

describe('text scale', () => {
  it('steps by a tenth and stays within bounds', () => {
    expect(stepScale(1, 1)).toBe(1.1);
    expect(stepScale(1.1, -1)).toBe(1);
    expect(stepScale(SCALE_MAX, 1)).toBe(SCALE_MAX);
    expect(stepScale(SCALE_MIN, -1)).toBe(SCALE_MIN);
  });

  it('falls back to 1 for a value that is not a number', () => {
    expect(clampScale(Number.NaN)).toBe(1);
    expect(clampScale(9)).toBe(SCALE_MAX);
  });

  it('scales the root font size with the window and the factor', () => {
    expect(rootFontSize(1)).toBe('clamp(14px, calc(min(1.7vw, 2.7vh) * 1), 48px)');
    expect(rootFontSize(1.5)).toBe('clamp(21px, calc(min(1.7vw, 2.7vh) * 1.5), 72px)');
  });
});
