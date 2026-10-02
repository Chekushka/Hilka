import { describe, expect, it } from 'vitest';
import { summarizeDevices, usedElsewhere } from './devices';

describe('summarizeDevices', () => {
  it('numbers devices in order of first use and counts their attempts', () => {
    const summary = summarizeDevices([
      { deviceId: 'phone', createdAt: '2026-10-06T19:00:00.000Z' },
      { deviceId: 'school', createdAt: '2026-10-06T09:00:00.000Z' },
      { deviceId: 'phone', createdAt: '2026-10-07T19:00:00.000Z' },
      { deviceId: null, createdAt: '2026-10-05T09:00:00.000Z' }
    ]);
    expect(summary.map(({ deviceId, number, attempts }) => ({ deviceId, number, attempts }))).toEqual([
      { deviceId: 'school', number: 1, attempts: 1 },
      { deviceId: 'phone', number: 2, attempts: 2 }
    ]);
    expect(summary[1].lastAt).toBe('2026-10-07T19:00:00.000Z');
  });
});

describe('usedElsewhere', () => {
  it('notices another device, never this one or an unmarked old attempt', () => {
    expect(usedElsewhere([{ deviceId: 'mine', createdAt: 'x' }], 'mine')).toBe(false);
    expect(usedElsewhere([{ deviceId: null, createdAt: 'x' }], 'mine')).toBe(false);
    expect(usedElsewhere([{ deviceId: 'other', createdAt: 'x' }], 'mine')).toBe(true);
    expect(usedElsewhere([{ deviceId: 'other', createdAt: 'x' }], null)).toBe(true);
  });
});
