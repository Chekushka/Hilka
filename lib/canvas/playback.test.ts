import { describe, expect, it } from 'vitest';
import { clampStep, isFinished, stepBy } from './playback';

describe('clampStep', () => {
  it('keeps a step inside 0..total', () => {
    expect(clampStep(3, 10)).toBe(3);
  });

  it('clamps below zero', () => {
    expect(clampStep(-5, 10)).toBe(0);
  });

  it('clamps above total', () => {
    expect(clampStep(99, 10)).toBe(10);
  });

  it('is always zero for an empty drawing', () => {
    expect(clampStep(5, 0)).toBe(0);
  });
});

describe('stepBy', () => {
  it('advances by delta', () => {
    expect(stepBy(2, 1, 10)).toBe(3);
  });

  it('goes backward by a negative delta', () => {
    expect(stepBy(2, -1, 10)).toBe(1);
  });

  it('cannot pass the last segment', () => {
    expect(stepBy(10, 1, 10)).toBe(10);
  });

  it('cannot go before the first segment', () => {
    expect(stepBy(0, -1, 10)).toBe(0);
  });
});

describe('isFinished', () => {
  it('is false before the last segment', () => {
    expect(isFinished(5, 10)).toBe(false);
  });

  it('is true once every segment has drawn', () => {
    expect(isFinished(10, 10)).toBe(true);
  });

  it('is false for an empty drawing, so autoplay never starts on nothing', () => {
    expect(isFinished(0, 0)).toBe(false);
  });
});
