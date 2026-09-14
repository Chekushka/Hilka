import { describe, expect, it } from 'vitest';
import type { Segment } from '@/lib/runner';
import { boundingBox, isClosed, normalizeSegments, shapeContains, shapesMatch, totalLength } from './geometry';

function seg(x1: number, y1: number, x2: number, y2: number, color = 'black'): Segment {
  return { x1, y1, x2, y2, color, width: 1, line: null };
}

/** A square of side 100 from the origin, drawn clockwise. */
const SQUARE = [seg(0, 0, 100, 0), seg(100, 0, 100, -100), seg(100, -100, 0, -100), seg(0, -100, 0, 0)];

describe('normalizeSegments', () => {
  it('orders endpoints canonically, so direction does not matter', () => {
    expect(normalizeSegments([seg(0, 0, 100, 0)])).toEqual(normalizeSegments([seg(100, 0, 0, 0)]));
  });

  it('drops zero-length segments', () => {
    expect(normalizeSegments([seg(5, 5, 5, 5)])).toHaveLength(0);
  });

  it('deduplicates a line drawn twice', () => {
    expect(normalizeSegments([seg(0, 0, 10, 0), seg(0, 0, 10, 0)])).toHaveLength(1);
  });

  it('rounds to the tolerance', () => {
    expect(normalizeSegments([seg(0, 0, 99.6, 0.4)])).toEqual(normalizeSegments([seg(0, 0, 100, 0)]));
  });
});

describe('shapesMatch', () => {
  it('accepts the same square traversed in the opposite direction', () => {
    // The equivalence the whole comparison design exists for. right(90) and
    // left(270) emit identical coordinates — the runner tests prove that — so
    // the case that matters here is a student who walked the square the other
    // way round, producing the same sides with their endpoints reversed.
    const reversed = [...SQUARE].reverse().map((s) => seg(s.x2, s.y2, s.x1, s.y1));
    expect(shapesMatch(reversed, SQUARE)).toBe(true);
  });

  it('rejects a rectangle drawn where a square was asked for', () => {
    const rectangle = [seg(0, 0, 150, 0), seg(150, 0, 150, -100), seg(150, -100, 0, -100), seg(0, -100, 0, 0)];
    expect(shapesMatch(rectangle, SQUARE)).toBe(false);
  });

  it('rejects a different position unless translate is allowed', () => {
    const moved = SQUARE.map((s) => seg(s.x1 + 40, s.y1 + 25, s.x2 + 40, s.y2 + 25));
    expect(shapesMatch(moved, SQUARE)).toBe(false);
    expect(shapesMatch(moved, SQUARE, { normalize: ['translate'] })).toBe(true);
  });

  it('accepts a square started from a different heading when rotate is allowed', () => {
    // Drawn starting north instead of east — the same square to any student.
    const rotated = [seg(0, 0, 0, 100), seg(0, 100, 100, 100), seg(100, 100, 100, 0), seg(100, 0, 0, 0)];
    expect(shapesMatch(rotated, SQUARE, { normalize: ['rotate', 'translate'] })).toBe(true);
  });

  it('accepts a different size only when scale is allowed', () => {
    const half = SQUARE.map((s) => seg(s.x1 / 2, s.y1 / 2, s.x2 / 2, s.y2 / 2));
    expect(shapesMatch(half, SQUARE)).toBe(false);
    expect(shapesMatch(half, SQUARE, { normalize: ['scale', 'translate'] })).toBe(true);
  });

  it('does not accept a triangle as a square however it is normalized', () => {
    const triangle = [seg(0, 0, 100, 0), seg(100, 0, 50, 87), seg(50, 87, 0, 0)];
    expect(shapesMatch(triangle, SQUARE, { normalize: ['translate', 'rotate', 'scale'] })).toBe(false);
  });
});

describe('shape properties', () => {
  it('sees a square as closed and an open path as not', () => {
    expect(isClosed(SQUARE)).toBe(true);
    expect(isClosed(SQUARE.slice(0, 3))).toBe(false);
  });

  it('measures total length and bounding box', () => {
    expect(totalLength(SQUARE)).toBe(400);
    expect(boundingBox(SQUARE)).toEqual([0, -100, 100, 0]);
  });

  it('reports an empty drawing without throwing', () => {
    expect(boundingBox([])).toEqual([0, 0, 0, 0]);
    expect(isClosed([])).toBe(false);
  });
});

describe('shapeContains', () => {
  it('finds a required side inside a larger drawing', () => {
    expect(shapeContains(SQUARE, [seg(100, 0, 100, -100)])).toBe(true);
  });

  it('rejects a side that is not there', () => {
    expect(shapeContains(SQUARE, [seg(0, 0, 50, 50)])).toBe(false);
  });
});
