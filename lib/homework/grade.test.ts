import { describe, expect, it } from 'vitest';
import { suggestHomeworkGrade, suggestHomeworkGradesForRoster } from './grade';

const DUE = '2026-10-10T18:00:00.000Z';
const BEFORE = (minute: number) => `2026-10-09T10:${String(minute).padStart(2, '0')}:00.000Z`;

function attempt(taskId: string, passed: boolean, createdAt: string, extra: { score?: number; hintsUsed?: number } = {}) {
  return { taskId, passed, score: extra.score ?? (passed ? 1 : 0), hintsUsed: extra.hintsUsed ?? 0, createdAt };
}

// Difficulty 2, 3, 4 → 1, 2, 3 points; the improvement task is difficulty 3 → 2 points.
const main = [
  { id: 't1', difficulty: 2 },
  { id: 't2', difficulty: 3 },
  { id: 't3', difficulty: 4 }
];
const improvement = [{ id: 'up', difficulty: 3 }];

describe('suggestHomeworkGrade', () => {
  it('works through the example in docs/HOMEWORK.md', () => {
    const attempts = [
      attempt('t1', true, BEFORE(1)),
      attempt('t2', false, BEFORE(2)),
      attempt('t2', true, BEFORE(3)), // a fix: 2 × 0.7
      attempt('t3', true, BEFORE(4), { hintsUsed: 1 }) // 3 × 0.75, and opens 10–12
    ];
    const before = suggestHomeworkGrade(main, improvement, attempts, DUE);
    expect(before.earned).toBeCloseTo(1 + 1.4 + 2.25);
    expect(before.grade).toBe(10);
    expect(before.fixedTasks).toBe(1);

    const after = suggestHomeworkGrade(main, improvement, [...attempts, attempt('up', true, BEFORE(5))], DUE);
    // 2 points available, only the 1.35 lost are recovered.
    expect(after.earned).toBeCloseTo(6);
    expect(after.recovered).toBeCloseTo(1.35);
    expect(after.share).toBeCloseTo(1);
    expect(after.grade).toBe(12);
  });

  it('keeps the best of the counted Checks, never a Check past the second fix', () => {
    const attempts = [
      attempt('t1', false, BEFORE(1)),
      attempt('t1', false, BEFORE(2)),
      attempt('t1', false, BEFORE(3)),
      attempt('t1', true, BEFORE(4)) // a fourth Check — the server refuses it; grading ignores it too
    ];
    expect(suggestHomeworkGrade([main[0]], [], attempts, DUE).earned).toBe(0);
  });

  it('does not let a fix open the 10–12 band', () => {
    const attempts = [
      attempt('t1', true, BEFORE(1)),
      attempt('t2', true, BEFORE(2)),
      attempt('t3', false, BEFORE(3)),
      attempt('t3', true, BEFORE(4))
    ];
    // (1 + 2 + 2.1) / 6 = 85% → 11 on share, capped at 9.
    const grade = suggestHomeworkGrade(main, [], attempts, DUE);
    expect(grade.capped).toBe(true);
    expect(grade.grade).toBe(9);
  });

  it('lets a hard improvement task open the 10–12 band', () => {
    const hardImprovement = [{ id: 'up', difficulty: 5 }];
    const attempts = [
      attempt('t1', false, BEFORE(1)),
      attempt('t2', true, BEFORE(2)),
      attempt('t3', false, BEFORE(3)),
      attempt('t3', true, BEFORE(4)),
      attempt('up', true, BEFORE(5))
    ];
    const grade = suggestHomeworkGrade(main, hardImprovement, attempts, DUE);
    expect(grade.capped).toBe(false);
    expect(grade.grade).toBe(12);
  });

  it('counts an improvement task on its first Check only', () => {
    const attempts = [attempt('t1', false, BEFORE(1)), attempt('up', false, BEFORE(2)), attempt('up', true, BEFORE(3))];
    expect(suggestHomeworkGrade([main[0]], improvement, attempts, DUE).recovered).toBe(0);
  });

  it('takes 70% for work up to two days late and 50% after', () => {
    const late = (hours: number) => new Date(Date.parse(DUE) + hours * 3600_000).toISOString();
    const one = [{ id: 't3', difficulty: 4 }];
    expect(suggestHomeworkGrade(one, [], [attempt('t3', true, late(30))], DUE).earned).toBeCloseTo(2.1);
    expect(suggestHomeworkGrade(one, [], [attempt('t3', true, late(72))], DUE).earned).toBeCloseTo(1.5);
    const grade = suggestHomeworkGrade(one, [], [attempt('t3', true, late(72))], DUE);
    expect(grade.lateAttempts).toBe(1);
  });

  it('stacks a late fix: 70% for the fix, then the late credit', () => {
    const lateFix = new Date(Date.parse(DUE) + 3600_000).toISOString();
    const attempts = [attempt('t3', false, BEFORE(1)), attempt('t3', true, lateFix)];
    expect(suggestHomeworkGrade([main[2]], [], attempts, DUE).earned).toBeCloseTo(3 * 0.7 * 0.7);
  });

  it('gives no grade, not a 1, to a student who submitted nothing', () => {
    expect(suggestHomeworkGrade(main, improvement, [], DUE).grade).toBeNull();
  });

  it('suggests a grade per roster name, in roster order', () => {
    const rows = suggestHomeworkGradesForRoster(
      ['Олена', 'Марко'],
      main,
      [],
      [{ ...attempt('t1', true, BEFORE(1)), studentName: 'Марко' }],
      DUE
    );
    expect(rows.map((row) => row.studentName)).toEqual(['Олена', 'Марко']);
    expect(rows[0].suggestion.grade).toBeNull();
    expect(rows[1].suggestion.earned).toBe(1);
  });
});

describe('suggestHomeworkGrade with a class check', () => {
  const IN_CLASS = '2026-10-12T09:00:00.000Z';
  const homework = [
    attempt('t1', true, BEFORE(1)),
    attempt('t2', true, BEFORE(2)),
    attempt('t3', true, BEFORE(3)) // difficulty 4: opens 10–12 while it stands
  ];
  const check = (taskId: string, passed: boolean, at = IN_CLASS) => ({ taskId, passed, createdAt: at });

  it('changes nothing when every checked task passes', () => {
    const grade = suggestHomeworkGrade(main, [], homework, DUE, [check('t2', true), check('t3', true)]);
    expect(grade.earned).toBe(6);
    expect(grade.grade).toBe(12);
    expect(grade.checkedTasks).toBe(2);
    expect(grade.confirmedTasks).toBe(2);
  });

  it('lowers a task that fails its check to 70%, and a hard one no longer opens 10–12', () => {
    const grade = suggestHomeworkGrade(main, [], homework, DUE, [check('t3', false)]);
    // 1 + 2 + 3 × 0.7 = 5.1 / 6 = 85% → 11 on share, but the only hard task was refuted.
    expect(grade.earned).toBeCloseTo(5.1);
    expect(grade.capped).toBe(true);
    expect(grade.grade).toBe(9);
    expect(grade.checkedTasks).toBe(1);
    expect(grade.confirmedTasks).toBe(0);
  });

  it('never raises a task: a fixed task stays at its fix credit after a failed check', () => {
    const fixed = [attempt('t2', false, BEFORE(1)), attempt('t2', true, BEFORE(2), { hintsUsed: 1 })];
    // 2 × 0.7 × 0.75 = 1.05 already below the 70% cap.
    expect(suggestHomeworkGrade([main[1]], [], fixed, DUE, [check('t2', false)]).earned).toBeCloseTo(1.05);
  });

  it('keeps the credit of a task the student was not checked on', () => {
    expect(suggestHomeworkGrade(main, [], homework, DUE, [check('t1', false)]).earned).toBeCloseTo(0.7 + 2 + 3);
  });

  it('reads only the first Check of a task across class checks', () => {
    const later = '2026-10-13T09:00:00.000Z';
    const grade = suggestHomeworkGrade(main, [], homework, DUE, [check('t3', true, later), check('t3', false)]);
    expect(grade.confirmedTasks).toBe(0);
    expect(grade.earned).toBeCloseTo(5.1);
  });

  it('passes each student only their own checks', () => {
    const rows = suggestHomeworkGradesForRoster(
      ['Олена', 'Марко'],
      [main[2]],
      [],
      [
        { ...attempt('t3', true, BEFORE(1)), studentName: 'Олена' },
        { ...attempt('t3', true, BEFORE(2)), studentName: 'Марко' }
      ],
      DUE,
      [{ ...check('t3', false), studentName: 'Марко' }]
    );
    expect(rows[0].suggestion.earned).toBe(3);
    expect(rows[1].suggestion.earned).toBeCloseTo(2.1);
  });
});
