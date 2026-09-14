/**
 * Turtle comparison.
 *
 * Never compare command logs: right(90) and left(270) draw the same picture and
 * log differently, and failing a correct-but-different solution is exactly the
 * event that makes a reluctant student close the tab. Compare normalized
 * segment sets instead — round coordinates, order each segment's endpoints
 * canonically, drop zero-length segments, deduplicate, compare as sets.
 */
import type { Segment } from '@/lib/runner';
import type { ShapeNormalization } from './types';

export interface Point {
  x: number;
  y: number;
}

const DEFAULT_TOLERANCE = 1;

function roundTo(value: number, tolerance: number): number {
  return Math.round(value / tolerance) * tolerance;
}

/** A segment as a canonical string, so a set comparison is a string comparison. */
function key(x1: number, y1: number, x2: number, y2: number, tolerance: number): string {
  const ax = roundTo(x1, tolerance);
  const ay = roundTo(y1, tolerance);
  const bx = roundTo(x2, tolerance);
  const by = roundTo(y2, tolerance);
  const forward = ax < bx || (ax === bx && ay <= by);
  return forward ? `${ax},${ay}|${bx},${by}` : `${bx},${by}|${ax},${ay}`;
}

export function normalizeSegments(segments: Segment[], tolerance = DEFAULT_TOLERANCE): string[] {
  const seen = new Set<string>();
  for (const s of segments) {
    if (
      roundTo(s.x1, tolerance) === roundTo(s.x2, tolerance) &&
      roundTo(s.y1, tolerance) === roundTo(s.y2, tolerance)
    ) {
      continue; // zero-length: a pen that moved nowhere is not a line
    }
    seen.add(key(s.x1, s.y1, s.x2, s.y2, tolerance));
  }
  return [...seen].sort();
}

export function segmentLength(s: Segment): number {
  return Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
}

export function totalLength(segments: Segment[]): number {
  return segments.reduce((sum, s) => sum + segmentLength(s), 0);
}

/** [minX, minY, maxX, maxY]; a zero box for an empty drawing. */
export function boundingBox(segments: Segment[]): [number, number, number, number] {
  if (segments.length === 0) {
    return [0, 0, 0, 0];
  }
  const xs = segments.flatMap((s) => [s.x1, s.x2]);
  const ys = segments.flatMap((s) => [s.y1, s.y2]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function transform(segments: Segment[], angle: number, scale: number, dx: number, dy: number): Segment[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const move = (x: number, y: number): Point => ({
    x: (x * cos - y * sin) * scale + dx,
    y: (x * sin + y * cos) * scale + dy
  });
  return segments.map((s) => {
    const a = move(s.x1, s.y1);
    const b = move(s.x2, s.y2);
    return { ...s, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
}

/** Shifts a drawing so its bounding box starts at the origin. */
function translateToOrigin(segments: Segment[]): Segment[] {
  const [minX, minY] = boundingBox(segments);
  return transform(segments, 0, 1, -minX, -minY);
}

/**
 * Is the drawing closed — does every endpoint meet another endpoint? True for a
 * square or a triangle, false for a line or an unfinished shape.
 */
export function isClosed(segments: Segment[], tolerance = DEFAULT_TOLERANCE): boolean {
  if (segments.length === 0) {
    return false;
  }
  const counts = new Map<string, number>();
  for (const s of segments) {
    for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]]) {
      const at = `${roundTo(x, tolerance)},${roundTo(y, tolerance)}`;
      counts.set(at, (counts.get(at) ?? 0) + 1);
    }
  }
  return [...counts.values()].every((count) => count % 2 === 0);
}

export interface ShapeCompareOptions {
  tolerance?: number;
  normalize?: ShapeNormalization[];
}

/**
 * True when the student's drawing matches the reference.
 *
 * 'translate' forgives a different starting position, 'rotate' a different
 * starting heading, 'scale' a different size. Rotation is searched rather than
 * derived: every angle that could align one of the student's segments with the
 * reference's first segment is tried. Drawings are small — grade 7 produces
 * tens of segments, not thousands — so the cost does not matter, and a
 * derived-angle shortcut would fail on shapes with symmetry.
 */
export function shapesMatch(
  student: Segment[],
  reference: Segment[],
  options: ShapeCompareOptions = {}
): boolean {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const allow = new Set(options.normalize ?? []);
  const target = normalizeSegments(
    allow.has('translate') ? translateToOrigin(reference) : reference,
    tolerance
  );

  let scale = 1;
  if (allow.has('scale')) {
    const studentLength = totalLength(student);
    const referenceLength = totalLength(reference);
    if (studentLength === 0) {
      return target.length === 0;
    }
    scale = referenceLength / studentLength;
  }

  const angles: number[] = [0];
  if (allow.has('rotate') && reference.length > 0) {
    const referenceAngle = Math.atan2(
      reference[0].y2 - reference[0].y1,
      reference[0].x2 - reference[0].x1
    );
    for (const s of student) {
      const studentAngle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      // Both directions, because a segment's endpoints carry no direction once
      // normalized: a side drawn backwards is the same side.
      angles.push(referenceAngle - studentAngle, referenceAngle - studentAngle + Math.PI);
    }
  }

  for (const angle of angles) {
    const moved = transform(student, angle, scale, 0, 0);
    const candidate = normalizeSegments(
      allow.has('translate') ? translateToOrigin(moved) : moved,
      tolerance
    );
    if (candidate.length === target.length && candidate.every((k, i) => k === target[i])) {
      return true;
    }
  }
  return false;
}

/** Every required segment is present somewhere in the student's drawing. */
export function shapeContains(
  student: Segment[],
  required: Segment[],
  tolerance = DEFAULT_TOLERANCE
): boolean {
  const present = new Set(normalizeSegments(student, tolerance));
  return normalizeSegments(required, tolerance).every((k) => present.has(k));
}
