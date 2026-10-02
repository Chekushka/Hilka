import { describe, expect, it } from 'vitest';
import { assignTasks } from '@/lib/seed';
import { suggestSessionGrades } from './session-grades';

const tasks = ['a', 'b', 'c', 'd'].map((id) => ({ id, difficulty: 2 }));
const session = {
  id: 'session-1',
  kind: 'lesson' as const,
  roster: ['Олена', 'Тарас'],
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
      studentName: 'Олена',
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
});
