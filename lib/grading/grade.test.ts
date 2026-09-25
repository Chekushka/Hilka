import { describe, expect, it } from 'vitest';
import { gradeForShare, sessionAllowsHighBand, suggestGrade, suggestGradesForRoster, taskPoints } from './grade';

function attempt(taskId: string, passed: boolean, extra: { score?: number | null; hintsUsed?: number; at?: string } = {}) {
  return {
    taskId,
    passed,
    score: extra.score === undefined ? (passed ? 1 : 0) : extra.score,
    hintsUsed: extra.hintsUsed ?? 0,
    createdAt: extra.at ?? '2026-01-01T10:00:00.000Z'
  };
}

describe('taskPoints', () => {
  it('weights 1–2 as 1, 3 as 2, 4–5 as 3', () => {
    expect([1, 2, 3, 4, 5].map((d) => taskPoints(d))).toEqual([1, 1, 2, 3, 3]);
  });
});

describe('gradeForShare', () => {
  it('follows the agreed level boundaries', () => {
    expect(gradeForShare(0)).toBe(1);
    expect(gradeForShare(0.15)).toBe(3); // top of початковий
    expect(gradeForShare(0.16)).toBe(4); // середній starts above 15%
    expect(gradeForShare(0.6)).toBe(6); // top of середній
    expect(gradeForShare(0.61)).toBe(7);
    expect(gradeForShare(0.75)).toBe(9); // top of достатній
    expect(gradeForShare(0.76)).toBe(10);
    expect(gradeForShare(10 / 12)).toBe(10);
    expect(gradeForShare(11 / 12)).toBe(11);
    expect(gradeForShare(1)).toBe(12);
  });

  it('gives three grades to every level', () => {
    const grades = Array.from({ length: 101 }, (_, p) => gradeForShare(p / 100));
    expect(new Set(grades)).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
  });
});

describe('suggestGrade', () => {
  const tasks = [
    { id: 'a', difficulty: 1 },
    { id: 'b', difficulty: 3 },
    { id: 'c', difficulty: 4 }
  ]; // 1 + 2 + 3 = 6 points

  it('gives no grade to a student who submitted nothing', () => {
    expect(suggestGrade(tasks, [])).toMatchObject({ grade: null, earned: 0, possible: 6 });
  });

  it('gives 1, not nothing, to a student who submitted but solved nothing', () => {
    expect(suggestGrade(tasks, [attempt('a', false)]).grade).toBe(1);
  });

  it('gives 12 for everything solved, the hard task included', () => {
    expect(suggestGrade(tasks, [attempt('a', true), attempt('b', true), attempt('c', true)])).toMatchObject({
      earned: 6,
      grade: 12,
      capped: false
    });
  });

  it('counts only the first attempt on a task', () => {
    const result = suggestGrade(tasks, [
      attempt('c', true, { at: '2026-01-01T10:05:00.000Z' }),
      attempt('c', false, { at: '2026-01-01T10:00:00.000Z' })
    ]);
    expect(result.earned).toBe(0);
  });

  it('gives partial credit for the share of input cases passed', () => {
    expect(suggestGrade(tasks, [attempt('c', false, { score: 2 / 3 })]).earned).toBeCloseTo(2);
  });

  it('treats a missing score on a failed attempt as zero', () => {
    expect(suggestGrade(tasks, [attempt('c', false, { score: null })]).earned).toBe(0);
  });

  it('credits a task solved after a hint at 75%', () => {
    expect(suggestGrade(tasks, [attempt('b', true, { hintsUsed: 2 })]).earned).toBeCloseTo(1.5);
  });

  it('caps at 9 when the share is high but no hard task was fully solved', () => {
    const easy = [
      { id: 'a', difficulty: 3 },
      { id: 'b', difficulty: 3 },
      { id: 'c', difficulty: 3 },
      { id: 'd', difficulty: 3 },
      { id: 'hard', difficulty: 5 }
    ]; // 8 + 3 = 11 points; the four easy ones are 8/11 = 73% → 9 anyway
    const all = [attempt('a', true), attempt('b', true), attempt('c', true), attempt('d', true)];
    expect(suggestGrade(easy, all)).toMatchObject({ grade: 9, capped: false });

    // Partial credit on the hard task lifts the share above 75%, but it is not solved.
    const partial = [...all, attempt('hard', false, { score: 2 / 3 })];
    expect(suggestGrade(easy, partial)).toMatchObject({ grade: 9, capped: true });

    // Solving it (even with a hint) opens the high band.
    const solved = [...all, attempt('hard', true, { hintsUsed: 1 })];
    expect(suggestGrade(easy, solved).grade).toBeGreaterThan(9);
  });

  it('caps a session with no hard task at 9', () => {
    const noHard = [
      { id: 'a', difficulty: 2 },
      { id: 'b', difficulty: 3 }
    ];
    expect(sessionAllowsHighBand(noHard)).toBe(false);
    expect(suggestGrade(noHard, [attempt('a', true), attempt('b', true)])).toMatchObject({ grade: 9, capped: true });
  });
});

describe('suggestGradesForRoster', () => {
  it('grades each roster name on its own attempts only, in roster order', () => {
    const tasks = [{ id: 'a', difficulty: 4 }];
    const rows = suggestGradesForRoster(['Олена', 'Тарас', 'Соломія'], tasks, [
      { ...attempt('a', true), studentName: 'Тарас' },
      { ...attempt('a', false), studentName: 'Олена' }
    ]);
    expect(rows.map((r) => [r.studentName, r.suggestion.grade])).toEqual([
      ['Олена', 1],
      ['Тарас', 12],
      ['Соломія', null]
    ]);
  });
});
