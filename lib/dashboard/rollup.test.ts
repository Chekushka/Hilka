import { describe, expect, it } from 'vitest';
import { buildRollup } from './rollup';

const tasks = [
  { id: 't1', slug: 'square', title: 'Квадрат', difficulty: 1 },
  { id: 't2', slug: 'triangle', title: 'Трикутник', difficulty: 1 }
];

function attempt(studentName: string, taskId: string, passed: boolean) {
  return { studentName, taskId, passed };
}

describe('buildRollup', () => {
  it('marks a task with no attempts as not_started', () => {
    const rows = buildRollup(['Олена'], tasks, []);
    expect(rows[0].cells).toEqual([
      { status: 'not_started', attempts: 0 },
      { status: 'not_started', attempts: 0 }
    ]);
    expect(rows[0].stuckCount).toBe(0);
  });

  it('marks a task passed on any passing attempt, even after earlier failures', () => {
    const rows = buildRollup(
      ['Олена'],
      tasks,
      [attempt('Олена', 't1', false), attempt('Олена', 't1', false), attempt('Олена', 't1', true)]
    );
    expect(rows[0].cells[0]).toEqual({ status: 'passed', attempts: 3 });
  });

  it('marks a task stuck when every attempt failed', () => {
    const rows = buildRollup(['Олена'], tasks, [attempt('Олена', 't1', false), attempt('Олена', 't1', false)]);
    expect(rows[0].cells[0]).toEqual({ status: 'stuck', attempts: 2 });
    expect(rows[0].stuckCount).toBe(1);
  });

  it('sorts the most-stuck student first, ties broken by name', () => {
    const rows = buildRollup(
      ['Тарас', 'Соломія', 'Олена'],
      tasks,
      [
        attempt('Соломія', 't1', false),
        attempt('Соломія', 't2', false),
        attempt('Тарас', 't1', false),
        attempt('Олена', 't1', true)
      ]
    );
    expect(rows.map((r) => r.studentName)).toEqual(['Соломія', 'Тарас', 'Олена']);
  });

  it('never attributes one student\'s attempt to another with the same task', () => {
    const rows = buildRollup(['Олена', 'Тарас'], tasks, [attempt('Тарас', 't1', false)]);
    const olena = rows.find((r) => r.studentName === 'Олена')!;
    expect(olena.cells[0]).toEqual({ status: 'not_started', attempts: 0 });
  });
});
