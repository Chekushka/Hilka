import { describe, expect, it } from 'vitest';
import { agoFrom, formatClock, formatDuration } from './time';

describe('formatClock', () => {
  it('shows Kyiv time, summer and winter', () => {
    expect(formatClock('2026-09-29T11:07:00Z')).toBe('14:07');
    expect(formatClock('2026-01-15T06:05:00Z')).toBe('08:05');
  });
});

describe('formatDuration', () => {
  it('shows minutes and seconds, hours past an hour', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(372_900)).toBe('6:12');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('agoFrom', () => {
  const now = Date.parse('2026-09-29T11:00:00Z');
  it('rounds down to now, minutes or hours', () => {
    expect(agoFrom('2026-09-29T10:59:30Z', now)).toEqual({ unit: 'now' });
    expect(agoFrom('2026-09-29T10:54:00Z', now)).toEqual({ unit: 'minutes', n: 6 });
    expect(agoFrom('2026-09-29T08:30:00Z', now)).toEqual({ unit: 'hours', n: 2 });
  });
});
