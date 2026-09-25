import { describe, expect, it } from 'vitest';
import type { SessionAttemptRow } from '@/lib/db/attempts';
import { attemptsToCsv, formatPoints, gradesToCsv } from './csv';

function row(overrides: Partial<SessionAttemptRow> = {}): SessionAttemptRow {
  return {
    id: '1',
    studentName: 'Олена',
    taskId: 'task-1',
    taskTitle: 'Квадрат',
    passed: true,
    hintsUsed: 0,
    durationMs: 12_345,
    score: null,
    sourceHash: null,
    createdAt: '2026-01-01T12:00:00.000Z',
    ...overrides
  };
}

describe('attemptsToCsv', () => {
  it('starts with a UTF-8 BOM, for Excel to read Cyrillic without asking', () => {
    const csv = attemptsToCsv([row()]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('writes the header row followed by one row per attempt', () => {
    const csv = attemptsToCsv([row(), row({ studentName: 'Тарас', passed: false, hintsUsed: 2, durationMs: null })]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('Олена,Квадрат,Зараховано,0,12,2026-01-01T12:00:00.000Z');
    expect(lines[2]).toBe('Тарас,Квадрат,Не зараховано,2,,2026-01-01T12:00:00.000Z');
  });

  it('quotes a field that contains a comma, and doubles an embedded quote', () => {
    const csv = attemptsToCsv([row({ taskTitle: 'Черепашка: "квадрат", великий' })]);
    const dataLine = csv.slice(1).split('\r\n')[1];
    expect(dataLine).toContain('"Черепашка: ""квадрат"", великий"');
  });

  it('produces only the header row when there are no attempts', () => {
    const csv = attemptsToCsv([]);
    expect(csv.slice(1).split('\r\n')).toHaveLength(1);
  });
});

describe('gradesToCsv', () => {
  it('writes one row per student, blank for nothing submitted', () => {
    const csv = gradesToCsv([
      { studentName: 'Олена', suggestion: { earned: 4.5, possible: 6, share: 0.75, grade: 9, capped: false } },
      { studentName: 'Тарас', suggestion: { earned: 0, possible: 6, share: 0, grade: null, capped: false } }
    ]);
    expect(csv.split('\r\n').slice(1)).toEqual(['Олена,9,4.5/6', 'Тарас,,']);
  });

  it('rounds fractional points to one decimal', () => {
    expect(formatPoints(2 / 3)).toBe('0.7');
    expect(formatPoints(3)).toBe('3');
  });
});
