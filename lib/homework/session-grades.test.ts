import { describe, expect, it } from 'vitest';
import { assignTasks } from '@/lib/seed';
import { suggestSessionGrades } from './session-grades';

const tasks = ['a', 'b', 'c', 'd'].map((id) => ({ id, difficulty: 2 }));
const session = {
  id: 'session-1',
  kind: 'lesson' as const,
  roster: [
    { id: 'Олена', name: 'Олена' },
    { id: 'Тарас', name: 'Тарас' }
  ],
  tasks,
  improvementTasks: [],
  dueAt: null,
  assignment: { poolSize: 2, shuffle: false }
};

describe('suggestSessionGrades with a pool', () => {
  it('grades each student on the tasks they were given, not on the whole list', () => {
    const own = assignTasks(
      tasks.map((task) => task.id),
      session.id,
      'Олена',
      session.assignment
    );
    const attempts = own.map((taskId) => ({
      studentId: 'Олена',
      taskId,
      passed: true,
      score: 1,
      hintsUsed: 0,
      createdAt: '2026-10-05T10:00:00.000Z'
    }));
    const [olena, taras] = suggestSessionGrades(session, attempts);
    expect(olena.suggestion.possible).toBe(2);
    expect(olena.suggestion.share).toBe(1);
    expect(taras.suggestion.grade).toBeNull();
  });

  it("draws a student's pool from their seed key, so a rename changes nothing", () => {
    const before = { ...session, roster: [{ id: 'a1', name: 'Оля', seed: 'Оля' }] };
    const renamed = { ...session, roster: [{ id: 'a1', name: 'Ольга', seed: 'Оля' }] };
    const own = assignTasks(
      tasks.map((task) => task.id),
      session.id,
      'Оля',
      session.assignment
    );
    const attempts = own.map((taskId) => ({ studentId: 'a1', taskId, passed: true, score: 1, hintsUsed: 0, createdAt: '2026-10-05T10:00:00.000Z' }));
    for (const version of [before, renamed]) {
      const [row] = suggestSessionGrades(version, attempts);
      expect(row.suggestion.share).toBe(1);
    }
    expect(suggestSessionGrades(renamed, attempts)[0].studentName).toBe('Ольга');
  });
});
