import { describe, expect, it } from 'vitest';
import { deadlineDistance, formatDeadline } from './deadline';

describe('formatDeadline', () => {
  it('writes the Kyiv date and time, not UTC', () => {
    // 15:00 UTC is 18:00 in Kyiv in October (EEST, UTC+3).
    const text = formatDeadline('2026-10-09T15:00:00.000Z');
    expect(text).toContain('18:00');
    expect(text).toContain('9');
    expect(text).toContain('жовтня');
  });
});

describe('deadlineDistance', () => {
  const due = '2026-10-10T18:00:00.000Z';
  const at = (hoursBefore: number) => Date.parse(due) - hoursBefore * 3600_000;

  it('speaks in days, then hours, then minutes', () => {
    expect(deadlineDistance(due, at(50))).toBe('через 2 дні');
    expect(deadlineDistance(due, at(5))).toBe('через 5 годин');
    expect(deadlineDistance(due, at(0.5))).toBe('через 30 хвилин');
  });

  it('says how long ago once it has passed', () => {
    expect(deadlineDistance(due, at(-30))).toBe('1 день тому');
  });
});
